// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Perceptions (WORK_PLAN 8.12e, `docs/API.md` §4c): what the agent's senses noticed — a camera, a microphone, a sensor, a
 * photo — told in words by the client, which does the seeing and the describing. Recordare never receives an image, a
 * sound or a face, only the description and who was recognised in it.
 * - **No model.** The description already is the memory: one raw-log message (the day's `perception` conversation,
 *   marked extracted by a run without a model, so no extraction reads it again) and one episode of origin `perceived` —
 *   "I saw it", apart from "I was told" and "I thought it". No fact or note is drawn from it; what a person later says
 *   about it is their own memory, with its own evidence.
 * - **Who.** People recognised are resolved as in a presence impulse (a verified identity of this memory, the account's
 *   own user for the self); the episode is theirs when one person is recognised, the memory's own otherwise; everyone
 *   recognised is in its people and its audience. Unknown people are only in the words ("someone").
 * - **Once.** The same perception in the same place by the same sensor within `PERCEPTION_DEDUP_MINUTES` is one: the
 *   first is answered again.
 * - **It fades.** `expires_at` = seen + `keepDays` (the request's, else the memory's, else `PERCEPTION_KEEP_DAYS`; 0 =
 *   kept); `fadePerceptions` forgets the expired ones every night.
 * - **Private** as any message (D52): a private perception is told to the holder of a personal memory only, to nobody
 *   in an entity memory (the agent knows it).
 */
import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { DataSource, type EntityManager } from 'typeorm';
import { type Env } from '../config/env';
import { storeEmbeddings } from '../db/pgvector';
import { EMBEDDING_PORT, type EmbeddingPort } from '../embedding/embedding.port';
import { contact, SELF_SUBJECT } from '../engine/subjects';
import { localDate } from '../engine/time';
import { resolvePresent, type Identity, type Person } from '../initiative/presence.service';
import { dropUnsupported, supersedeDigests, supportedBy } from '../recall/forgetting';

export const PERCEPTION_SENSORS = ['camera', 'microphone', 'sensor', 'photo'] as const;
export type PerceptionSensor = (typeof PERCEPTION_SENSORS)[number];

/** The prompt version of the run that marks perception messages extracted (no model is called). */
export const PERCEPTION_RUN_VERSION = 'perception.v1';
/** A perception is the same as an earlier one when their words overlap this much (trigram similarity). */
const SAME_WORDS = 0.6;
const DAY_MS = 86_400_000;

export interface PerceptionInput {
  text: string;
  at?: string;
  place?: string;
  sensor: PerceptionSensor;
  people?: Array<{ identity: Identity; confidence: number }>;
  keepDays?: number;
  private?: boolean;
}

export interface PerceptionResult {
  episodeId: string;
  duplicate: boolean;
  people: Person[];
  expiresAt: string | null;
}

@Injectable()
export class PerceptionService {
  private readonly log = new Logger(PerceptionService.name);

  constructor(
    private readonly db: DataSource,
    private readonly config: ConfigService<Env, true>,
    @Inject(EMBEDDING_PORT) private readonly embeddings: EmbeddingPort,
  ) {}

  async perceive(memoryId: string, clientId: string | null, input: PerceptionInput, now: Date): Promise<PerceptionResult> {
    if (!clientId) throw new ForbiddenException(); // a perception belongs to a client's raw log, as ingest does
    const seen = input.at ? new Date(input.at) : now;
    const resolved = new Map<string, { person: Person; confidence: number }>();
    for (const p of input.people ?? []) {
      const person = await resolvePresent(this.db, memoryId, clientId, p.identity);
      if (person && (resolved.get(person.personId)?.confidence ?? -1) < p.confidence) resolved.set(person.personId, { person, confidence: p.confidence });
    }
    const people = [...resolved.values()];
    const result = await this.db.transaction(async (tx) => {
      const [memory]: Array<{ timezone: string; mode: string; keep: number | null }> = await tx.query(
        `SELECT timezone, mode, perception_keep_days AS keep FROM memories WHERE person_id = $1`, [memoryId]);
      const same = await this.sameAs(tx, memoryId, input, seen);
      if (same) return { ...same, people: people.map((p) => p.person), duplicate: true, text: null };

      const keep = input.keepDays ?? memory!.keep ?? this.config.get('PERCEPTION_KEEP_DAYS', { infer: true }) ?? 14;
      const expires = keep > 0 ? new Date(seen.getTime() + keep * DAY_MS) : null;
      const [conv]: Array<{ id: string }> = await tx.query(
        `INSERT INTO conversations (memory_id, client_id, external_id, source, channel, started_at, last_message_at)
         VALUES ($1, $2, $3, 'perception', 'perception', $4, $4)
         ON CONFLICT (client_id, memory_id, external_id) DO UPDATE SET
           started_at = LEAST(conversations.started_at, EXCLUDED.started_at), last_message_at = GREATEST(conversations.last_message_at, EXCLUDED.last_message_at)
         RETURNING id`,
        [memoryId, clientId, `perception-${localDate(seen, memory!.timezone)}`, seen]);
      const [run]: Array<{ id: string }> = await tx.query(
        `INSERT INTO extraction_runs (memory_id, conversation_id, kind, window_from, window_to, model, provider, prompt_version, status, finished_at)
         VALUES ($1, $2, 'extraction', $3, $3, 'perception', 'none', $4, 'done', now()) RETURNING id`,
        [memoryId, conv!.id, seen, PERCEPTION_RUN_VERSION]);
      const [msg]: Array<{ id: string }> = await tx.query(
        `INSERT INTO messages (conversation_id, memory_id, external_id, role, author_kind, attribution_method, attribution_confidence, content,
           content_hash, sent_at, private, private_owner_id, extracted_run_id)
         VALUES ($1, $2, $3, 'user', 'own', 'client_assertion', 1, $4, $5, $6, $7, NULL, $8) RETURNING id`,
        [conv!.id, memoryId, `perception-${seen.getTime()}-${Math.random().toString(36).slice(2, 8)}`, input.text,
          createHash('sha256').update(input.text).digest(), seen, !!input.private, run!.id]);
      // Whose: the one person recognised (the self, or a contact); several, or nobody: the memory's own experience.
      const only = people.length === 1 ? people[0]!.person.personId : null;
      const subject = only && only !== memoryId ? contact(only) : SELF_SUBJECT;
      const audience = [...new Set([memoryId, ...people.map((p) => p.person.personId)])];
      const confidence = people.length ? Math.min(...people.map((p) => p.confidence)) : 1;
      const [episode]: Array<{ id: string }> = await tx.query(
        `INSERT INTO episodes (memory_id, kind, content, occurred_at, date_precision, place, importance, keywords, tags, origin, author_role,
           stance, confidence, extraction_run_id, disclosure, audience, subject_kind, subject_person_id, subject_candidates)
         VALUES ($1, 'event', $2, $3, 'minute', $4, 4, $5, $6, 'perceived', 'holder', 'stated', $7, $8, 'holder', $9, $10, $11, '{}')
         RETURNING id`,
        [memoryId, input.text, seen, input.place ?? null, input.place ? [input.place] : [], ['perception', input.sensor], confidence, run!.id,
          audience, subject.kind, subject.personId]);
      await tx.query(`INSERT INTO episode_evidence (episode_id, message_id, evidence_kind) VALUES ($1, $2, 'message')`, [episode!.id, msg!.id]);
      for (const p of people) {
        if (p.person.personId === memoryId) continue;
        await tx.query(`INSERT INTO episode_people (episode_id, alias, person_id) VALUES ($1, $2, $3)`, [episode!.id, p.person.name, p.person.personId]);
      }
      await tx.query(
        `INSERT INTO perceptions (memory_id, message_id, episode_id, sensor, place, seen_at, expires_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [memoryId, msg!.id, episode!.id, input.sensor, input.place ?? null, seen, expires]);
      return { episodeId: episode!.id, expiresAt: expires?.toISOString() ?? null, people: people.map((p) => p.person), duplicate: false, text: input.text };
    });
    if (result.text) await this.embed(result.episodeId, [result.text, input.place].filter(Boolean).join(' | '));
    return { episodeId: result.episodeId, duplicate: result.duplicate, people: result.people, expiresAt: result.expiresAt };
  }

  /** The same perception noticed again a moment ago: same sensor and place, overlapping words, within the dedup window. */
  private async sameAs(tx: EntityManager, memoryId: string, input: PerceptionInput, seen: Date): Promise<{ episodeId: string; expiresAt: string | null } | null> {
    const minutes = this.config.get('PERCEPTION_DEDUP_MINUTES', { infer: true }) ?? 10;
    if (!minutes) return null;
    const [hit]: Array<{ episode_id: string; expires_at: Date | null }> = await tx.query(
      `SELECT p.episode_id, p.expires_at FROM perceptions p JOIN messages m ON m.id = p.message_id
       WHERE p.memory_id = $1 AND p.sensor = $2 AND p.place IS NOT DISTINCT FROM $3 AND p.episode_id IS NOT NULL
         AND p.seen_at BETWEEN $4::timestamptz - make_interval(mins => $5) AND $4::timestamptz + make_interval(mins => $5)
         AND similarity(m.content, $6) >= $7
       ORDER BY p.seen_at DESC LIMIT 1`, [memoryId, input.sensor, input.place ?? null, seen, minutes, input.text, SAME_WORDS]);
    return hit ? { episodeId: hit.episode_id, expiresAt: hit.expires_at?.toISOString() ?? null } : null;
  }

  private async embed(id: string, text: string): Promise<void> {
    try {
      const [vector] = await this.embeddings.embed([text], 'document', { priority: 'interactive' });
      await storeEmbeddings(this.db, 'episodes', this.embeddings.model, [{ id, vector, text }]);
    } catch (err) {
      // Best effort, as for every write: full-text search still finds it.
      this.log.debug(`perception embedding failed: ${(err as Error).name}`);
    }
  }
}

/**
 * The perceptions past their time fade (8.12e), no model: their messages and episodes go, with what only they supported
 * (`forgetting.ts`); the digests built on them are superseded and rewritten by the consolidation that follows. What a
 * person said about the event rests on their own words and stays; so do the agent's own conclusions drawn from it — a
 * recurring pattern or a thought (`reflected`), which the memory keeps once the perceptions behind it are gone.
 */
export async function fadePerceptions(db: DataSource, memoryId: string, now: Date): Promise<number> {
  return db.transaction(async (tx) => {
    const expired: Array<{ message_id: string; episode_id: string | null }> = await tx.query(
      `SELECT message_id, episode_id FROM perceptions WHERE memory_id = $1 AND expires_at IS NOT NULL AND expires_at <= $2 FOR UPDATE`, [memoryId, now]);
    if (!expired.length) return 0;
    const messageIds = expired.map((e) => e.message_id);
    const episodeIds = expired.flatMap((e) => (e.episode_id ? [e.episode_id] : []));
    const support = await supportedBy(tx, memoryId, { messageIds, episodeIds });
    const reflected: Array<{ id: string }> = support.notes.length
      ? await tx.query(`SELECT id FROM notes WHERE id = ANY($1) AND origin = 'reflected'`, [support.notes]) : [];
    const keep = new Set(reflected.map((r) => r.id));
    support.notes = support.notes.filter((id) => !keep.has(id));
    await supersedeDigests(tx, memoryId, episodeIds);
    await tx.query(`DELETE FROM episodes WHERE id = ANY($1) AND memory_id = $2`, [episodeIds, memoryId]);
    await tx.query(`DELETE FROM messages WHERE id = ANY($1) AND memory_id = $2`, [messageIds, memoryId]);
    await dropUnsupported(tx, memoryId, support);
    return expired.length;
  });
}
