// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { type LlmCallContext } from './llm.port';

export interface LlmCallRecord {
  promptId: string;
  provider: string;
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  latencyMs: number;
  status: 'ok' | 'invalid_output' | 'error';
}

/** Per-call accounting (cost principles): tokens and latency, never prompt or completion text. */
@Injectable()
export class LlmCallRecorder {
  private readonly log = new Logger(LlmCallRecorder.name);

  constructor(private readonly db: DataSource) {}

  async record(call: LlmCallRecord, ctx: LlmCallContext = {}): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO llm_calls (owner_id, client_id, run_id, prompt_id, provider, model, input_tokens,
           cached_input_tokens, output_tokens, latency_ms, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [ctx.ownerId ?? null, ctx.clientId ?? null, ctx.runId ?? null, call.promptId, call.provider, call.model,
          call.inputTokens, call.cachedInputTokens, call.outputTokens, call.latencyMs, call.status],
      );
    } catch (err) {
      // Accounting must never break the engine.
      this.log.warn(`llm_calls insert failed: ${(err as Error).message}`);
    }
  }
}
