// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Procedures kept whole (WORK_PLAN 8.16 F2, D57; `docs/literature/learning-from-outside.md` implication 16): a multi-step
 * task with its steps in order, where it was learned and who brought it, the household's own way of a step, and how each
 * run went — returned whole, never as fragments. Recordare says what to do, in which order, with the household's
 * preferences and from whom it was learned; turning steps into motion is the client's work.
 *
 * Decided in code, never by the wording (as F1): read in a page → origin `learned`, pending until a trusted person
 * confirms it, a second independent source agrees or a run succeeds; taught by who is speaking → kept at once when the
 * speaker is trusted to teach (a household member), pending otherwise. Steps are kept as taught (never optimised): a
 * new version replaces the old one, except that a version still pending never replaces a confirmed one (both are kept,
 * the confirmed first). A run that fails marks its step; a person's correction becomes their variant and costs the
 * procedure's other informants trust; a run done confirms a pending procedure and credits who brought it.
 */
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { EMBEDDING_PORT, type EmbeddingPort } from '../embedding/embedding.port';
import { storeEmbeddings, vectorParam } from '../db/pgvector';
import { backItem, creditInformants, type Informant, informantOf, singleHost, speakerEvidence, TEACH_TRUST, upsertInformant } from '../engine/learning';
import { localDate } from '../engine/time';
import { toOrTsQuery } from '../rawlog/rawlog-search.service';
import { type LearnProcedureRequest, type ProcedureRunRequest, type ProcedureVariantRequest } from './procedures.schemas';

type Db = Pick<EntityManager, 'query'>;

/** Vector similarity for `search_knowledge` to return a procedure (as passages, the recall tools' floor). */
const MIN_SEARCH_SIMILARITY = 0.35;

export interface ProcedureView {
  id: string;
  title: string;
  when: string | null;
  steps: Array<{
    n: number; text: string;
    /** The household's own way of this step, shown above it. */
    here: Array<{ text: string; by: string; at: string; confirmed: boolean }>;
    /** The latest run that failed here (not fixed by a variant since). */
    failed?: { at: string; note: string | null };
  }>;
  /** The household's own way of the whole task. */
  here: Array<{ text: string; by: string; at: string; confirmed: boolean }>;
  /** read: in a page or a source; taught: by a person. */
  learned: { how: 'read' | 'taught'; from: string; at: string; confirmed: boolean; source?: { id: string; title: string } };
  /** unreported: looked up in a conversation (search_knowledge) that closed with no report at all. */
  runs: { done: number; failed: number; stopped: number; corrected: number; unreported: number; last?: { outcome: string; at: string; step: number | null } };
}

interface Who { conversationId: string | null; personal: boolean }

/** A run told again within this window (same procedure, outcome, step, conversation) is the same run. */
const RUN_REPEAT_MS = 10 * 60_000;
/** A run still going (one step done) takes the next report of its conversation within this pause: one run over many turns. */
const RUN_SPAN_MS = 3 * 3_600_000;

/** What an agent with the memory tools is asked wherever a procedure reaches it: the line under its head, search_knowledge. */
export const REPORT_ASK = 'carrying it out (whole, one step, or left halfway)? end your turn with report_procedure_run: this id, the outcome, the step reached (none once it is all done)';

/**
 * A procedure in progress in a conversation (8.16 F2): opened (or touched) when the memory context of that conversation
 * carries it or search_knowledge returns it; the next turns repeat a compact line until a report ends the run, the
 * conversation ends, or it is unused for RUN_SPAN_MS. `via` search wins over context (the agent looked it up).
 */
export async function openProcedureSessions(db: DataSource | EntityManager, memoryId: string, conversationId: string, procedureIds: string[], via: 'context' | 'search', now: Date): Promise<void> {
  for (const id of procedureIds) {
    const [open]: Array<{ id: string }> = await db.query(
      `UPDATE procedure_sessions SET touched_at = GREATEST(touched_at, $3::timestamptz), via = CASE WHEN $4::text = 'search' THEN 'search' ELSE via END
       WHERE id = (SELECT id FROM procedure_sessions WHERE conversation_id = $1 AND procedure_id = $2 AND closed_at IS NULL
         AND touched_at > $3::timestamptz - make_interval(secs => $5) ORDER BY touched_at DESC LIMIT 1) RETURNING id`,
      [conversationId, id, now, via, RUN_SPAN_MS / 1000]).then((r) => rowsOf<{ id: string }>(r));
    // A run that just ended here is not reopened by the context alone (the message still about it: "basta con gli
    // scacchi"); looking it up again is.
    const [ended]: Array<{ id: string }> = open || via === 'search' ? [] : await db.query(
      `SELECT id FROM procedure_sessions WHERE conversation_id = $1 AND procedure_id = $2 AND closed_at > $3::timestamptz - make_interval(secs => $4) LIMIT 1`,
      [conversationId, id, now, RUN_SPAN_MS / 1000]);
    if (!open && !ended) {
      await db.query(
        `INSERT INTO procedure_sessions (procedure_id, memory_id, conversation_id, via, opened_at, touched_at) VALUES ($1, $2, $3, $4, $5, $5)`,
        [id, memoryId, conversationId, via, now]);
    }
  }
}

/** The procedures in progress in a conversation (open, used within RUN_SPAN_MS), as compact memory-context lines. */
export async function procedureInProgressLines(db: DataSource | EntityManager, conversationId: string, except: string[], now: Date): Promise<string[]> {
  const rows: Array<{ id: string; title: string; reported: boolean; last_step: number | null }> = await db.query(
    `SELECT DISTINCT ON (s.procedure_id) p.id, p.title, s.reported, s.last_step FROM procedure_sessions s JOIN procedures p ON p.id = s.procedure_id
     WHERE s.conversation_id = $1 AND s.closed_at IS NULL AND s.touched_at > $2::timestamptz - make_interval(secs => $3) AND s.touched_at <= $2::timestamptz
       AND p.status = 'current' AND NOT (s.procedure_id = ANY($4::uuid[]))
     ORDER BY s.procedure_id, s.touched_at DESC`, [conversationId, now, RUN_SPAN_MS / 1000, except]);
  return rows.map((r) => inProgressLine({ id: r.id, title: r.title, reported: r.reported, lastStep: r.last_step }));
}

/** The compact line of a procedure in progress (no steps: they came in an earlier turn or from search_knowledge). */
export function inProgressLine(p: { id: string; title: string; reported: boolean; lastStep: number | null }): string {
  return `- procedure in progress "${p.title}" [id: ${p.id}] (${p.reported ? `last reported: ${p.lastStep ? `step ${p.lastStep}` : 'done'}` : 'not reported yet'})`
    + ' — if you are carrying it out: when it moves on, ends or stops, end your turn with report_procedure_run (this id, the outcome, the step reached; none once it is all done)';
}

/** TypeORM returns [rows, count] for UPDATE … RETURNING. */
const rowsOf = <T>(r: T[] | [T[], number]): T[] => (Array.isArray(r[0]) ? r[0] as T[] : r as T[]);

@Injectable()
export class ProceduresService {
  constructor(private readonly db: DataSource, @Inject(EMBEDDING_PORT) private readonly embeddings: EmbeddingPort) {}

  /** The procedures looked up or recalled in a conversation are in progress there (see openProcedureSessions). */
  async openSessions(memoryId: string, conversationId: string, ids: string[], via: 'context' | 'search', now: Date): Promise<void> {
    await openProcedureSessions(this.db, memoryId, conversationId, ids, via, now);
  }

  /** Keeps a procedure (or a new version, or confirms the same one from another informant). */
  async learn(memoryId: string, who: Who, req: LearnProcedureRequest, now: Date): Promise<{ id: string; pending: boolean; status: 'new' | 'version' | 'same' }> {
    const out = await this.db.transaction(async (tx) => {
      const source = req.sourceId ? await this.source(tx, memoryId, req.sourceId) : null;
      const informant = req.from === 'page'
        ? page(req.uri ?? source?.origin_uri ?? null)
        : await this.speaker(tx, who, now);
      const i = await upsertInformant(tx, memoryId, informant);
      return keepProcedure(tx, memoryId, i, who.conversationId, { ...req, uri: req.uri ?? source?.origin_uri ?? null, sourceId: source?.id ?? null }, now);
    });
    if (out.status !== 'same') await this.embed(out.id, [req.title, req.when].filter(Boolean).join('\n'));
    return out;
  }

  /** The household's own way of a step (or of the whole task), from who is speaking. */
  async variant(memoryId: string, procedureId: string, who: Who, req: ProcedureVariantRequest, now: Date): Promise<{ id: string; pending: boolean }> {
    return this.db.transaction(async (tx) => {
      const p = await this.current(tx, memoryId, procedureId);
      if (req.step && req.step > p.steps.length) throw new BadRequestException(`step ${req.step}: the procedure has ${p.steps.length} steps`);
      return this.addVariant(tx, memoryId, procedureId, who, req.step ?? null, req.text, now);
    });
  }

  /**
   * How a run went: done whole confirms a pending procedure; failed marks its step; stopped (left halfway) only counts;
   * corrected becomes the corrector's variant.
   */
  async run(memoryId: string, procedureId: string, who: Who, req: ProcedureRunRequest, now: Date): Promise<{ id: string; pending: boolean }> {
    return this.db.transaction(async (tx) => {
      const p = await this.current(tx, memoryId, procedureId);
      if (req.step && req.step > p.steps.length) throw new BadRequestException(`step ${req.step}: the procedure has ${p.steps.length} steps`);
      // The same outcome told twice — by the agent and by the host's code, or a retry — counts once: same procedure,
      // outcome, step and conversation (none matches none) within RUN_REPEAT_MS; a correction only with the same words.
      const [seen]: Array<{ id: string }> = await tx.query(
        `SELECT id FROM procedure_runs WHERE procedure_id = $1 AND outcome = $2::text AND step IS NOT DISTINCT FROM $3::int
           AND conversation_id IS NOT DISTINCT FROM $4::uuid AND ($2::text <> 'corrected' OR note IS NOT DISTINCT FROM $5::text)
           AND at > $6::timestamptz - make_interval(secs => $7) AND at <= $6::timestamptz + make_interval(secs => $7)
         ORDER BY at DESC LIMIT 1`,
        [procedureId, req.outcome, req.step ?? null, who.conversationId, req.note ?? null, now, RUN_REPEAT_MS / 1000]);
      if (seen) return { id: seen.id, pending: p.pending };
      // A task carried out over several turns is one run: in a conversation, a run still going (only some steps done so
      // far) takes the next report within RUN_SPAN_MS — the step reached, or how it ended (done whole, failed, stopped).
      // A correction is the person's teaching, not a run: kept apart.
      const [open]: Array<{ id: string }> = req.outcome === 'corrected' || !who.conversationId ? [] : await tx.query(
        `SELECT id FROM procedure_runs WHERE procedure_id = $1 AND conversation_id = $2::uuid AND outcome = 'done' AND step IS NOT NULL
           AND at > $3::timestamptz - make_interval(secs => $4) AND at <= $3::timestamptz ORDER BY at DESC LIMIT 1`,
        [procedureId, who.conversationId, now, RUN_SPAN_MS / 1000]);
      if (open) {
        await tx.query(
          `UPDATE procedure_runs SET outcome = $2::text, step = CASE WHEN $2::text = 'done' AND $3::int IS NOT NULL THEN GREATEST(step, $3::int) ELSE $3::int END,
             note = COALESCE($4, note), at = $5 WHERE id = $1`, [open.id, req.outcome, req.step ?? null, req.note ?? null, now]);
      }
      const id: string = open ? open.id : (await tx.query(
        `INSERT INTO procedure_runs (procedure_id, memory_id, outcome, step, note, conversation_id, at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [procedureId, memoryId, req.outcome, req.step ?? null, req.note ?? null, who.conversationId, now]))[0].id;
      // The procedure in progress in this conversation: reported (the step reached); a run that ended closes it.
      if (who.conversationId && req.outcome !== 'corrected') {
        const ended = req.outcome !== 'done' || !req.step;
        await tx.query(
          `UPDATE procedure_sessions SET reported = true, last_step = $3, touched_at = GREATEST(touched_at, $4::timestamptz),
             closed_at = CASE WHEN $5::boolean THEN $4::timestamptz END, closed = CASE WHEN $5::boolean THEN 'reported' END
           WHERE conversation_id = $1 AND procedure_id = $2 AND closed_at IS NULL`,
          [who.conversationId, procedureId, req.step ?? null, now, ended]);
      }
      let pending = p.pending;
      // Only a whole run confirms what was read: one step done (a check of it, say) is that step's news, not the task's.
      if (req.outcome === 'done' && !req.step && p.pending) {
        await confirmProcedure(tx, procedureId, now);
        pending = false;
      }
      if (req.outcome === 'corrected') {
        const v = await this.addVariant(tx, memoryId, procedureId, who, req.step ?? null, req.note as string, now);
        const [vi]: Array<{ informant_id: string | null }> = await tx.query(`SELECT informant_id FROM procedure_variants WHERE id = $1`, [v.id]);
        await creditInformants(tx, { table: 'procedures', id: procedureId }, 'corrected', vi?.informant_id ?? undefined);
      }
      return { id, pending };
    });
  }

  async list(memoryId: string): Promise<ProcedureView[]> {
    const rows: Array<{ id: string }> = await this.db.query(
      `SELECT id FROM procedures WHERE memory_id = $1 AND status = 'current' ORDER BY lower(title), pending`, [memoryId]);
    return this.views(memoryId, rows.map((r) => r.id));
  }

  async get(memoryId: string, id: string): Promise<ProcedureView> {
    const [v] = await this.views(memoryId, [id], true);
    if (!v) throw new NotFoundException('no such procedure');
    return v;
  }

  /** Forgets a procedure with its versions, variants and runs. */
  async forget(memoryId: string, id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const ids: Array<{ id: string }> = await tx.query(
        `WITH RECURSIVE chain AS (SELECT id FROM procedures WHERE id = $1 AND memory_id = $2
           UNION SELECT p.id FROM procedures p JOIN chain c ON p.replaced_by = c.id) SELECT id FROM chain`, [id, memoryId]);
      if (!ids.length) throw new NotFoundException('no such procedure');
      await tx.query(`DELETE FROM procedures WHERE id = ANY($1)`, [ids.map((r) => r.id)]);
    });
  }

  /** The procedures about a query, whole (`search_knowledge`): vector and words on the title and when it is used. */
  async search(memoryId: string, query: string, limit: number): Promise<ProcedureView[]> {
    const scored = new Map<string, number>();
    const tsq = toOrTsQuery(query);
    if (tsq) {
      const text: Array<{ id: string }> = await this.db.query(
        `SELECT id FROM procedures WHERE memory_id = $1 AND status = 'current'
           AND to_tsvector('simple', title || ' ' || COALESCE(situation, '')) @@ to_tsquery('simple', $2) LIMIT 20`, [memoryId, tsq]);
      text.forEach((r) => scored.set(r.id, 0.4));
    }
    try {
      const [q] = await this.embeddings.embed([query], 'query', { priority: 'interactive' });
      if (q) {
        const vec: Array<{ id: string; sim: number }> = await this.db.query(
          `SELECT id, 1 - (embedding <=> $2::vector) AS sim FROM procedures WHERE memory_id = $1 AND status = 'current' AND embedding IS NOT NULL
           ORDER BY embedding <=> $2::vector LIMIT 20`, [memoryId, vectorParam(q)]);
        for (const r of vec) if (r.sim >= MIN_SEARCH_SIMILARITY) scored.set(r.id, Math.max(scored.get(r.id) ?? 0, r.sim));
      }
    } catch {
      // Words still find it.
    }
    const top = [...scored.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
    return this.views(memoryId, top);
  }

  /** Whole views of procedures, in the order given (`any`: replaced versions too). */
  async views(memoryId: string, ids: string[], any = false): Promise<ProcedureView[]> {
    if (!ids.length) return [];
    return procedureViews(this.db, memoryId, ids, any);
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private async addVariant(tx: Db, memoryId: string, procedureId: string, who: Who, step: number | null, text: string, now: Date): Promise<{ id: string; pending: boolean }> {
    const i = await upsertInformant(tx, memoryId, await this.speaker(tx, who, now));
    return addProcedureVariant(tx, memoryId, procedureId, i, who.conversationId, step, text, now);
  }

  private async speaker(tx: Db, who: Who, now: Date): Promise<Informant> {
    const said = await speakerEvidence(tx, who.conversationId, now, who.personal);
    return (said && await informantOf(tx, [said], [], null)) ?? { kind: 'person', key: 'someone', personId: null, cls: 'anonymous' };
  }

  private async current(tx: Db, memoryId: string, id: string): Promise<{ pending: boolean; steps: string[] }> {
    const [p] = await tx.query(`SELECT pending, steps FROM procedures WHERE id = $1 AND memory_id = $2 AND status = 'current'`, [id, memoryId]);
    if (!p) throw new NotFoundException('no such procedure (or a replaced version: use the current one)');
    return p;
  }

  private async source(tx: Db, memoryId: string, id: string): Promise<{ id: string; origin_uri: string | null }> {
    const [s] = await tx.query(`SELECT id, origin_uri FROM sources WHERE id = $1 AND memory_id = $2`, [id, memoryId]);
    if (!s) throw new NotFoundException('no such source');
    return s;
  }

  private async embed(id: string, text: string): Promise<void> {
    try {
      const [vector] = await this.embeddings.embed([text], 'document', { priority: 'interactive' });
      await storeEmbeddings(this.db, 'procedures', this.embeddings.model, [{ id, vector, text }]);
    } catch {
      // Best-effort: words still find it.
    }
  }
}

export interface KeepProcedure {
  title: string; when?: string | null; steps: string[]; from: 'page' | 'person';
  uri?: string | null; sourceId?: string | null;
  /** The extraction run that proposed it (F2b). */
  runId?: string | null;
  /** Pending whatever the informant's trust (heard in the room, F2b). */
  pending?: boolean;
}

/**
 * Keeps a procedure from an informant already resolved (`upsertInformant`): the same title with the same steps is one
 * more backing (a confirmation only from an independent origin that is trusted or the second one); other steps are a new
 * version that replaces the old one and takes its household variants — unless it is pending and the old one is not.
 * Shared by the routes, the MCP tool and the extraction (F2b). Embedding is the caller's.
 */
export async function keepProcedure(tx: Db, memoryId: string, i: { id: string; trust: number }, conversationId: string | null, req: KeepProcedure,
  now: Date): Promise<{ id: string; pending: boolean; status: 'new' | 'version' | 'same' }> {
  const trusted = i.trust >= TEACH_TRUST && !req.pending;
  const steps = req.steps.map((s) => s.replace(/\s+/g, ' ').trim());
  const [same]: Array<{ id: string; pending: boolean; steps: string[] }> = await tx.query(
    `SELECT id, pending, steps FROM procedures WHERE memory_id = $1 AND status = 'current' AND lower(title) = lower($2)
     ORDER BY pending, learned_at DESC`, [memoryId, req.title]);
  if (same && JSON.stringify(same.steps) === JSON.stringify(steps)) {
    const b = await backItem(tx, memoryId, { table: 'procedures', id: same.id }, i.id, conversationId, now);
    if (same.pending && b.independent && (trusted || b.informants >= 2)) await confirmProcedure(tx, same.id, now);
    const [p] = await tx.query(`SELECT pending FROM procedures WHERE id = $1`, [same.id]);
    return { id: same.id, pending: p.pending as boolean, status: 'same' };
  }
  const pending = !trusted;
  const [{ id }] = await tx.query(
    `INSERT INTO procedures (memory_id, title, situation, steps, source_id, origin_uri, origin, pending, conversation_id, extraction_run_id, learned_at, confirmed_at)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
    [memoryId, req.title, req.when ?? null, JSON.stringify(steps), req.sourceId ?? null, req.uri ?? null,
      req.from === 'page' ? 'learned' : 'holder_told', pending, conversationId, req.runId ?? null, now, pending ? null : now]);
  await backItem(tx, memoryId, { table: 'procedures', id }, i.id, conversationId, now);
  if (same && (!pending || same.pending)) {
    await tx.query(`UPDATE procedures SET status = 'replaced', replaced_by = $2 WHERE id = $1`, [same.id, id]);
    await tx.query(`UPDATE procedure_variants SET procedure_id = $2 WHERE procedure_id = $1 AND retired_at IS NULL`, [same.id, id]);
  }
  return { id: id as string, pending, status: same ? 'version' : 'new' };
}

/** The household's own way of a step (null: the whole task) from an informant; the same informant's earlier way of it retires. */
export async function addProcedureVariant(tx: Db, memoryId: string, procedureId: string, i: { id: string; trust: number }, conversationId: string | null,
  step: number | null, text: string, now: Date, forcePending = false): Promise<{ id: string; pending: boolean }> {
  const pending = i.trust < TEACH_TRUST || forcePending;
  await tx.query(`UPDATE procedure_variants SET retired_at = $4 WHERE procedure_id = $1 AND step IS NOT DISTINCT FROM $2 AND informant_id = $3 AND retired_at IS NULL`,
    [procedureId, step, i.id, now]);
  const [{ id }] = await tx.query(
    `INSERT INTO procedure_variants (procedure_id, memory_id, step, text, informant_id, pending, conversation_id, at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [procedureId, memoryId, step, text.replace(/\s+/g, ' ').trim(), i.id, pending, conversationId, now]);
  return { id: id as string, pending };
}

async function confirmProcedure(tx: Db, id: string, now: Date): Promise<void> {
  await tx.query(`UPDATE procedures SET pending = false, confirmed_at = $2 WHERE id = $1`, [id, now]);
  await creditInformants(tx, { table: 'procedures', id }, 'confirmed');
}

/** A page's informant: its site, or "a page" when no single site is named. */
function page(uri: string | null): Informant {
  const host = uri ? singleHost(uri.includes('://') ? uri : `https://${uri}`) : null;
  return host ? { kind: 'site', key: host, personId: null, cls: 'site' } : { kind: 'tool', key: 'page', personId: null, cls: 'site' };
}

/** Whole views of procedures (also the memory context's), in the order of `ids`. */
export async function procedureViews(db: Db, memoryId: string, ids: string[], any = false): Promise<ProcedureView[]> {
  const [m]: Array<{ timezone: string }> = await db.query(`SELECT timezone FROM memories WHERE person_id = $1`, [memoryId]);
  const tz = m?.timezone ?? 'UTC';
  const day = (d: Date) => localDate(d, tz);
  const rows: Array<{ id: string; title: string; situation: string | null; steps: string[]; origin: string; pending: boolean; learned_at: Date;
    source_id: string | null; source_title: string | null }> = await db.query(
    `SELECT p.id, p.title, p.situation, p.steps, p.origin::text AS origin, p.pending, p.learned_at, p.source_id, s.title AS source_title
     FROM procedures p LEFT JOIN sources s ON s.id = p.source_id
     WHERE p.id = ANY($1) AND p.memory_id = $2 ${any ? '' : `AND p.status = 'current'`}`, [ids, memoryId]);
  const from: Array<{ procedure_id: string; name: string }> = await db.query(
    `SELECT DISTINCT ON (ii.procedure_id) ii.procedure_id, ${informantName('i')} AS name
     FROM item_informants ii JOIN informants i ON i.id = ii.informant_id LEFT JOIN persons pp ON pp.id = i.person_id
     WHERE ii.procedure_id = ANY($1) ORDER BY ii.procedure_id, ii.at`, [ids]);
  const variants: Array<{ procedure_id: string; step: number | null; text: string; pending: boolean; at: Date; name: string }> = await db.query(
    `SELECT v.procedure_id, v.step, v.text, v.pending, v.at, ${informantName('i')} AS name
     FROM procedure_variants v LEFT JOIN informants i ON i.id = v.informant_id LEFT JOIN persons pp ON pp.id = i.person_id
     WHERE v.procedure_id = ANY($1) AND v.retired_at IS NULL ORDER BY v.at`, [ids]);
  const runs: Array<{ procedure_id: string; outcome: string; step: number | null; note: string | null; at: Date }> = await db.query(
    `SELECT procedure_id, outcome, step, note, at FROM procedure_runs WHERE procedure_id = ANY($1) ORDER BY at`, [ids]);
  const unreported: Array<{ procedure_id: string; n: number }> = await db.query(
    `SELECT procedure_id, count(*)::int AS n FROM procedure_sessions WHERE procedure_id = ANY($1) AND via = 'search' AND NOT reported
       AND (closed_at IS NOT NULL OR touched_at < now() - make_interval(secs => $2)) GROUP BY procedure_id`, [ids, RUN_SPAN_MS / 1000]);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.flatMap((id) => {
    const r = byId.get(id);
    if (!r) return [];
    const vs = variants.filter((v) => v.procedure_id === id);
    const rs = runs.filter((x) => x.procedure_id === id);
    const here = (step: number | null) => vs.filter((v) => v.step === step).map((v) => ({ text: v.text, by: v.name, at: day(v.at), confirmed: !v.pending }));
    const last = rs.at(-1);
    return [{
      id, title: r.title, when: r.situation,
      steps: r.steps.map((text, k) => {
        const n = k + 1;
        // A failure at this step counts until a variant of it is taught after it.
        const fail = rs.filter((x) => x.outcome === 'failed' && x.step === n).at(-1);
        const fixed = fail && vs.some((v) => v.step === n && v.at > fail.at);
        return { n, text, here: here(n), ...(fail && !fixed ? { failed: { at: day(fail.at), note: fail.note } } : {}) };
      }),
      here: here(null),
      learned: { how: r.origin === 'learned' ? 'read' as const : 'taught' as const, from: from.find((f) => f.procedure_id === id)?.name ?? '?',
        at: day(r.learned_at), confirmed: !r.pending, ...(r.source_id && r.source_title ? { source: { id: r.source_id, title: r.source_title } } : {}) },
      runs: { done: rs.filter((x) => x.outcome === 'done').length, failed: rs.filter((x) => x.outcome === 'failed').length,
        stopped: rs.filter((x) => x.outcome === 'stopped').length, unreported: unreported.find((u) => u.procedure_id === id)?.n ?? 0, corrected: rs.filter((x) => x.outcome === 'corrected').length, ...(last ? { last: { outcome: last.outcome, at: day(last.at), step: last.step } } : {}) },
    } satisfies ProcedureView];
  });
}

/** SQL: an informant's name for people to read — a person's name, the household, someone, or the site / tool. */
const informantName = (i: string) =>
  `CASE WHEN ${i}.kind = 'person' AND ${i}.key = 'account' THEN 'the household' WHEN ${i}.kind = 'person' AND ${i}.key = 'someone' THEN 'someone'
        WHEN ${i}.kind = 'person' THEN COALESCE(pp.display_name, 'someone') WHEN ${i}.kind IS NULL THEN 'someone' ELSE ${i}.key END`;

/**
 * A procedure as lines of the memory context: whole, the household's way above each generic step, where it failed, and
 * whether it is confirmed; within `budget` characters, cut only between steps (the rest: search_knowledge). `tools`: the
 * agent has the memory tools — its head then asks for the run's report (report_procedure_run).
 */
export function procedureLines(p: ProcedureView, budget: number, tools = true): string[] {
  const how = p.learned.how === 'read'
    ? `read on ${p.learned.at} from ${p.learned.source ? `«${p.learned.source.title}», ` : ''}${p.learned.from}${p.learned.confirmed ? '' : '; not confirmed'}`
    : `taught by ${p.learned.from} on ${p.learned.at}${p.learned.confirmed ? '' : '; not confirmed'}`;
  const runs = p.runs.done || p.runs.failed || p.runs.stopped
    ? `; runs: ${p.runs.done} done, ${p.runs.failed} failed${p.runs.stopped ? `, ${p.runs.stopped} stopped` : ''}` : '';
  const here = (h: ProcedureView['here']) => h.map((v) => `here (${v.by}${v.confirmed ? '' : ', not confirmed'}): ${v.text}`);
  // The id rides on the head, which is never cut: an agent reports a run (report_procedure_run) with no search first.
  const head = `- procedure "${p.title}" [id: ${p.id}]${p.when ? ` (when: ${p.when})` : ''} (${how}${runs}) — the household's way first, steps as taught:`;
  // Where the agent decides, never cut: carrying it out ends with telling the memory how it went (with the tools only).
  const report = `  ${REPORT_ASK}`;
  const lines = [head, ...(tools ? [report] : []), ...here(p.here).map((t) => `    ${t}`)];
  let size = lines.join('\n').length;
  const more = (k: number) => `  … ${p.steps.length - k} more steps${tools ? `: search_knowledge "${p.title}"` : ''}`;
  for (const [k, s] of p.steps.entries()) {
    const block = [...here(s.here).map((t) => `  ${s.n}. ${t}`), `  ${s.n}. ${s.here.length ? '(generic) ' : ''}${s.text}`,
      ...(s.failed ? [`     failed here on ${s.failed.at}${s.failed.note ? `: ${s.failed.note}` : ''}`] : [])];
    const add = block.join('\n').length + 1;
    // Room is kept for the line that points to the rest, so the whole stays within the budget.
    const tail = k + 1 < p.steps.length ? more(k + 1).length + 1 : 0;
    if (size + add + tail > budget) {
      lines.push(more(k));
      break;
    }
    lines.push(...block);
    size += add;
  }
  return lines;
}
