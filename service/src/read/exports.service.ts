// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Full export of a memory (API.md §4, WORK_PLAN 4.7): everything it holds, as one JSON archive — the memory and its
 * settings, the people it knows, the raw log (conversations and messages, except those a forgotten period hides),
 * episodes with their evidence, people and plan events, the diary, facts, notes, learned sources with their text,
 * clarifications and the recurring patterns. Vectors are left out (they are derived). Built in the background and kept
 * gzipped for KEEP_DAYS; a build that did not finish within STALE_MINUTES (the service restarted) counts as failed.
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { promisify } from 'node:util';
import { gzip } from 'node:zlib';
import { DataSource } from 'typeorm';

const KEEP_DAYS = 7;
const STALE_MINUTES = 60;
/** Columns never exported: derived vectors and search indexes. */
const DERIVED = `- 'embedding' - 'embedding_model' - 'embedding_text' - 'tsv'`;

export interface ExportStatus { id: string; status: 'running' | 'done' | 'failed'; createdAt: string; finishedAt: string | null; bytes: number | null }

@Injectable()
export class ExportsService {
  private readonly log = new Logger(ExportsService.name);

  constructor(private readonly db: DataSource) {}

  /** Starts an export; the archive is built in the background. */
  async start(memoryId: string, clientId: string | null): Promise<ExportStatus> {
    await this.db.query(`DELETE FROM exports WHERE created_at < now() - make_interval(days => $1)`, [KEEP_DAYS]);
    const [row] = await this.db.query(`INSERT INTO exports (memory_id, client_id) VALUES ($1, $2) RETURNING id, status::text, created_at`,
      [memoryId, clientId]);
    void this.build(row.id, memoryId);
    return { id: row.id, status: 'running', createdAt: (row.created_at as Date).toISOString(), finishedAt: null, bytes: null };
  }

  async status(memoryId: string, id: string): Promise<ExportStatus> {
    await this.db.query(
      `UPDATE exports SET status = 'failed', error = 'interrupted', finished_at = now()
       WHERE id = $1 AND status = 'running' AND created_at < now() - make_interval(mins => $2)`, [id, STALE_MINUTES]);
    const [row] = await this.db.query(
      `SELECT id, status::text, created_at, finished_at, bytes FROM exports WHERE id = $1 AND memory_id = $2`, [id, memoryId]);
    if (!row) throw new NotFoundException();
    return { id: row.id, status: row.status, createdAt: (row.created_at as Date).toISOString(),
      finishedAt: row.finished_at ? (row.finished_at as Date).toISOString() : null, bytes: row.bytes };
  }

  /** The gzipped archive of a finished export (null while it is not done). */
  async archive(memoryId: string, id: string): Promise<Buffer | null> {
    const [row] = await this.db.query(`SELECT archive FROM exports WHERE id = $1 AND memory_id = $2 AND status = 'done'`, [id, memoryId]);
    return row ? (row.archive as Buffer) : null;
  }

  private async build(id: string, memoryId: string): Promise<void> {
    try {
      const data = await this.collect(memoryId);
      const archive = await promisify(gzip)(Buffer.from(JSON.stringify(data)));
      await this.db.query(`UPDATE exports SET status = 'done', archive = $2, bytes = $3, finished_at = now() WHERE id = $1`,
        [id, archive, archive.length]);
    } catch (err) {
      this.log.warn(`export ${id} failed: ${(err as Error).message}`);
      await this.db.query(`UPDATE exports SET status = 'failed', error = $2, finished_at = now() WHERE id = $1`, [id, (err as Error).name])
        .catch(() => undefined);
    }
  }

  /** The archive's content: one array of rows per table (column names as stored), scoped to the memory. */
  async collect(memoryId: string): Promise<Record<string, unknown>> {
    const rows = async (sql: string): Promise<unknown[]> =>
      (await this.db.query(`SELECT to_jsonb(t) ${DERIVED} AS r FROM (${sql}) t`, [memoryId])).map((x: { r: unknown }) => x.r);
    // Messages a forgotten period keeps but hides (keepRaw) stay out, as they do from every read.
    const hidden = `SELECT unnest(message_ids) FROM forget_tombstones WHERE memory_id = $1 AND scope = 'period'`;
    const episodes = `SELECT id FROM episodes WHERE memory_id = $1 AND deleted_at IS NULL`;
    return {
      format: 'recordare-export/1',
      exportedAt: new Date().toISOString(),
      memory: (await rows(`SELECT m.person_id AS id, p.display_name, m.mode, m.gender, m.locale, m.timezone, m.quality_profile, m.created_at
        FROM memories m JOIN persons p ON p.id = m.person_id WHERE m.person_id = $1`))[0] ?? null,
      persons: await rows(`SELECT * FROM persons WHERE memory_id = $1 OR id = $1 ORDER BY created_at`),
      personAliases: await rows(`SELECT * FROM person_aliases WHERE memory_id = $1 ORDER BY created_at`),
      conversations: await rows(`SELECT * FROM conversations WHERE memory_id = $1 AND deleted_at IS NULL ORDER BY started_at`),
      conversationParticipants: await rows(`SELECT cp.* FROM conversation_participants cp JOIN conversations c ON c.id = cp.conversation_id
        WHERE c.memory_id = $1 AND c.deleted_at IS NULL`),
      messages: await rows(`SELECT * FROM messages WHERE memory_id = $1 AND id NOT IN (${hidden}) ORDER BY sent_at`),
      episodes: await rows(`SELECT * FROM episodes WHERE memory_id = $1 AND deleted_at IS NULL ORDER BY occurred_at NULLS LAST, recorded_at`),
      episodeEvidence: await rows(`SELECT * FROM episode_evidence WHERE episode_id IN (${episodes})`),
      episodePeople: await rows(`SELECT * FROM episode_people WHERE episode_id IN (${episodes})`),
      planEvents: await rows(`SELECT * FROM plan_events WHERE plan_id IN (${episodes}) ORDER BY created_at`),
      digests: await rows(`SELECT * FROM digests WHERE memory_id = $1 AND superseded_at IS NULL ORDER BY period_start, level`),
      facts: await rows(`SELECT * FROM facts WHERE memory_id = $1 AND deleted_at IS NULL ORDER BY recorded_at`),
      factEvidence: await rows(`SELECT x.* FROM fact_evidence x JOIN facts f ON f.id = x.fact_id WHERE f.memory_id = $1`),
      notes: await rows(`SELECT * FROM notes WHERE memory_id = $1 AND deleted_at IS NULL ORDER BY recorded_at`),
      noteEvidence: await rows(`SELECT x.* FROM note_evidence x JOIN notes n ON n.id = x.note_id WHERE n.memory_id = $1`),
      patterns: await rows(`SELECT * FROM episode_promotions WHERE memory_id = $1 ORDER BY created_at`),
      sources: await rows(`SELECT * FROM sources WHERE memory_id = $1 ORDER BY learned_at`),
      sourcePassages: await rows(`SELECT * FROM source_passages WHERE memory_id = $1 ORDER BY source_id, ordinal`),
      clarifications: await rows(`SELECT * FROM clarifications WHERE memory_id = $1 ORDER BY created_at`),
    };
  }
}
