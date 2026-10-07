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
import { type PromptContext, type PromptMessage } from './extraction.prompt';
import { type QualityProfile } from './quality-profile';

const MAX_OPEN_PLANS = 15;
const MAX_FACTS = 40;
const MAX_NOTES = 30;
/** Older episodes close in meaning to the window sit next to the recent ones (counts: quality profile):
 * under noise the recent ones crowd out the episode a correction refers to (M4b: "it was 210, not 180"
 * left the wrong value visible). */
const MIN_RELATED_SIMILARITY = 0.45;

export interface WindowMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'other';
  toolName: string | null;
  authorPersonId: string | null;
  authorName: string | null;
  content: string;
  sentAt: Date;
  /** An assistant reply given right after a memory recall in its turn (an echo of memories, not new information). */
  fromMemory?: boolean;
}

export interface Owner {
  id: string;
  locale: string;
  timezone: string;
}

export interface FactRef {
  id: string;
  key: string;
  validFrom: Date | null;
}

export interface ExtractionInput {
  prompt: PromptContext;
  /** message number (1-based) → messages[n - 1] */
  messages: WindowMessage[];
  plans: Map<string, string>;     // "P1" → episode id
  facts: Map<string, FactRef>;    // "F1" → fact
  notes: Map<string, string>;     // "N1" → note id
  episodes: Map<string, string>;  // "E1" → episode id
}

/** Recordare's own read tools, as a client names them (possibly prefixed, e.g. `recordare_search_episodes`). */
const MEMORY_TOOLS = '(^|[_.:-])(search_episodes|search_memory|search_facts|resolve_period)$';

/** Pending messages of a conversation, oldest first, split into windows of bounded size. */
export async function pendingWindows(tx: EntityManager, conversationId: string, maxChars: number): Promise<WindowMessage[][]> {
  const rows: Array<{ id: string; role: WindowMessage['role']; tool_name: string | null; author_person_id: string | null;
    author_name: string | null; content: string; sent_at: Date; from_memory: boolean }> = await tx.query(
    // Unverified group members are not persons: their name comes from the conversation's participants.
    // from_memory: an assistant reply whose turn (since the previous non-assistant, non-tool message) contains a
    // recall — one of Recordare's read tools called by the client (its tool message), or a recall Recordare served
    // in this conversation.
    `SELECT m.id, m.role, m.tool_name, m.author_person_id, COALESCE(p.display_name, cp.display_name) AS author_name, m.content, m.sent_at,
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
    const msg: WindowMessage = { id: r.id, role: r.role, toolName: r.tool_name, authorPersonId: r.author_person_id,
      authorName: r.author_name, content: r.content, sentAt: r.sent_at, ...(r.from_memory ? { fromMemory: true } : {}) };
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

function speaker(m: WindowMessage, ownerId: string): string {
  if (m.role === 'user' || m.authorPersonId === ownerId) return 'owner';
  if (m.role === 'assistant') return 'assistant';
  if (m.role === 'tool') return `tool${m.toolName ? `:${m.toolName}` : ''}`;
  return `other${m.authorName ? `:${m.authorName}` : ''}`;
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
  const facts: Array<{ id: string; key: string; value: string | null; valid_from: Date | null }> = await tx.query(
    `SELECT id, key, value, valid_from FROM facts
     WHERE owner_id = $1 AND subject_person_id IS NULL AND status IN ('current', 'unknown_current') AND deleted_at IS NULL
     ORDER BY recorded_at DESC LIMIT $2`, [owner.id, MAX_FACTS]);
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

  const messages: PromptMessage[] = window.map((m, i) => ({
    n: i + 1,
    speaker: speaker(m, owner.id),
    sentAt: `${describe(m.sentAt, 'day', tz, owner.locale)} ${clock.format(m.sentAt)}`,
    content: m.content,
  }));

  return {
    messages: window,
    plans: planMap,
    facts: factMap,
    notes: noteMap,
    episodes: episodeMap,
    prompt: {
      locale: owner.locale,
      messageDay,
      calendar: calendar(messageDay, 14, 21, owner.locale),
      openPlans: plans.map((p, i) => {
        planMap.set(`P${i + 1}`, p.id);
        const until = p.occurred_until ? ` → ${localDate(p.occurred_until, tz)}` : '';
        return `P${i + 1}: ${p.content} (planned ${when(p.occurred_at, p.date_precision)}${until})`;
      }),
      currentFacts: facts.map((f, i) => {
        factMap.set(`F${i + 1}`, { id: f.id, key: f.key, validFrom: f.valid_from });
        return `F${i + 1}: ${f.key} = ${f.value ?? '(unknown)'}${f.valid_from ? ` (since ${localDate(f.valid_from, tz)})` : ''}`;
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
