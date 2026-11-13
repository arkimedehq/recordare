// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Learning from outside (WORK_PLAN 8.16 F1, D57; `docs/literature/learning-from-outside.md` §7): who or what brought a
 * fact or a note — an informant — and how far to trust it, decided by code from provenance, never from the wording.
 *
 * - The class gives a starting trust and a cap: a household member (the account's own speaker, or a person with a
 *   verified identity) > a contact named in conversation > the agent's own first-party tools > a site > someone unknown.
 * - Outcomes move it, per informant, like a child's selective trust: items later confirmed raise it, corrected lower it;
 *   a site never rises above its class's cap.
 * - Corroboration counts only independent origins: another informant, in another conversation. The same page read
 *   again, the same group repeating, or the agent's own summary of a tool count once.
 */
import { type EntityManager } from 'typeorm';
import { localDate } from './time';
import { accountSpeaker } from '../rawlog/attribution';

type Db = Pick<EntityManager, 'query'>;

export const INFORMANT_CLASSES = ['household', 'contact', 'own_tool', 'site', 'anonymous'] as const;
export type InformantClass = (typeof INFORMANT_CLASSES)[number];

/** Starting trust per class and the most it can reach (data, any language). */
const PRIOR: Record<InformantClass, number> = { household: 0.9, contact: 0.7, own_tool: 0.8, site: 0.5, anonymous: 0.3 };
const CAP: Record<InformantClass, number> = { household: 1, contact: 0.9, own_tool: 0.95, site: 0.6, anonymous: 0.4 };
/** How many outcomes the starting trust is worth: a few outcomes move it, one does not overturn it. */
const PRIOR_WEIGHT = 4;
/** At or above: what the informant teaches is kept at once; below: it waits, labelled with its source. */
export const TEACH_TRUST = 0.75;

export const trustOf = (cls: InformantClass, confirmed: number, corrected: number): number =>
  Math.min(CAP[cls], (PRIOR[cls] * PRIOR_WEIGHT + confirmed) / (PRIOR_WEIGHT + confirmed + corrected));

export interface Informant {
  kind: 'person' | 'tool' | 'site';
  key: string;
  personId: string | null;
  cls: InformantClass;
}

export interface EvidenceMessage {
  role: string;
  toolName: string | null;
  toolDerived?: boolean;
  accountSpeaker: boolean;
  authorPersonId: string | null;
  content: string;
  sentAt: Date;
}

/** The one host named in a tool's output (a page read, a single search result); null when none or several. */
export function singleHost(text: string): string | null {
  const hosts = new Set<string>();
  for (const m of text.matchAll(/https?:\/\/([^/\s"'<>)\]]+)/gi)) hosts.add((m[1] as string).toLowerCase().replace(/^www\./, '').replace(/:\d+$/, ''));
  return hosts.size === 1 ? [...hosts][0] as string : null;
}

/**
 * Who brought what these messages say: a tool or a site when a tool's output backs them (directly, or through the
 * agent's reply relaying it — `tools`: the window's tool messages), else the person who said it. Null for the agent's
 * own words (its replies are its own, not learned).
 */
export async function informantOf(db: Db, msgs: EvidenceMessage[], tools: EvidenceMessage[], ownTools: RegExp | null): Promise<Informant | null> {
  const direct = msgs.filter((m) => m.role === 'tool');
  const relayed = msgs.find((m) => m.toolDerived);
  const toolMsgs = direct.length ? direct : relayed ? tools.filter((t) => t.sentAt <= relayed.sentAt).slice(-1) : [];
  if (toolMsgs.length || relayed) {
    const name = (toolMsgs[0]?.toolName ?? 'tool').slice(0, 200);
    if (ownTools?.test(name)) return { kind: 'tool', key: name, personId: null, cls: 'own_tool' };
    const host = singleHost(toolMsgs.map((m) => m.content).join('\n'));
    return host ? { kind: 'site', key: host, personId: null, cls: 'site' } : { kind: 'tool', key: name, personId: null, cls: 'site' };
  }
  const said = msgs.find((m) => m.role === 'user' || m.role === 'other');
  if (!said) return null;
  if (said.accountSpeaker) return { kind: 'person', key: 'account', personId: null, cls: 'household' };
  if (!said.authorPersonId) return { kind: 'person', key: 'someone', personId: null, cls: 'anonymous' };
  const [v]: Array<{ verified: boolean }> = await db.query(
    `SELECT EXISTS (SELECT 1 FROM external_identities WHERE person_id = $1 AND verified_at IS NOT NULL) AS verified`, [said.authorPersonId]);
  return { kind: 'person', key: said.authorPersonId, personId: said.authorPersonId, cls: v?.verified ? 'household' : 'contact' };
}

/** The informant's row (created on first use) and its trust now. */
export async function upsertInformant(db: Db, memoryId: string, i: Informant): Promise<{ id: string; trust: number }> {
  const [row]: Array<{ id: string; class: InformantClass; confirmed: number; corrected: number }> = await db.query(
    `INSERT INTO informants (memory_id, kind, key, person_id, class) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (memory_id, kind, key) DO UPDATE SET class = EXCLUDED.class
     RETURNING id, class, confirmed, corrected`, [memoryId, i.kind, i.key, i.personId, i.cls]);
  return { id: (row as { id: string }).id, trust: trustOf(row!.class, row!.confirmed, row!.corrected) };
}

type Item = { table: 'facts' | 'notes' | 'procedures'; id: string };
const column = (t: Item['table']) => (t === 'facts' ? 'fact_id' : t === 'notes' ? 'note_id' : 'procedure_id');

/**
 * Records that `informant` backs the item, from this conversation. Returns whether it is an independent origin (no
 * earlier backing by the same informant or from the same conversation) and how many distinct informants back it now.
 */
export async function backItem(db: Db, memoryId: string, item: Item, informantId: string, conversationId: string | null, at: Date):
  Promise<{ independent: boolean; informants: number }> {
  const col = column(item.table);
  const [seenRow]: Array<{ seen: boolean }> = await db.query(
    `SELECT EXISTS (SELECT 1 FROM item_informants WHERE ${col} = $1 AND (informant_id = $2 OR conversation_id IS NOT DISTINCT FROM $3)) AS seen`,
    [item.id, informantId, conversationId]);
  await db.query(`INSERT INTO item_informants (memory_id, ${col}, informant_id, conversation_id, at) VALUES ($1, $2, $3, $4, $5)`,
    [memoryId, item.id, informantId, conversationId, at]);
  const [count]: Array<{ n: number }> = await db.query(`SELECT count(DISTINCT informant_id)::int AS n FROM item_informants WHERE ${col} = $1`, [item.id]);
  return { independent: !seenRow?.seen, informants: count?.n ?? 0 };
}

/** An outcome for the informants behind an item: it was confirmed, or it turned out wrong (`except`: who brought the outcome). */
export async function creditInformants(db: Db, item: Item, outcome: 'confirmed' | 'corrected', except?: string): Promise<void> {
  await db.query(
    `UPDATE informants SET ${outcome} = ${outcome} + 1
     WHERE id IN (SELECT DISTINCT informant_id FROM item_informants WHERE ${column(item.table)} = $1) AND id IS DISTINCT FROM $2`, [item.id, except ?? null]);
}

/** Who is speaking in a conversation now (its latest turn of a person), as evidence for `informantOf`; null without one. */
export async function speakerEvidence(db: Db, conversationId: string | null, now: Date, personal: boolean): Promise<EvidenceMessage | null> {
  if (!conversationId) return null;
  const [m]: Array<{ role: string; account_speaker: boolean; author_person_id: string | null; content: string; sent_at: Date }> = await db.query(
    `SELECT m.role, ${personal ? `m.author_kind IN ('self', 'own')` : accountSpeaker('m')} AS account_speaker, m.author_person_id, m.content, m.sent_at
     FROM messages m WHERE m.conversation_id = $1 AND m.role IN ('user', 'other') AND m.sent_at <= $2 ORDER BY m.sent_at DESC LIMIT 1`, [conversationId, now]);
  return m ? { role: m.role, toolName: null, accountSpeaker: m.account_speaker, authorPersonId: m.author_person_id, content: m.content, sentAt: m.sent_at } : null;
}

/** How long a learned note holds: perishable ones fade, slowly changing ones are rechecked, lasting ones stay. */
export function lastingOf(lasts: string | null | undefined, until: string | null | undefined, learnedAt: Date, timezone: string,
  knobs: { newsKeepDays: number; recheckDays: number }): { lasts: string | null; expiresAt: Date | null; recheckAt: Date | null } {
  const day = 86_400_000;
  if (lasts === 'perishable') {
    // Its own date when said ("tomorrow's strike": the end of that day, local), else a few days.
    const own = until && /^\d{4}-\d{2}-\d{2}$/.test(until) && until >= localDate(learnedAt, timezone)
      ? endOfLocalDay(until, timezone) : null;
    return { lasts, expiresAt: own ?? new Date(learnedAt.getTime() + knobs.newsKeepDays * day), recheckAt: null };
  }
  if (lasts === 'changing') return { lasts, expiresAt: null, recheckAt: new Date(learnedAt.getTime() + knobs.recheckDays * day) };
  return { lasts: lasts === 'lasting' ? lasts : null, expiresAt: null, recheckAt: null };
}

/** The instant a local day ends in a time zone (the next local midnight). */
function endOfLocalDay(day: string, timezone: string): Date {
  // Start from UTC midnight of the next day and step back by the zone's offset at that moment.
  const next = new Date(`${day}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit' }).formatToParts(next);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asLocal = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return new Date(next.getTime() - (asLocal - next.getTime()));
}

/**
 * Nightly (consolidation): learned notes past their time fade — deleted with their evidence and informant links, a
 * `forgotten` entry in the change feed. Returns how many.
 */
export async function fadeLearned(db: Db, memoryId: string, now: Date): Promise<number> {
  const gone: Array<{ id: string }> = await db.query(
    `WITH gone AS (DELETE FROM notes WHERE memory_id = $1 AND expires_at IS NOT NULL AND expires_at <= $2 RETURNING id) SELECT id FROM gone`, [memoryId, now]);
  for (const g of gone) await db.query(`INSERT INTO note_changes (memory_id, note_id, change) VALUES ($1, $2, 'forgotten')`, [memoryId, g.id]);
  return gone.length;
}

// ── 8.16 F3: initiatives from learned knowledge, the learning loop, child-like stages ──

/** How far a memory has grown (8.16 F3): young asks more and says what it read only as a question; grown asks less. */
export type LearningStage = 'young' | 'growing' | 'grown';

/**
 * The stage, worked out each time (nothing stored): how many items the memory holds as confirmed by the people here —
 * stated facts and notes (not its own conclusions, not its questions) and procedures no longer pending.
 */
export async function learningStage(db: Db, memoryId: string, knobs: { young: number; grown: number }): Promise<{ stage: LearningStage; known: number }> {
  const [r]: Array<{ n: number }> = await db.query(
    `SELECT (SELECT count(*) FROM facts WHERE memory_id = $1 AND status = 'current' AND deleted_at IS NULL AND NOT pending AND stance = 'stated')
       + (SELECT count(*) FROM notes WHERE memory_id = $1 AND status = 'current' AND deleted_at IS NULL AND NOT pending AND stance = 'stated'
           AND category <> 'question' AND origin NOT IN ('reflected', 'assistant_stated'))
       + (SELECT count(*) FROM procedures WHERE memory_id = $1 AND status = 'current' AND NOT pending) AS n`, [memoryId]);
  const known = Number(r?.n ?? 0);
  return { stage: known < knobs.young ? 'young' : known < knobs.grown ? 'growing' : 'grown', known };
}

/** An informant's trust now, without creating it (a new one: its class's starting trust). */
export async function informantTrust(db: Db, memoryId: string, i: Informant): Promise<number> {
  const [row]: Array<{ class: InformantClass; confirmed: number; corrected: number }> = await db.query(
    `SELECT class, confirmed, corrected FROM informants WHERE memory_id = $1 AND kind = $2 AND key = $3`, [memoryId, i.kind, i.key]);
  return row ? trustOf(row.class, row.confirmed, row.corrected) : trustOf(i.cls, 0, 0);
}

/**
 * Who brought an episode read in a tool's output (origin `learned`): the tool or site of its evidence — the tool's message
 * itself, or, for the agent's reply relaying it, the last tool output before that reply in the same conversation.
 */
export async function episodeInformant(db: Db, episodeId: string, ownTools: RegExp | null): Promise<Informant | null> {
  const msgs: Array<{ role: string; tool_name: string | null; content: string; sent_at: Date; conversation_id: string }> = await db.query(
    `SELECT m.role, m.tool_name, m.content, m.sent_at, m.conversation_id FROM episode_evidence v JOIN messages m ON m.id = v.message_id
     WHERE v.episode_id = $1 ORDER BY m.sent_at`, [episodeId]);
  let tools = msgs.filter((m) => m.role === 'tool');
  const relay = msgs.find((m) => m.role === 'assistant');
  if (!tools.length && relay) {
    tools = await db.query(`SELECT role, tool_name, content, sent_at, conversation_id FROM messages
      WHERE conversation_id = $1 AND role = 'tool' AND sent_at <= $2 ORDER BY sent_at DESC LIMIT 1`, [relay.conversation_id, relay.sent_at]);
  }
  if (!tools.length) return null;
  return informantOf(db, tools.map((t) => ({ role: 'tool', toolName: t.tool_name, accountSpeaker: false, authorPersonId: null, content: t.content, sentAt: t.sent_at })),
    [], ownTools);
}

/** Who backs a learned item first (its informant): the label it is said with, and the informant. */
export async function itemSource(db: Db, item: { table: 'notes' | 'procedures'; id: string }): Promise<{ key: string; kind: string } | null> {
  const [row]: Array<{ key: string; kind: string }> = await db.query(
    `SELECT i.key, i.kind FROM item_informants ii JOIN informants i ON i.id = ii.informant_id
     WHERE ii.${item.table === 'notes' ? 'note_id' : 'procedure_id'} = $1 AND i.kind <> 'person' ORDER BY ii.at LIMIT 1`, [item.id]);
  return row ?? null;
}

/**
 * Whom a learning question about the place goes to (8.16 F3): the household member the memory trusts most — a person with
 * a verified identity, or who speaks as the household, by their track record as an informant, then by how much they
 * talk —; none such
 * but the account's own speaker talks: anyone here (null); nobody: undefined.
 */
export async function householdAnswerer(db: Db, memoryId: string): Promise<string | null | undefined> {
  const [p]: Array<{ id: string }> = await db.query(
    `SELECT p.id FROM persons p
     WHERE p.memory_id = $1 AND p.id <> $1
       -- a household member: a verified identity, or someone who speaks as the household (the account's own turns)
       AND (EXISTS (SELECT 1 FROM external_identities x WHERE x.person_id = p.id AND x.verified_at IS NOT NULL)
         OR EXISTS (SELECT 1 FROM messages m WHERE m.memory_id = $1 AND m.author_person_id = p.id AND ${accountSpeaker('m')}))
       AND EXISTS (SELECT 1 FROM messages m WHERE m.memory_id = $1 AND m.author_person_id = p.id)
     ORDER BY COALESCE((SELECT (i.confirmed + 4 * 0.9) / (i.confirmed + i.corrected + 4) FROM informants i
                        WHERE i.memory_id = $1 AND i.kind = 'person' AND i.person_id = p.id), 0.9) DESC,
       (SELECT count(*) FROM messages m WHERE m.memory_id = $1 AND m.author_person_id = p.id) DESC, p.id
     LIMIT 1`, [memoryId]);
  if (p) return p.id;
  const [own] = await db.query(`SELECT 1 FROM messages m WHERE m.memory_id = $1 AND ${accountSpeaker('m')} LIMIT 1`, [memoryId]);
  return own ? null : undefined;
}
