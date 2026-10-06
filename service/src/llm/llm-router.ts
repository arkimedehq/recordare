// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * One LLM port, one adapter per task: every task runs on the model (and provider) configured for it, so each job
 * can use the model that measured best for it. Tasks sharing the same endpoint and model share one adapter.
 */
import { type JsonCompletionRequest, type LlmCallContext, type LlmPort, type LlmTask } from './llm.port';

export class LlmRouter implements LlmPort {
  constructor(private readonly byTask: Record<LlmTask, LlmPort>) {}

  completeJson<T>(req: JsonCompletionRequest<T>, ctx?: LlmCallContext): Promise<T> {
    return this.byTask[req.task].completeJson(req, ctx);
  }
}
