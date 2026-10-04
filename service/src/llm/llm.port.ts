// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type z } from 'zod';

/** Which configured model a call uses: the extraction model or the cheaper light model. */
export type ModelRole = 'main' | 'light';

export interface JsonCompletionRequest<T> {
  /** Stable id of the prompt (accounting, telemetry), e.g. "extract.episodes.v1". */
  promptId: string;
  system: string;
  user: string;
  /** Output schema: the reply is validated in code, never trusted. */
  schema: z.ZodType<T>;
  role?: ModelRole;
  maxTokens?: number;
  /** Allow the model to reason before answering (quality profile `full`); off by default. The
   * output budget is raised so reasoning cannot exhaust it before the answer. */
  reasoning?: boolean;
}

/** Output budget for a request: reasoning models spend tokens before the visible answer. */
export function outputBudget(req: { maxTokens?: number; reasoning?: boolean }): number {
  const base = req.maxTokens ?? 4000;
  return req.reasoning ? base * 4 : base;
}

/** Who the call is for (llm_calls accounting); content is never recorded. */
export interface LlmCallContext {
  ownerId?: string;
  clientId?: string;
  runId?: string;
}

export interface LlmPort {
  completeJson<T>(req: JsonCompletionRequest<T>, ctx?: LlmCallContext): Promise<T>;
}

export const LLM_PORT = Symbol('LLM_PORT');

export class LlmOutputError extends Error {
  constructor(message: string, readonly promptId: string) {
    super(message);
    this.name = 'LlmOutputError';
  }
}
