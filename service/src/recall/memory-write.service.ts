// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Explicit writes from tools (D11, D16, D34): log_episode, remember, correct_episode,
 * forget_episode. Explicit capture is "stated" with importance 10 only when evidence binds to a
 * message of the holder; otherwise it is recorded as noted by the assistant (poisoning guard).
 * Forgetting is physical and sticks (tombstones also hide the evidence from the chat search).
 * Manual entry from the host's UI (API.md §4, WORK_PLAN 4.7): `ev` null — the person wrote it themself, so it is stated,
 * with no message behind it.
 */
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DataSource, type EntityManager } from 'typeorm';
import { EMBEDDING_PORT, type EmbeddingPort } from '../embedding/embedding.port';
import { addDays, periodEnd, toStored, zonedMidnight, type Precision } from '../engine/time';
import { TelemetryService } from '../telemetry/telemetry.service';
import { memorySpeaker } from '../rawlog/attribution';
import { episodeSubject, SELF_SUBJECT, SOMEONE_SUBJECT } from '../engine/subjects';
import { dropUnsupported, supersedeDigests, supportedBy } from './forgetting';
import { storeEmbeddings } from '../db/pgvector';
import { episodeVisible, factVisible, noteVisible, PUBLIC_ONLY, readerOf } from './privacy';

type Table = 'episodes' | 'facts' | 'notes';

/**
 * A correction keeps the privacy of what it corrects (D52): when nothing behind the old row is public, the new row rests
 * on the same private messages (and not on the correcting one); null when the old row is public.
 */
async function privateEvidence(tx: EntityManager, table: Table, id: string): Promise<string[] | null> {
  const visible = table === 'episodes' ? episodeVisible('t', PUBLIC_ONLY) : table === 'facts' ? factVisible('t', PUBLIC_ONLY) : noteVisible('t', PUBLIC_ONLY);
  const [row]: Array<{ open: boolean }> = await tx.query(`SELECT ${visible} AS open FROM ${table} t WHERE t.id = $1`, [id]);
  if (!row || row.open) return null;
  const evidence = table === 'episodes'
    ? `SELECT message_id AS m FROM episode_evidence WHERE episode_id = $1`
    : `SELECT message_id AS m FROM ${table === 'facts' ? 'fact_evidence' : 'note_evidence'} WHERE ${table === 'facts' ? 'fact_id' : 'note_id'} = $1
         AND message_id IS NOT NULL
       UNION SELECT ee.message_id FROM ${table === 'facts' ? 'fact_evidence' : 'note_evidence'} x JOIN episode_evidence ee ON ee.episode_id = x.episode_id
         WHERE x.${table === 'facts' ? 'fact_id' : 'note_id'} = $1`;
  const rows: Array<{ m: string }> = await tx.query(`SELECT DISTINCT m FROM (${evidence}) s`, [id]);
  return rows.map((r) => r.m);
}

/**
 * The agent's text is backed by a message of the holder when the two overlap as a whole (trigram similarity ≥ 0.2) or
 * when the text is found inside the message (word similarity ≥ 0.6): a long message ("use the tools: … remember that
 * my favourite colour is green") dilutes the whole-text similarity of the short fact it contains.
 */
const OVERLAP = (col: string) => `(similarity(${col}, $3) >= 0.2 OR word_similarity($3, ${col}) >= 0.6)`;
const SCORE = (col: string) => `GREATEST(similarity(${col}, $3), word_similarity($3, ${col}))`;

/** The month after a YYYY-MM month, as YYYY-MM. */
function nextMonth(month: string): string {
  const [y = 0, m = 1] = month.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

export interface Evidence {
  /** Conversation the tool was called from (resolved by Recordare), if any. */
  conversationId?: string;
  clientId: string;
  /** A personal token (memory-direct): without a conversation, the holder's recent messages from this client count. */
  memoryDirect?: boolean;
}

@Injectable()
export class MemoryWriteService {
  constructor(
    private readonly db: DataSource,
    @Inject(EMBEDDING_PORT) private readonly embeddings: EmbeddingPort,
    private readonly telemetry: TelemetryService,
  ) {}

  async logEpisode(memoryId: string, ev: Evidence | null, input: {
    content: string; kind?: 'event' | 'plan'; occurredAt?: string; occurredUntil?: string; datePrecision?: Precision; people?: string[]; place?: string;
  }): Promise<string> {
    const id = await this.db.transaction(async (tx) => {
      const [memory] = await tx.query(`SELECT timezone, mode FROM memories WHERE person_id = $1`, [memoryId]);
      const { messageId, byHolder } = await this.bindEvidence(tx, memoryId, ev, input.content);
      const at = toStored(input.occurredAt, input.datePrecision, memory.timezone);
      const until = toStored(input.occurredUntil, 'day', memory.timezone);
      const kind = input.kind ?? 'event';
      // Whose it is (D50): the self's in a personal memory; in an entity memory the one known contact it names, else someone's.
      const { subject, people } = memory.mode === 'entity'
        ? await episodeSubject(tx, memoryId, input.people ?? []) : { subject: SELF_SUBJECT, people: new Map<string, string>() };
      const [row] = await tx.query(
        `INSERT INTO episodes (memory_id, kind, content, occurred_at, occurred_until, date_precision, place, importance, plan_status, plan_status_at,
           origin, author_role, stance, confidence, disclosure, audience, subject_kind, subject_person_id, subject_candidates)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'holder', $15, $16, $17, $18) RETURNING id`,
        [memoryId, kind, input.content, at.at, until.at, at.precision, input.place ?? null, byHolder ? 10 : 5,
          kind === 'plan' ? 'open' : null, kind === 'plan' ? new Date() : null,
          byHolder ? 'holder_lived' : 'assistant_stated', byHolder ? 'holder' : 'assistant',
          // "stated" only with the holder's own words behind it (API.md §3), as for notes.
          byHolder ? 'stated' : 'inferred', byHolder ? 1 : 0.6, [memoryId], subject.kind, subject.personId, subject.candidates]);
      if (messageId) {
        await tx.query(`INSERT INTO episode_evidence (episode_id, message_id, evidence_kind) VALUES ($1, $2, $3)`,
          [row.id, messageId, byHolder ? 'message' : 'agent_paraphrase']);
      }
      for (const p of input.people ?? []) {
        await tx.query(`INSERT INTO episode_people (episode_id, alias, person_id) VALUES ($1, $2, $3)`, [row.id, p, people.get(p) ?? null]);
      }
      return row.id as string;
    });
    await this.embed('episodes', id, input.content);
    return id;
  }

  async remember(memoryId: string, ev: Evidence | null, input: { content: string; category?: string }): Promise<string> {
    const id = await this.db.transaction(async (tx) => {
      const { messageId, byHolder } = await this.bindEvidence(tx, memoryId, ev, input.content);
      const [memory] = await tx.query(`SELECT mode FROM memories WHERE person_id = $1`, [memoryId]);
      const subject = memory.mode === 'entity' ? SOMEONE_SUBJECT : SELF_SUBJECT;
      const [row] = await tx.query(
        `INSERT INTO notes (memory_id, category, content, pending, origin, author_role, stance, confidence, disclosure, audience, subject_kind, subject_candidates)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'holder', $9, $10, $11) RETURNING id`,
        [memoryId, input.category ?? 'knowledge', input.content, !byHolder, byHolder ? 'holder_lived' : 'assistant_stated',
          byHolder ? 'holder' : 'assistant', byHolder ? 'stated' : 'inferred', byHolder ? 1 : 0.6, [memoryId], subject.kind, subject.candidates]);
      if (messageId) await tx.query(`INSERT INTO note_evidence (note_id, message_id) VALUES ($1, $2)`, [row.id, messageId]);
      await tx.query(`INSERT INTO note_changes (memory_id, note_id, change) VALUES ($1, $2, 'created')`, [memoryId, row.id]);
      return row.id as string;
    });
    await this.embed('notes', id, input.content);
    return id;
  }

  async correctEpisode(memoryId: string, ev: Evidence, input: { id: string; content?: string; occurredAt?: string; datePrecision?: Precision }): Promise<string> {
    const id = await this.db.transaction(async (tx) => {
      const reader = await readerOf(this.db, memoryId, ev.conversationId, new Date());
      const [old] = await tx.query(`SELECT * FROM episodes e WHERE id = $1 AND memory_id = $2 AND deleted_at IS NULL AND ${episodeVisible('e', reader)}`,
        [input.id, memoryId]);
      if (!old) throw new NotFoundException();
      const kept = await privateEvidence(tx, 'episodes', input.id);
      const [memory] = await tx.query(`SELECT timezone FROM memories WHERE person_id = $1`, [memoryId]);
      const { messageId } = await this.bindEvidence(tx, memoryId, ev, input.content ?? old.content);
      const at = input.occurredAt ? toStored(input.occurredAt, input.datePrecision, memory.timezone) : { at: old.occurred_at, precision: old.date_precision };
      const [row] = await tx.query(
        `INSERT INTO episodes (memory_id, kind, content, occurred_at, occurred_until, date_precision, place, importance, valence, feelings,
           opinion, keywords, context, tags, plan_status, plan_status_at, corrects, origin, author_role, stance, confidence, disclosure, audience,
           subject_kind, subject_person_id, subject_candidates)
         SELECT memory_id, kind, $3, $4, occurred_until, $5, place, importance, valence, feelings, opinion, keywords, context, tags,
           plan_status, plan_status_at, id, origin, author_role, stance, confidence, disclosure, audience,
           subject_kind, subject_person_id, subject_candidates
         FROM episodes WHERE id = $1 AND memory_id = $2 RETURNING id`,
        [input.id, memoryId, input.content ?? old.content, at.at, at.precision]);
      await tx.query(`UPDATE episodes SET invalidated_at = now() WHERE id = $1`, [input.id]);
      await tx.query(`INSERT INTO episode_people (episode_id, alias, person_id, role) SELECT $1, alias, person_id, role FROM episode_people WHERE episode_id = $2`, [row.id, input.id]);
      for (const m of kept ?? [messageId]) {
        await tx.query(`INSERT INTO episode_evidence (episode_id, message_id, evidence_kind) VALUES ($1, $2, 'message') ON CONFLICT DO NOTHING`, [row.id, m]);
      }
      return row.id as string;
    });
    const [row] = await this.db.query(`SELECT content FROM episodes WHERE id = $1`, [id]);
    await this.embed('episodes', id, row.content);
    return id;
  }

  /**
   * The person corrects a fact in the host's UI (WORK_PLAN 4.7): a new row of the same slot and subject that `corrects`
   * the old one (now `corrected`, history kept, D16) — stated by the person, no message behind it. `value` null: the
   * value is not known any more. 404 unless the fact is current.
   */
  async correctFact(memoryId: string, input: { id: string; value: string | null; validFrom?: string; datePrecision?: Precision }): Promise<string> {
    const { id, text } = await this.db.transaction(async (tx) => {
      const [old] = await tx.query(
        `SELECT f.*, (SELECT display_name FROM persons WHERE id = f.subject_person_id) AS about FROM facts f
         WHERE f.id = $1 AND f.memory_id = $2 AND f.deleted_at IS NULL AND f.status IN ('current', 'unknown_current')`, [input.id, memoryId]);
      if (!old) throw new NotFoundException();
      const [memory] = await tx.query(`SELECT timezone FROM memories WHERE person_id = $1`, [memoryId]);
      const from = input.validFrom ? toStored(input.validFrom, input.datePrecision, memory.timezone) : { at: old.valid_from, precision: old.date_precision };
      const kept = await privateEvidence(tx, 'facts', input.id);
      await tx.query(`UPDATE facts SET status = 'corrected', expired_at = now() WHERE id = $1`, [input.id]);
      const [row] = await tx.query(
        `INSERT INTO facts (memory_id, key, value, status, valid_from, date_precision, corrects, verdict, pending, origin, author_role, stance,
           confidence, disclosure, audience, subject_kind, subject_person_id, subject_candidates)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'corrects', false, 'holder_lived', 'holder', 'stated', 1, 'holder', $8, $9, $10, $11) RETURNING id`,
        [memoryId, old.key, input.value, input.value === null ? 'unknown_current' : 'current', from.at, from.precision, input.id,
          [memoryId], old.subject_kind, old.subject_person_id, old.subject_candidates]);
      for (const m of kept ?? []) await tx.query(`INSERT INTO fact_evidence (fact_id, message_id) VALUES ($1, $2)`, [row.id, m]);
      return { id: row.id as string, text: `${old.about ? `${old.about} — ` : ''}${old.key}: ${input.value ?? '(unknown)'}` };
    });
    await this.embed('facts', id, text);
    return id;
  }

  /** The person corrects a note in the host's UI: a new note that `corrects` the old one (now `corrected`). */
  async correctNote(memoryId: string, input: { id: string; content: string; category?: string }): Promise<string> {
    const id = await this.db.transaction(async (tx) => {
      const [old] = await tx.query(`SELECT * FROM notes WHERE id = $1 AND memory_id = $2 AND deleted_at IS NULL AND status = 'current'`, [input.id, memoryId]);
      if (!old) throw new NotFoundException();
      const kept = await privateEvidence(tx, 'notes', input.id);
      await tx.query(`UPDATE notes SET status = 'corrected' WHERE id = $1`, [input.id]);
      const [row] = await tx.query(
        `INSERT INTO notes (memory_id, category, content, pinned, corrects, pending, valid_from, origin, author_role, stance, confidence, disclosure,
           audience, subject_kind, subject_person_id, subject_candidates)
         VALUES ($1, $2, $3, $4, $5, false, $6, 'holder_lived', 'holder', 'stated', 1, 'holder', $7, $8, $9, $10) RETURNING id`,
        [memoryId, input.category ?? old.category, input.content, old.pinned, input.id, old.valid_from, [memoryId], old.subject_kind,
          old.subject_person_id, old.subject_candidates]);
      for (const m of kept ?? []) await tx.query(`INSERT INTO note_evidence (note_id, message_id) VALUES ($1, $2)`, [row.id, m]);
      await tx.query(`INSERT INTO note_changes (memory_id, note_id, change) VALUES ($1, $2, 'corrected')`, [memoryId, row.id]);
      return row.id as string;
    });
    await this.embed('notes', id, input.content);
    return id;
  }

  /**
   * Physical forgetting of an episode and its correction chain; never recreated (tombstone). From a conversation
   * (`asker`), only an episode its reader may be told of (D52); the host's UI may forget any, private ones included.
   */
  async forgetEpisode(memoryId: string, id: string, asker?: { conversationId?: string }): Promise<void> {
    let forgotten: string[] = [];
    if (asker) {
      const reader = await readerOf(this.db, memoryId, asker.conversationId, new Date());
      const [seen] = await this.db.query(`SELECT 1 FROM episodes e WHERE e.id = $1 AND e.memory_id = $2 AND ${episodeVisible('e', reader)}`, [id, memoryId]);
      if (!seen) throw new NotFoundException();
    }
    await this.db.transaction(async (tx) => {
      const chain = await this.chainOf(tx, memoryId, [id]);
      if (chain.length === 0) throw new NotFoundException();
      const ids = chain.map((c) => c.id);
      const msgs = await this.evidenceOf(tx, ids);
      await tx.query(
        `INSERT INTO forget_tombstones (memory_id, scope, episode_fingerprint, message_ids) VALUES ($1, 'episode', $2, $3)`,
        [memoryId, createHash('sha256').update(chain.map((c) => c.content).join('\n')).digest(), msgs]);
      // The facts and notes drawn from the same messages go too when nothing else supports them (5.5).
      const support = await supportedBy(tx, memoryId, { episodeIds: ids, claimMessageIds: msgs });
      // Digests written from these episodes are superseded now (no stale diary text); the next consolidation
      // rewrites the day / month from what is left (D16).
      await supersedeDigests(tx, memoryId, ids);
      await tx.query(`DELETE FROM episodes WHERE id = ANY($1) AND memory_id = $2`, [ids, memoryId]);
      forgotten = ids;
      await dropUnsupported(tx, memoryId, support, msgs);
    });
    this.telemetry.emit({ type: 'episode.forgotten', memoryId, ids: forgotten });
  }

  /**
   * Forgets a period (D16, WORK_PLAN 5.5): the episodes that took place in it (by overlap, as a period search) with
   * their correction chains, and the raw messages sent in it — deleted, or with `keepRaw` kept but hidden from the chat
   * search and never extracted again. What only they supported goes too (`forgetting.ts`), the period's digests are
   * superseded, and a `period` tombstone keeps a later extraction from writing an episode dated in it. `from` / `to`:
   * days (or months) in the memory's time zone, inclusive.
   */
  async forgetPeriod(memoryId: string, input: { from: string; to: string; keepRaw?: boolean }): Promise<{ episodes: number; messages: number; facts: number; notes: number }> {
    const [memory]: Array<{ timezone: string }> = await this.db.query(`SELECT timezone FROM memories WHERE person_id = $1`, [memoryId]);
    if (!memory) throw new NotFoundException();
    const fromDay = input.from.length === 7 ? `${input.from}-01` : input.from;
    const toDay = input.to.length === 7 ? addDays(`${nextMonth(input.to)}-01`, -1) : input.to;
    const from = zonedMidnight(fromDay, memory.timezone);
    const to = zonedMidnight(addDays(toDay, 1), memory.timezone); // exclusive
    let forgotten: string[] = [];
    const counts = { episodes: 0, messages: 0, facts: 0, notes: 0 };
    await this.db.transaction(async (tx) => {
      const dated: Array<{ id: string; occurred_at: Date; occurred_until: Date | null; date_precision: Precision }> = await tx.query(
        `SELECT id, occurred_at, occurred_until, date_precision FROM episodes WHERE memory_id = $1 AND occurred_at < $2`, [memoryId, to]);
      const inPeriod = dated.filter((e) => (e.occurred_until ? periodEnd(e.occurred_until, 'day', memory.timezone)
        : periodEnd(e.occurred_at, e.date_precision, memory.timezone)) > from).map((e) => e.id);
      const chain = inPeriod.length ? await this.chainOf(tx, memoryId, inPeriod) : [];
      const ids = chain.map((c) => c.id);
      const sent: string[] = (await tx.query(
        `SELECT id FROM messages WHERE memory_id = $1 AND sent_at >= $2 AND sent_at < $3`, [memoryId, from, to])).map((r: { id: string }) => r.id);
      const evidence = await this.evidenceOf(tx, ids);
      await tx.query(
        `INSERT INTO forget_tombstones (memory_id, scope, message_ids, period_from, period_to) VALUES ($1, 'period', $2, $3, $4)`,
        [memoryId, [...new Set([...evidence, ...(input.keepRaw ? sent : [])])], from, to]);
      const support = await supportedBy(tx, memoryId, { episodeIds: ids, messageIds: sent });
      await supersedeDigests(tx, memoryId, ids);
      await tx.query(
        `UPDATE digests SET superseded_at = now() WHERE memory_id = $1 AND superseded_at IS NULL AND period_start <= $3 AND period_end >= $2`,
        [memoryId, fromDay, toDay]);
      if (ids.length) await tx.query(`DELETE FROM episodes WHERE id = ANY($1) AND memory_id = $2`, [ids, memoryId]);
      if (!input.keepRaw && sent.length) await tx.query(`DELETE FROM messages WHERE id = ANY($1) AND memory_id = $2`, [sent, memoryId]);
      const dropped = await dropUnsupported(tx, memoryId, support, input.keepRaw ? sent : []);
      forgotten = [...ids, ...dropped.episodes];
      Object.assign(counts, { episodes: forgotten.length, messages: sent.length, facts: dropped.facts, notes: dropped.notes });
    });
    if (forgotten.length) this.telemetry.emit({ type: 'episode.forgotten', memoryId, ids: forgotten });
    return counts;
  }

  /**
   * Everything that tells the same memory as these episodes: corrections, hidden duplicates, the event of a confirmed
   * plan and rescheduled plans — otherwise a forgotten memory would resurface.
   */
  private chainOf(tx: EntityManager, memoryId: string, ids: string[]): Promise<Array<{ id: string; content: string }>> {
    return tx.query(
      `WITH RECURSIVE chain AS (
         SELECT id, content, corrects, duplicate_of, confirmed_by, rescheduled_to FROM episodes WHERE id = ANY($1) AND memory_id = $2
         UNION
         SELECT e.id, e.content, e.corrects, e.duplicate_of, e.confirmed_by, e.rescheduled_to FROM episodes e JOIN chain c
           ON e.id IN (c.corrects, c.duplicate_of, c.confirmed_by, c.rescheduled_to)
           OR c.id IN (e.corrects, e.duplicate_of, e.confirmed_by, e.rescheduled_to)
         WHERE e.memory_id = $2)
       SELECT id, content FROM chain`, [ids, memoryId]);
  }

  /** The messages behind these episodes; only real evidence is hidden from the chat search (agent paraphrases are tool messages). */
  private async evidenceOf(tx: EntityManager, ids: string[]): Promise<string[]> {
    if (!ids.length) return [];
    const rows: Array<{ message_id: string }> = await tx.query(
      `SELECT DISTINCT message_id FROM episode_evidence WHERE episode_id = ANY($1) AND evidence_kind = 'message'`, [ids]);
    return rows.map((m) => m.message_id);
  }

  /**
   * Evidence for an explicit write: the holder's latest message in the calling conversation when
   * there is one (stated by the holder); otherwise the tool call is stored in a per-client daily
   * `mcp_tool` conversation as the agent's paraphrase (role assistant: the extraction gate never
   * spends a call on it).
   */
  private async bindEvidence(tx: EntityManager, memoryId: string, ev: Evidence | null, text: string): Promise<{ messageId: string | null; byHolder: boolean }> {
    if (!ev) return { messageId: null, byHolder: true }; // written by the person in the host's UI
    if (ev.conversationId) {
      // Memory-stated only when a recent message of the holder actually says it (text overlap):
      // an agent cannot turn "ciao" into "the memory decided X" (poisoning guard).
      const [m] = await tx.query(
        `SELECT m.id FROM messages m
         WHERE m.conversation_id = $1 AND m.memory_id = $2 AND ${memorySpeaker('m')}
           AND m.received_at > now() - interval '30 minutes' AND ${OVERLAP('m.content')}
         ORDER BY ${SCORE('m.content')} DESC, m.sent_at DESC LIMIT 1`,
        [ev.conversationId, memoryId, text]);
      if (m) return { messageId: m.id, byHolder: true };
    } else if (ev.memoryDirect) {
      // A personal-token client (Claude Code, a connector) ingests the person's turns but cannot name the conversation
      // on MCP calls: the person's own recent words from the same client are the evidence, same overlap rule.
      const [m] = await tx.query(
        `SELECT m.id FROM messages m JOIN conversations c ON c.id = m.conversation_id
         WHERE c.client_id = $1 AND m.memory_id = $2 AND ${memorySpeaker('m')}
           AND m.received_at > now() - interval '30 minutes' AND ${OVERLAP('m.content')}
         ORDER BY ${SCORE('m.content')} DESC, m.sent_at DESC LIMIT 1`,
        [ev.clientId, memoryId, text]);
      if (m) return { messageId: m.id, byHolder: true };
    }
    const day = new Date().toISOString().slice(0, 10);
    const [conv] = await tx.query(
      `INSERT INTO conversations (memory_id, client_id, external_id, source, channel, started_at, last_message_at)
       VALUES ($1, $2, $3, 'mcp_tool', 'mcp', now(), now())
       ON CONFLICT (client_id, memory_id, external_id) DO UPDATE SET last_message_at = now() RETURNING id`,
      [memoryId, ev.clientId, `mcp-tool-${day}`]);
    const [msg] = await tx.query(
      `INSERT INTO messages (conversation_id, memory_id, external_id, role, author_kind, attribution_method, attribution_confidence, content, content_hash, sent_at)
       VALUES ($1, $2, $3, 'assistant', 'agent', 'client_assertion', 1, $4, $5, now()) RETURNING id`,
      [conv.id, memoryId, `tool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text, createHash('sha256').update(text).digest()]);
    return { messageId: msg.id, byHolder: false };
  }

  private async embed(table: 'episodes' | 'notes' | 'facts', id: string, text: string): Promise<void> {
    try {
      const [vector] = await this.embeddings.embed([text], 'document');
      await storeEmbeddings(this.db, table, this.embeddings.model, [{ id, vector, text }]);
    } catch {
      // Embedding is best-effort; full-text still finds the row.
    }
  }
}
