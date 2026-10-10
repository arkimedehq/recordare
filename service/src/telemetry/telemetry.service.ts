// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Live telemetry (M5b): what really happens inside Recordare, as it happens, for the operators' dashboard. Every
 * event mirrors one real step (a message stored, an LLM call, a memory written, a recall served, a digest written…);
 * nothing is synthesised. Metadata only — ids, kinds, counts, tokens — never message or memory content.
 * In-process (one service process runs API and workers); a multi-process deployment would relay through Redis.
 */
import { type BeforeApplicationShutdown, Injectable } from '@nestjs/common';
import { Subject, type Observable } from 'rxjs';

export type TelemetryEvent =
  | { type: 'message.ingested'; memoryId: string; conversationId: string; messages: number; roles: Record<string, number> }
  | { type: 'extraction.started'; memoryId: string; runId: string; conversationId: string; messages: number }
  | { type: 'extraction.finished'; memoryId: string; runId: string; status: 'done' | 'failed' | 'skipped'; written: number }
  | { type: 'llm.started'; memoryId: string | null; runId: string | null; promptId: string; task: string }
  | { type: 'llm.call'; memoryId: string | null; runId: string | null; promptId: string; model: string; inputTokens: number;
      cachedInputTokens: number; outputTokens: number; latencyMs: number; status: string }
  | { type: 'memory.written'; memoryId: string; runId: string | null; table: 'episodes' | 'facts' | 'notes'; id: string;
      kind?: string; authorRole?: string; importance?: number; corrects?: string | null }
  | { type: 'episode.linked'; memoryId: string; relation: 'duplicate' | 'corrects'; from: string; to: string }
  | { type: 'recall.served'; memoryId: string; tool: string; mode?: string; episodeIds: string[]; claimIds: string[];
      chats: number; digests: number; facts?: number; notes?: number }
  | { type: 'digest.written'; memoryId: string; level: 'day' | 'month'; period: string; sources: number }
  | { type: 'consolidation.finished'; memoryId: string; days: number; months: number; llmCalls: number; failed: number }
  | { type: 'episode.forgotten'; memoryId: string; ids: string[] }
  | { type: 'work.started'; memoryId: string | null; op: WorkOp; id: number }
  | { type: 'work.finished'; memoryId: string | null; op: WorkOp; id: number; ms: number };

/**
 * Work that takes time without an LLM call: embeddings of incoming messages, the context read before an extraction,
 * embeddings of new memories, a recall, a consolidation. Started / finished pairs let the dashboard show the wait.
 */
export type WorkOp = 'embed.messages' | 'context' | 'embed.memories' | 'recall' | 'consolidation';

/** Version of the event contract (docs/ATLAS_EVENTS.md): additive changes keep it, breaking ones raise it. */
export const ATLAS_EVENTS_VERSION = 2;

export type StampedEvent = TelemetryEvent & { v: number; at: string };

@Injectable()
export class TelemetryService implements BeforeApplicationShutdown {
  private readonly bus = new Subject<StampedEvent>();

  private workId = 0;

  emit(event: TelemetryEvent): void {
    this.bus.next({ ...event, v: ATLAS_EVENTS_VERSION, at: new Date().toISOString() });
  }

  /** Runs `fn` between a work.started and a work.finished event (also when it fails). */
  async track<T>(op: WorkOp, memoryId: string | null, fn: () => Promise<T>): Promise<T> {
    const id = ++this.workId, t0 = Date.now();
    this.emit({ type: 'work.started', memoryId, op, id });
    try {
      return await fn();
    } finally {
      this.emit({ type: 'work.finished', memoryId, op, id, ms: Date.now() - t0 });
    }
  }

  /**
   * Ends the open streams before the HTTP server closes: an SSE connection never ends by itself, so the server would
   * wait for it forever and the queue workers (closed after it) would keep running in a process that no longer
   * listens.
   */
  beforeApplicationShutdown(): void {
    this.bus.complete();
  }

  get events(): Observable<StampedEvent> {
    return this.bus.asObservable();
  }
}
