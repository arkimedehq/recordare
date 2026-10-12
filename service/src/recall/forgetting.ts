// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * What forgetting takes with it (D16, WORK_PLAN 5.5). When messages go (a message or a conversation deleted, a period
 * forgotten) or episodes are forgotten, what they alone supported goes too:
 * - an episode, a fact or a note left without evidence is deleted;
 * - a plan whose status came from a message that went gets back the status its remaining events give (open if none);
 *   the rescheduled copy such an event created goes with it;
 * - a fact or a note that replaced an older one hands its place back: the older one is current again (what made it
 *   outdated is gone). A correction does not: the item it corrected stays corrected (it was said to be wrong);
 * - the day and month digests built on the episodes that go are superseded, rewritten by the next consolidation.
 * A fact or a note keeps the evidence it has elsewhere: forgetting one episode does not take a fact drawn from the
 * same message (one message often tells several things).
 */
import { type EntityManager } from 'typeorm';

/** The rows that may lose their support: read before the deletion (cascades remove the links). */
export interface Support {
  episodes: string[];
  facts: string[];
  notes: string[];
  planEvents: string[];
}

export interface Dropped {
  episodes: string[];
  facts: number;
  notes: number;
}

/** What may lose its support when these messages and / or episodes go. */
export async function supportedBy(tx: EntityManager, memoryId: string, gone: { messageIds?: string[]; episodeIds?: string[] }): Promise<Support> {
  const messageIds = gone.messageIds ?? [];
  const ids = (rows: Array<{ id: string }>) => rows.map((r) => r.id);
  const episodes = ids(await tx.query(
    `SELECT DISTINCT e.id FROM episode_evidence ee JOIN episodes e ON e.id = ee.episode_id WHERE e.memory_id = $1 AND ee.message_id = ANY($2)`,
    [memoryId, messageIds]));
  const episodeIds = [...(gone.episodeIds ?? []), ...episodes];
  const items = async (table: 'facts' | 'notes') => ids(await tx.query(
    `SELECT DISTINCT t.id FROM ${table === 'facts' ? 'fact_evidence' : 'note_evidence'} x JOIN ${table} t ON t.id = x.${table === 'facts' ? 'fact_id' : 'note_id'}
     WHERE t.memory_id = $1 AND (x.message_id = ANY($2) OR x.episode_id = ANY($3))`,
    [memoryId, messageIds, episodeIds]));
  const planEvents = ids(await tx.query(
    `SELECT pe.id FROM plan_events pe JOIN episodes e ON e.id = pe.plan_id WHERE e.memory_id = $1 AND pe.evidence_message_id = ANY($2)`,
    [memoryId, messageIds]));
  return { episodes, facts: await items('facts'), notes: await items('notes'), planEvents };
}

/** Supersedes the day digests written from these episodes and the month digests written from those days. */
export async function supersedeDigests(tx: EntityManager, memoryId: string, episodeIds: string[]): Promise<void> {
  if (!episodeIds.length) return;
  await tx.query(
    `WITH days AS (SELECT DISTINCT digest_id FROM digest_sources WHERE episode_id = ANY($1)),
          months AS (SELECT DISTINCT s.digest_id FROM digest_sources s JOIN days d ON s.source_digest_id = d.digest_id)
     UPDATE digests SET superseded_at = now()
     WHERE memory_id = $2 AND superseded_at IS NULL AND id IN (SELECT digest_id FROM days UNION SELECT digest_id FROM months)`,
    [episodeIds, memoryId]);
}

/**
 * After the deletion: drops what lost all its support (see the header). `kept` = messages still stored that support
 * nothing any more (a period forgotten with its raw messages kept).
 */
export async function dropUnsupported(tx: EntityManager, memoryId: string, s: Support, kept: string[] = []): Promise<Dropped> {
  // Plan events whose evidence went: removed, with the rescheduled copies they created.
  const events: Array<{ plan_id: string; new_plan_id: string | null }> = s.planEvents.length ? await tx.query(
    `WITH d AS (DELETE FROM plan_events WHERE id = ANY($1) RETURNING plan_id, new_plan_id) SELECT plan_id, new_plan_id FROM d`,
    [s.planEvents]) : [];
  const copies = events.flatMap((e) => (e.new_plan_id ? [e.new_plan_id] : []));

  const bare: Array<{ id: string }> = await tx.query(
    `SELECT e.id FROM episodes e WHERE e.memory_id = $1 AND (e.id = ANY($3) OR (e.id = ANY($2) AND NOT EXISTS (
       SELECT 1 FROM episode_evidence ee WHERE ee.episode_id = e.id AND ee.message_id <> ALL($4))))`,
    [memoryId, s.episodes, copies, kept]);
  const episodes = bare.map((r) => r.id);
  const facts = new Set(s.facts);
  const notes = new Set(s.notes);
  if (episodes.length) {
    // Items backed by these episodes (a rescheduled copy was not among the candidates) may lose their support too.
    for (const r of await tx.query(`SELECT fact_id AS id FROM fact_evidence WHERE episode_id = ANY($1)`, [episodes])) facts.add(r.id);
    for (const r of await tx.query(`SELECT note_id AS id FROM note_evidence WHERE episode_id = ANY($1)`, [episodes])) notes.add(r.id);
    await supersedeDigests(tx, memoryId, episodes);
    await tx.query(`DELETE FROM episodes WHERE id = ANY($1) AND memory_id = $2`, [episodes, memoryId]);
  }

  // A plan gets the status its last remaining event gives, open when none is left.
  for (const planId of new Set(events.map((e) => e.plan_id))) {
    const [last]: Array<{ patch: string; new_plan_id: string | null; created_at: Date }> = await tx.query(
      `SELECT patch::text, new_plan_id, created_at FROM plan_events
       WHERE plan_id = $1 AND patch IN ('confirm', 'cancel', 'reschedule', 'amend') ORDER BY created_at DESC LIMIT 1`, [planId]);
    const status = !last ? 'open' : last.patch === 'confirm' ? 'confirmed' : last.patch === 'cancel' ? 'cancelled' : 'rescheduled';
    await tx.query(
      `UPDATE episodes SET plan_status = $1::plan_status, plan_status_at = COALESCE($2, recorded_at),
         confirmed_by = CASE WHEN $1::plan_status = 'confirmed' THEN confirmed_by END,
         rescheduled_to = CASE WHEN $1::plan_status = 'rescheduled' THEN $3::uuid END
       WHERE id = $4 AND memory_id = $5`,
      [status, last?.created_at ?? null, last?.new_plan_id ?? null, planId, memoryId]);
  }

  return { episodes, facts: await dropItems(tx, memoryId, 'facts', [...facts], kept), notes: await dropItems(tx, memoryId, 'notes', [...notes], kept) };
}

/** Deletes the facts / notes left without evidence; one that replaced an older one makes it current again. */
async function dropItems(tx: EntityManager, memoryId: string, table: 'facts' | 'notes', ids: string[], kept: string[]): Promise<number> {
  if (!ids.length) return 0;
  const evidence = table === 'facts' ? 'fact_evidence' : 'note_evidence';
  const owner = table === 'facts' ? 'fact_id' : 'note_id';
  const gone: Array<{ id: string; supersedes: string | null; live: boolean }> = await tx.query(
    `SELECT t.id, t.supersedes, t.status::text IN ('current', 'unknown_current') AS live FROM ${table} t
     WHERE t.id = ANY($1) AND t.memory_id = $2 AND NOT EXISTS (
       SELECT 1 FROM ${evidence} x WHERE x.${owner} = t.id AND (x.episode_id IS NOT NULL OR x.message_id <> ALL($3)))`,
    [ids, memoryId, kept]);
  if (!gone.length) return 0;
  await tx.query(`DELETE FROM ${table} WHERE id = ANY($1) AND memory_id = $2`, [gone.map((g) => g.id), memoryId]);
  if (table === 'notes') {
    for (const g of gone) await tx.query(`INSERT INTO note_changes (memory_id, note_id, change) VALUES ($1, $2, 'forgotten')`, [memoryId, g.id]);
  }
  const byId = new Map(gone.map((g) => [g.id, g]));
  for (const g of gone) {
    if (!g.live) continue;
    // The newest one still stored down the replacement chain (its successor went with this one).
    let older = g.supersedes;
    while (older && byId.has(older)) older = byId.get(older)!.supersedes;
    if (!older) continue;
    await tx.query(table === 'facts'
      ? `UPDATE facts SET status = CASE WHEN value IS NULL THEN 'unknown_current'::fact_status ELSE 'current'::fact_status END,
           valid_to = NULL, expired_at = NULL WHERE id = $1 AND memory_id = $2 AND status = 'superseded' AND deleted_at IS NULL`
      : `UPDATE notes SET status = 'current' WHERE id = $1 AND memory_id = $2 AND status = 'superseded' AND deleted_at IS NULL`,
      [older, memoryId]);
  }
  return gone.length;
}
