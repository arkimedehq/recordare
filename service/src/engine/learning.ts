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
