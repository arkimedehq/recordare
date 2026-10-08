// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * The engine's extraction job (D1 idle debounce → here). For each window of pending messages:
 * gate (no LLM call without a message from the owner — D5), one extraction call (D32), a
 * transactional write, then embeddings of the new rows. A failed call leaves the messages pending
 * (retried by the next idle job or the nightly sweep).
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EMBEDDING_PORT, type EmbeddingPort } from '../embedding/embedding.port';
import { LLM_PORT, type LlmPort } from '../llm/llm.port';
import { type ExtractionRunner } from '../queue/queue.port';
import { buildInput, pendingWindows, type Owner, type WindowMessage } from './extraction.context';
import { buildExtractionUser, ENTITY_PROMPT_VERSION, ENTITY_RULES, EXTRACTION_PROMPT_VERSION, EXTRACTION_SYSTEM } from './extraction.prompt';
import { extractionSchema } from './extraction.schema';
import { ConcurrentExtractionError, ExtractionWriter, type WrittenRow } from './extraction.writer';
import { resolveNearDuplicates } from './episode-resolver';
import { SEED_SLOTS } from '../db/migrations/1790960000000-Notes';
import { ConfigService } from '@nestjs/config';
import { type Env } from '../config/env';
import { qualityProfile, type QualityProfile, type QualityProfileName } from './quality-profile';
import { EPISODES_ONLY_NOTE, FACTS_PROMPT_VERSION, FACTS_SYSTEM, factsSchema } from './facts.prompt';
import { TelemetryService } from '../telemetry/telemetry.service';

@Injectable()
export class EngineExtractionRunner implements ExtractionRunner {
  private readonly log = new Logger(EngineExtractionRunner.name);
  private readonly defaultProfile: QualityProfileName;
  private readonly windowCharsOverride: number | undefined;
  private readonly factsPassOverride: QualityProfile['factsPass'] | undefined;

  constructor(
    private readonly db: DataSource,
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    @Inject(EMBEDDING_PORT) private readonly embeddings: EmbeddingPort,
    config: ConfigService<Env, true>,
    private readonly telemetry: TelemetryService,
  ) {
    this.defaultProfile = config.get('QUALITY_PROFILE', { infer: true });
    this.windowCharsOverride = config.get('EXTRACTION_WINDOW_CHARS', { infer: true });
    this.factsPassOverride = config.get('FACTS_PASS', { infer: true });
  }

  async runForConversation(conversationId: string): Promise<void> {
    const [conv] = await this.db.query(
      `SELECT c.owner_id, c.client_id, o.locale, o.timezone, o.episodic_enabled, o.quality_profile, p.kind, p.display_name
       FROM conversations c JOIN owners o ON o.person_id = c.owner_id JOIN persons p ON p.id = c.owner_id
       WHERE c.id = $1 AND c.deleted_at IS NULL`, [conversationId]);
    if (!conv?.episodic_enabled) return;
    const owner: Owner = { id: conv.owner_id, name: conv.display_name, locale: conv.locale, timezone: conv.timezone, entity: conv.kind === 'entity' };
    const profile = qualityProfile(conv.quality_profile, this.defaultProfile, this.windowCharsOverride, this.factsPassOverride);

    // One extraction per conversation at a time (session advisory lock); a concurrent job leaves
    // the work to the run in progress, whose follow-up job picks up anything that arrived meanwhile.
    const runner = this.db.createQueryRunner();
    await runner.connect();
    try {
      const [{ locked }] = await runner.query(`SELECT pg_try_advisory_lock(hashtextextended($1, 7)) AS locked`, [conversationId]);
      if (!locked) return;
      try {
        const windows = await pendingWindows(this.db.manager, conversationId, profile.windowChars);
        for (const window of windows) {
          await this.runWindow(owner, profile, conv.client_id as string, conversationId, window);
        }
      } finally {
        await runner.query(`SELECT pg_advisory_unlock(hashtextextended($1, 7))`, [conversationId]);
      }
    } finally {
      await runner.release();
    }
  }

  private async runWindow(owner: Owner, profile: QualityProfile, clientId: string, conversationId: string, window: WindowMessage[]): Promise<void> {
    const runId = await this.startRun(owner, conversationId, window);
    if (!window.some((m) => m.role === 'user' || m.authorPersonId === owner.id)) {
      // Gate: nothing the owner said → no LLM call (D5).
      await this.db.transaction(async (tx) => {
        await tx.query(`UPDATE messages SET extracted_run_id = $1 WHERE id = ANY($2)`, [runId, window.map((m) => m.id)]);
        await tx.query(`UPDATE extraction_runs SET status = 'done', finished_at = now(), model = 'gate:no-owner-message' WHERE id = $1`, [runId]);
      });
      return;
    }
    this.telemetry.emit({ type: 'extraction.started', ownerId: owner.id, runId, conversationId, messages: window.length });
    try {
      // Only the seeded slots and this owner's own keys: slot names never leak across owners
      // and the list stays bounded.
      const slots: Array<{ key: string }> = await this.db.query(
        `SELECT key FROM fact_slots WHERE key = ANY($2)
         UNION SELECT DISTINCT key FROM facts WHERE owner_id = $1 ORDER BY key`, [owner.id, SEED_SLOTS]);
      const input = await this.telemetry.track('context', owner.id, async () =>
        buildInput(this.db.manager, owner, window, slots.map((s) => s.key), await this.windowVector(window), profile));
      const ctx = { ownerId: owner.id, clientId, runId };
      const user = buildExtractionUser(input.prompt);
      const separate = profile.factsPass === 'separate';
      // With a separate facts pass the two calls run side by side on their own task models; one writer
      // transaction applies both (same numbered lists, so references stay valid).
      const [episodesOut, factsOut] = await Promise.all([
        this.llm.completeJson({
          promptId: promptVersion(EXTRACTION_PROMPT_VERSION, owner),
          system: EXTRACTION_SYSTEM + (owner.entity ? ENTITY_RULES : ''),
          user: separate ? `${user}\n\n${EPISODES_ONLY_NOTE}` : user,
          schema: extractionSchema,
          maxTokens: 6000,
          task: profile.extractionTask,
          reasoning: profile.reasoning,
        }, ctx),
        separate
          ? this.llm.completeJson({ promptId: promptVersion(FACTS_PROMPT_VERSION, owner), system: FACTS_SYSTEM + (owner.entity ? ENTITY_RULES : ''), user, schema: factsSchema, maxTokens: 4000, task: 'facts', reasoning: profile.reasoning }, ctx)
          : Promise.resolve(null),
      ]);
      const output = factsOut ? { ...episodesOut, facts: factsOut.facts, notes: factsOut.notes } : episodesOut;
      const written = await this.db.transaction(async (tx) => {
        const rows = await new ExtractionWriter(tx, { ownerId: owner.id, timezone: owner.timezone, runId, conversationId, entity: !!owner.entity,
          ...(owner.entity || !owner.name ? {} : { ownerName: owner.name }) }, input).apply(output);
        await tx.query(`UPDATE extraction_runs SET status = 'done', finished_at = now() WHERE id = $1`, [runId]);
        return rows;
      });
      await this.telemetry.track('embed.memories', owner.id, () => this.embed(written));
      await this.announce(owner.id, runId, written);
      // Second call only when near-duplicates exist (corrections not linked, same event in two chats).
      const links = await resolveNearDuplicates(this.db, this.llm, owner.id, written.filter((w) => w.table === 'episodes').map((w) => w.id),
        { ownerId: owner.id, clientId, runId }, profile).catch((err: unknown) => {
        this.log.warn(`near-duplicate resolution skipped: ${(err as Error).name}`);
        return [];
      });
      for (const l of links) this.telemetry.emit({ type: 'episode.linked', ownerId: owner.id, ...l });
      this.telemetry.emit({ type: 'extraction.finished', ownerId: owner.id, runId, status: 'done', written: written.length });
    } catch (err) {
      if (err instanceof ConcurrentExtractionError) {
        await this.db.query(`UPDATE extraction_runs SET status = 'done', finished_at = now(), model = 'skipped:concurrent' WHERE id = $1`, [runId]);
        this.telemetry.emit({ type: 'extraction.finished', ownerId: owner.id, runId, status: 'skipped', written: 0 });
        return;
      }
      this.telemetry.emit({ type: 'extraction.finished', ownerId: owner.id, runId, status: 'failed', written: 0 });
      // No user content in the error column (docs/DATA_MODEL.md).
      await this.db.query(`UPDATE extraction_runs SET status = 'failed', finished_at = now(), error = $1 WHERE id = $2`,
        [(err as Error).name, runId]);
      this.log.warn(`extraction failed for conversation ${conversationId}: ${(err as Error).name}`);
      throw err;
    }
  }

  private async startRun(owner: Owner, conversationId: string, window: WindowMessage[]): Promise<string> {
    const [run] = await this.db.query(
      `INSERT INTO extraction_runs (owner_id, conversation_id, kind, window_from, window_to, model, provider, prompt_version)
       VALUES ($1, $2, 'extraction', $3, $4, 'pending', 'configured', $5) RETURNING id`,
      [owner.id, conversationId, window[0]?.sentAt, window[window.length - 1]?.sentAt, promptVersion(EXTRACTION_PROMPT_VERSION, owner)]);
    return run.id as string;
  }

  /** Telemetry for the rows a window wrote: kind and author of episodes (metadata only). */
  private async announce(ownerId: string, runId: string, written: WrittenRow[]): Promise<void> {
    const episodeIds = written.filter((w) => w.table === 'episodes').map((w) => w.id);
    const meta: Array<{ id: string; kind: string; author_role: string; importance: number; corrects: string | null }> = episodeIds.length
      ? await this.db.query(`SELECT id, kind, author_role, importance, corrects FROM episodes WHERE id = ANY($1)`, [episodeIds]) : [];
    const byId = new Map(meta.map((m) => [m.id, m]));
    for (const w of written) {
      const m = byId.get(w.id);
      this.telemetry.emit({ type: 'memory.written', ownerId, runId, table: w.table, id: w.id,
        ...(m ? { kind: m.kind, authorRole: m.author_role, importance: m.importance, corrects: m.corrects } : {}) });
    }
  }

  /** The window's topic as one query vector: picks related older episodes for the E# list. Null on failure. */
  private async windowVector(window: WindowMessage[]): Promise<number[] | null> {
    try {
      const text = window.filter((m) => m.role !== 'assistant').map((m) => m.content).join('\n').slice(0, 4000);
      const [v] = text ? await this.embeddings.embed([text], 'query') : [];
      return v ?? null;
    } catch (err) {
      this.log.warn(`window embedding failed, recent episodes only: ${(err as Error).message}`);
      return null;
    }
  }

  /** Embeds new rows (content + retrieval keys). Failures leave embedding null (full-text still works). */
  private async embed(rows: WrittenRow[]): Promise<void> {
    if (rows.length === 0) return;
    try {
      const vectors = await this.embeddings.embed(rows.map((r) => r.text), 'document');
      for (const [i, r] of rows.entries()) {
        const sql = r.table === 'episodes'
          ? `UPDATE episodes SET embedding = $1::vector, embedding_model = $2, embedding_text = $3 WHERE id = $4`
          : r.table === 'facts'
            ? `UPDATE facts SET embedding = $1::vector, embedding_model = $2, embedding_text = $3 WHERE id = $4`
            : `UPDATE notes SET embedding = $1::vector, embedding_model = $2, embedding_text = $3 WHERE id = $4`;
        await this.db.query(sql, [`[${(vectors[i] ?? []).join(',')}]`, this.embeddings.model, r.text, r.id]);
      }
    } catch (err) {
      this.log.warn(`embedding new memories failed: ${(err as Error).message}`);
    }
  }
}

/** The prompt version as recorded and traced: entity memories add their rules' version (rule 9 compares these). */
const promptVersion = (base: string, owner: Owner): string => owner.entity ? `${base}+${ENTITY_PROMPT_VERSION}` : base;
