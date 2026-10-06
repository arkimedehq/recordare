// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Live telemetry (M5b): what really happens inside Recordare, as it happens, for the operators' dashboard. Every
 * event mirrors one real step (a message stored, an LLM call, a memory written, a recall served, a digest written…);
 * nothing is synthesised. Metadata only — ids, kinds, counts, tokens — never message or memory content.
 * In-process (one service process runs API and workers); a multi-process deployment would relay through Redis.
 */
import { Injectable } from '@nestjs/common';
import { Subject, type Observable } from 'rxjs';

export type TelemetryEvent =
  | { type: 'message.ingested'; ownerId: string; conversationId: string; messages: number; roles: Record<string, number> }
  | { type: 'extraction.started'; ownerId: string; runId: string; conversationId: string; messages: number }
  | { type: 'extraction.finished'; ownerId: string; runId: string; status: 'done' | 'failed' | 'skipped'; written: number }
  | { type: 'llm.started'; ownerId: string | null; runId: string | null; promptId: string; task: string }
  | { type: 'llm.call'; ownerId: string | null; runId: string | null; promptId: string; model: string; inputTokens: number;
      cachedInputTokens: number; outputTokens: number; latencyMs: number; status: string }
  | { type: 'memory.written'; ownerId: string; runId: string | null; table: 'episodes' | 'facts' | 'notes'; id: string;
      kind?: string; authorRole?: string; importance?: number; corrects?: string | null }
  | { type: 'episode.linked'; ownerId: string; relation: 'duplicate' | 'corrects'; from: string; to: string }
  | { type: 'recall.served'; ownerId: string; tool: string; mode?: string; episodeIds: string[]; claimIds: string[];
      chats: number; digests: number; facts?: number; notes?: number }
  | { type: 'digest.written'; ownerId: string; level: 'day' | 'month'; period: string; sources: number }
  | { type: 'consolidation.finished'; ownerId: string; days: number; months: number; llmCalls: number; failed: number }
  | { type: 'episode.forgotten'; ownerId: string; ids: string[] };

export type StampedEvent = TelemetryEvent & { at: string };

@Injectable()
export class TelemetryService {
  private readonly bus = new Subject<StampedEvent>();

  emit(event: TelemetryEvent): void {
    this.bus.next({ ...event, at: new Date().toISOString() });
  }

  get events(): Observable<StampedEvent> {
    return this.bus.asObservable();
  }
}
