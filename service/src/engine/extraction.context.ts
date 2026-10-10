// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Builds the input of one extraction call: a window of pending messages plus bounded,
 * numbered shortlists (open plans P#, current facts F#, current notes N#, recent + related episodes E#)
 * the model can reference. Lists are capped so the prompt does not grow with the owner's history
 * (cost principle; flash used +20% input tokens in the spike because lists grew).
 */
import { type EntityManager } from 'typeorm';
import { calendar, describe, localDate, type Precision } from './time';
import { type PromptContact, type PromptContext, type PromptMessage } from './extraction.prompt';
import { type QualityProfile } from './quality-profile';
import { accountSpeaker, type AuthorKind } from '../rawlog/attribution';
import { type MemoryGender } from '../identity/identity.entities';
import { expireClarifications } from './clarifications';
import { fold } from './subjects';

const MAX_OPEN_PLANS = 15;
const MAX_FACTS = 40;
const MAX_NOTES = 30;
/** Older episodes close in meaning to the window sit next to the recent ones (counts: quality profile):
 * under noise the recent ones crowd out the episode a correction refers to (M4b: "it was 210, not 180"
 * left the wrong value visible). */
const MIN_RELATED_SIMILARITY = 0.45;
/** Contacts listed for a window (those it names, its participants, the candidates of open questions). */
const MAX_CONTACTS = 30;
const MAX_QUESTIONS = 5;

export interface WindowMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'other';
  toolName: string | null;
  /**
   * The account speaker's turn (author role `owner`: what they say is stated, not a claim). Personal memories: the self
   * or own content (author kind `self` / `own`). Entity memories: whoever talks to the agent through its account (role
   * `user`, own content, the `owner` participant) — a person, never the agent itself (labelled `someone` until named).
   */
  accountSpeaker: boolean;
  /** Who wrote it, as recorded at ingest (D50). */
  authorKind: AuthorKind;
  /** The contact (or self) who wrote it, when identified. */
  authorPersonId: string | null;
  authorName: string | null;
  content: string;
  sentAt: Date;
  /** An assistant reply given right after a memory recall in its turn (an echo of memories, not new information). */
  fromMemory?: boolean;
}

export interface Owner {
  id: string;
  /** The memory's name (display name of its own person row): the name of "I" (the account holder, or the shared agent). */
  name?: string;
  locale: string;
  timezone: string;
  /** An entity memory (D50, 8.5): a shared agent several people talk to; otherwise a personal memory. */
  entity?: boolean;
  /** First person in gendered languages. */
  gender?: MemoryGender;
}

export interface FactRef {
  id: string;
  key: string;
  validFrom: Date | null;
  /** The contact the fact is about (null = the memory's self). */
  subjectId?: string | null;
}

export interface ExtractionInput {
  prompt: PromptContext;
  /** message number (1-based) → messages[n - 1] */
  messages: WindowMessage[];
  plans: Map<string, string>;     // "P1" → episode id
  facts: Map<string, FactRef>;    // "F1" → fact
  notes: Map<string, string>;     // "N1" → note id
  episodes: Map<string, string>;  // "E1" → episode id
  /** "C1" → contact (person id). */
  contacts: Map<string, string>;
  /** "Q1" → open clarification. */
  questions: Map<string, { id: string; candidates: string[] }>;
  /** The self's names (display name first, then aliases). */
  selfNames: string[];
  /** "S1" → a source learned in this conversation with no episode yet (WORK_PLAN 8.9). */
  sources: Map<string, string>;
}

/** Recordare's own read tools, as a client names them (possibly prefixed, e.g. `recordare_search_episodes`). */
const MEMORY_TOOLS = '(^|[_.:-])(search_episodes|search_memory|search_facts|resolve_period)$';
export const isMemoryTool = (name: string | null): boolean => !!name && new RegExp(MEMORY_TOOLS).test(name);

/** Pending messages of a conversation, oldest first, split into windows of bounded size. */
export async function pendingWindows(tx: EntityManager, conversationId: string, maxChars: number, personal = false): Promise<WindowMessage[][]> {
  const rows: Array<{ id: string; role: WindowMessage['role']; tool_name: string | null; account_speaker: boolean; author_kind: AuthorKind;
    author_person_id: string | null; author_name: string | null; content: string; sent_at: Date; from_memory: boolean }> = await tx.query(
    // Unverified group members are not persons: their name comes from the conversation's participants.
    // from_memory: an assistant reply whose turn (since the previous non-assistant, non-tool message) contains a
    // recall — one of Recordare's read tools called by the client (its tool message), or a recall Recordare served
    // in this conversation.
    `SELECT m.id, m.role, m.tool_name, ${personal ? `m.author_kind IN ('self', 'own')` : accountSpeaker('m')} AS account_speaker,
       m.author_kind, m.author_person_id, COALESCE(p.display_name, cp.display_name) AS author_name, m.content, m.sent_at,
       (m.role = 'assistant' AND (
          EXISTS (SELECT 1 FROM messages t WHERE t.conversation_id = m.conversation_id AND t.role = 'tool'
                    AND t.tool_name ~ $2 AND t.sent_at <= m.sent_at + interval '5 seconds' AND t.sent_at >= turn.start)
          OR EXISTS (SELECT 1 FROM recall_log r WHERE r.conversation_id = m.conversation_id
                    AND r.served_at <= m.sent_at AND r.served_at >= turn.start))) AS from_memory
     FROM messages m LEFT JOIN persons p ON p.id = m.author_person_id
       LEFT JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.ref = m.author_ref
       CROSS JOIN LATERAL (SELECT COALESCE(max(u.sent_at), '-infinity'::timestamptz) AS start FROM messages u
                           WHERE u.conversation_id = m.conversation_id AND u.role IN ('user', 'other') AND u.sent_at < m.sent_at) turn
     WHERE m.conversation_id = $1 AND m.extracted_run_id IS NULL
     ORDER BY m.sent_at, m.received_at`,
    [conversationId, MEMORY_TOOLS],
  );
  const windows: WindowMessage[][] = [];
  let current: WindowMessage[] = [];
  let size = 0;
  for (const r of rows) {
    const msg: WindowMessage = { id: r.id, role: r.role, toolName: r.tool_name, accountSpeaker: r.account_speaker,
      authorKind: r.author_kind, authorPersonId: r.author_person_id, authorName: r.author_name, content: r.content, sentAt: r.sent_at, ...(r.from_memory ? { fromMemory: true } : {}) };
    if (current.length > 0 && size + r.content.length > maxChars) {
      windows.push(current);
      current = [];
      size = 0;
    }
    current.push(msg);
    size += r.content.length;
  }
  if (current.length) windows.push(current);
  return windows;
}

/**
 * Who said a message, as the prompts show it: the assistant and own content are me in both modes; the account's speaker
 * is me in a personal memory; people by name with their C-number; the rest `other:<Name>` or `someone` (in an entity
 * memory, whoever talks to the agent through its account until the conversation names them).
 */
function speaker(m: WindowMessage, contactRef: Map<string, string>): string {
  if (m.role === 'tool') return `tool${m.toolName ? `:${m.toolName}` : ''}`;
  if (m.role === 'assistant') return 'me (assistant)';
  if (m.authorKind === 'own') return 'me (own)';
  if (m.authorKind === 'self') return 'me';
  const ref = m.authorPersonId ? contactRef.get(m.authorPersonId) : undefined;
  if (m.authorKind === 'contact' && m.authorName) return `${m.authorName}${ref ? ` [${ref}]` : ''}`;
  return m.authorName ? `other:${m.authorName}` : 'someone';
}

export async function buildInput(tx: EntityManager, owner: Owner, window: WindowMessage[], knownSlots: string[],
  windowVector: number[] | null, profile: Pick<QualityProfile, 'recentEpisodes' | 'relatedEpisodes'>): Promise<ExtractionInput> {
  const tz = owner.timezone;
  const first = window[0] as WindowMessage;
  const messageDay = localDate(first.sentAt, tz);

  const plans: Array<{ id: string; content: string; occurred_at: Date | null; occurred_until: Date | null; date_precision: Precision }> = await tx.query(
    `SELECT id, content, occurred_at, occurred_until, date_precision FROM episodes
     WHERE owner_id = $1 AND kind = 'plan' AND plan_status = 'open' AND deleted_at IS NULL AND invalidated_at IS NULL
     ORDER BY recorded_at DESC LIMIT $2`, [owner.id, MAX_OPEN_PLANS]);
  // Facts of the memory's self and of the people it knows (both modes since 8.4), each labelled with its subject.
  const facts: Array<{ id: string; key: string; value: string | null; valid_from: Date | null; subject_id: string | null; subject: string | null }> = await tx.query(
    `SELECT f.id, f.key, f.value, f.valid_from, f.subject_person_id AS subject_id, p.display_name AS subject
     FROM facts f LEFT JOIN persons p ON p.id = f.subject_person_id
     WHERE f.owner_id = $1 AND f.status IN ('current', 'unknown_current') AND f.deleted_at IS NULL
     ORDER BY f.recorded_at DESC LIMIT $2`, [owner.id, MAX_FACTS]);
  const notes: Array<{ id: string; category: string; content: string }> = await tx.query(
    `SELECT id, category, content FROM notes
     WHERE owner_id = $1 AND status = 'current' AND deleted_at IS NULL
     ORDER BY pinned DESC, recorded_at DESC LIMIT $2`, [owner.id, MAX_NOTES]);
  type EpisodeRow = { id: string; content: string; occurred_at: Date | null; date_precision: Precision };
  const visible = `owner_id = $1 AND kind <> 'plan' AND deleted_at IS NULL AND invalidated_at IS NULL AND duplicate_of IS NULL`;
  const recent: EpisodeRow[] = await tx.query(
    `SELECT id, content, occurred_at, date_precision FROM episodes
     WHERE ${visible} AND recorded_at > $2::timestamptz - interval '30 days'
     ORDER BY recorded_at DESC LIMIT $3`, [owner.id, first.sentAt, profile.recentEpisodes]);
  const related: EpisodeRow[] = windowVector
    ? await tx.query(
      `SELECT id, content, occurred_at, date_precision FROM (
         SELECT id, content, occurred_at, date_precision, embedding <=> $2::vector AS dist FROM episodes
         WHERE ${visible} AND embedding IS NOT NULL ORDER BY dist LIMIT $3) r
       WHERE 1 - dist >= $4`, [owner.id, `[${windowVector.join(',')}]`, profile.relatedEpisodes, MIN_RELATED_SIMILARITY])
    : [];
  const episodes = [...recent, ...related.filter((r) => !recent.some((e) => e.id === r.id))];

  const planMap = new Map<string, string>();
  const factMap = new Map<string, FactRef>();
  const noteMap = new Map<string, string>();
  const episodeMap = new Map<string, string>();
  const when = (at: Date | null, p: Precision) => describe(at, p, tz, owner.locale);
  const clock = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' });

  const people = await peopleContext(tx, owner, window, facts.map((f) => f.subject_id).filter((x): x is string => !!x));
  // Sources learned in this conversation that no episode tells of yet (complete ones: all parts received).
  const learned: Array<{ id: string; title: string; author: string | null; kind: string; provider: string | null; provided_by_kind: string }> = await tx.query(
    `SELECT s.id, s.title, s.author, s.kind, p.display_name AS provider, s.provided_by_kind FROM sources s LEFT JOIN persons p ON p.id = s.provided_by_person_id
     WHERE s.conversation_id = (SELECT conversation_id FROM messages WHERE id = $1) AND s.learned_episode_id IS NULL AND s.status <> 'receiving'
     ORDER BY s.learned_at LIMIT 10`, [first.id]);
  const sourceMap = new Map<string, string>();
  const messages: PromptMessage[] = window.map((m, i) => ({
    n: i + 1,
    speaker: speaker(m, people.refOf),
    sentAt: `${describe(m.sentAt, 'day', tz, owner.locale)} ${clock.format(m.sentAt)}`,
    content: m.content,
  }));

  return {
    messages: window,
    plans: planMap,
    facts: factMap,
    notes: noteMap,
    episodes: episodeMap,
    contacts: people.contacts,
    questions: people.questions,
    selfNames: people.selfNames,
    sources: sourceMap,
    prompt: {
      learnedSources: learned.map((l, i) => {
        sourceMap.set(`S${i + 1}`, l.id);
        const by = l.provided_by_kind === 'contact' && l.provider ? `given by ${l.provider}` : l.provided_by_kind === 'someone' ? 'given by someone' : 'mine';
        return `S${i + 1}: «${l.title}»${l.author ? ` by ${l.author}` : ''} (${l.kind}; ${by})`;
      }),
      selfNames: people.selfNames,
      gender: owner.gender ?? 'masculine',
      contacts: people.list,
      openQuestions: people.lines,
      locale: owner.locale,
      messageDay,
      calendar: calendar(messageDay, 14, 21, owner.locale),
      openPlans: plans.map((p, i) => {
        planMap.set(`P${i + 1}`, p.id);
        const until = p.occurred_until ? ` → ${localDate(p.occurred_until, tz)}` : '';
        return `P${i + 1}: ${p.content} (planned ${when(p.occurred_at, p.date_precision)}${until})`;
      }),
      currentFacts: facts.map((f, i) => {
        factMap.set(`F${i + 1}`, { id: f.id, key: f.key, validFrom: f.valid_from, subjectId: f.subject_id });
        return `F${i + 1}: [${f.subject ?? 'me'}] ${f.key} = ${f.value ?? '(unknown)'}${f.valid_from ? ` (since ${localDate(f.valid_from, tz)})` : ''}`;
      }),
      currentNotes: notes.map((n, i) => {
        noteMap.set(`N${i + 1}`, n.id);
        return `N${i + 1}: [${n.category}] ${n.content}`;
      }),
      knownEpisodes: episodes.map((e, i) => {
        episodeMap.set(`E${i + 1}`, e.id);
        return `E${i + 1}: ${e.content} (${when(e.occurred_at, e.date_precision)})`;
      }),
      knownSlots,
      messages,
    },
  };
}

export interface PeopleContext {
  selfNames: string[];
  list: PromptContact[];
  contacts: Map<string, string>;
  refOf: Map<string, string>;
  questions: Map<string, { id: string; candidates: string[] }>;
  lines: string[];
}

/**
 * The self's names, the contacts the window concerns (named in it, its participants,
 * the subjects of listed facts, the candidates of open questions — numbered C1…) and the open questions (Q1…), after
 * expiring old ones (as of the window's first message).
 */
export async function peopleContext(tx: EntityManager, owner: Owner, window: WindowMessage[], factSubjects: string[]): Promise<PeopleContext> {
  const selfRows: Array<{ alias: string }> = await tx.query(
    `SELECT alias FROM person_aliases WHERE person_id = $1 ORDER BY created_at`, [owner.id]);
  const selfNames = [...new Set([owner.name, ...selfRows.map((r) => r.alias)].filter((n): n is string => !!n?.trim()))];

  await expireClarifications(tx, owner.id, (window[0] as WindowMessage).sentAt);
  const open: Array<{ id: string; question: string; candidates: string[]; contact_id: string | null; about: string | null }> = await tx.query(
    `SELECT c.id, c.question, c.candidates, c.contact_id, COALESCE(e.content, n.content, f.key || ' = ' || COALESCE(f.value, '?')) AS about
     FROM clarifications c LEFT JOIN episodes e ON e.id = c.episode_id LEFT JOIN notes n ON n.id = c.note_id LEFT JOIN facts f ON f.id = c.fact_id
     WHERE c.owner_id = $1 AND c.status = 'open' ORDER BY c.created_at DESC LIMIT $2`, [owner.id, MAX_QUESTIONS]);

  const all: Array<{ id: string; display_name: string; full_name: string | null; relation: string | null; aliases: string[] | null }> = await tx.query(
    `SELECT p.id, p.display_name, p.full_name, p.relation, array_remove(array_agg(a.alias ORDER BY a.created_at), NULL) AS aliases
     FROM persons p LEFT JOIN person_aliases a ON a.person_id = p.id
     WHERE p.owner_scope = $1 GROUP BY p.id ORDER BY p.created_at LIMIT 5000`, [owner.id]);
  const participants: Array<{ person_id: string }> = await tx.query(
    `SELECT DISTINCT cp.person_id FROM conversation_participants cp JOIN messages m ON m.conversation_id = cp.conversation_id
     WHERE m.id = ANY($1) AND cp.person_id IS NOT NULL`, [window.map((m) => m.id)]);
  const said = new Set(window.flatMap((m) => fold(m.content).split(/[^\p{L}\p{N}]+/u)).filter((w) => w.length >= 2));
  const named = (c: (typeof all)[number]) => [c.display_name, c.full_name ?? '', ...(c.aliases ?? [])]
    .some((n) => { const parts = fold(n).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2); return parts.length > 0 && parts.every((w) => said.has(w)); });
  const wanted = new Set<string>([...participants.map((p) => p.person_id), ...open.flatMap((q) => [...q.candidates, ...(q.contact_id ? [q.contact_id] : [])])]);
  const chosen = all.filter((c) => wanted.has(c.id) || named(c));
  for (const c of all) if (chosen.length < MAX_CONTACTS && factSubjects.includes(c.id) && !chosen.includes(c)) chosen.push(c);
  const list = chosen.slice(0, MAX_CONTACTS);

  const contacts = new Map<string, string>();
  const refOf = new Map<string, string>();
  const prompt: PromptContact[] = list.map((c, i) => {
    const ref = `C${i + 1}`;
    contacts.set(ref, c.id);
    refOf.set(c.id, ref);
    return { ref, name: c.display_name, fullName: c.full_name, relation: c.relation, aliases: c.aliases ?? [] };
  });
  const questions = new Map<string, { id: string; candidates: string[] }>();
  const lines = open.map((q, i) => {
    questions.set(`Q${i + 1}`, { id: q.id, candidates: q.candidates });
    const cands = q.candidates.map((id) => refOf.get(id)).filter(Boolean).join(', ');
    // "Same person?" (a new contact vs one known only by name): answered with the known one's C-number (yes) or its own (no).
    const newcomer = q.contact_id ? refOf.get(q.contact_id) : undefined;
    if (newcomer) return `Q${i + 1}: ${q.question} (about: ${newcomer} — the same person as ${cands}?; answer ${cands} if yes, ${newcomer} if not)`;
    const info = [q.about ? `about: "${q.about}"` : '', cands ? `candidates ${cands}` : ''].filter(Boolean).join('; ');
    return `Q${i + 1}: ${q.question}${info ? ` (${info})` : ''}`;
  });
  return { selfNames, list: prompt, contacts, refOf, questions, lines };
}
