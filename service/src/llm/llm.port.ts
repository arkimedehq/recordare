// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type z } from 'zod';

/**
 * The engine's LLM tasks. Each task has its own configurable model (and, if wanted, its own provider), so an
 * installation can give every job the model that measured best for it (D27, D35). Unset tasks use the default.
 * - `extract`: episodes, plans, facts and notes from a conversation window;
 * - `extract_economy`: the same, for owners on the economy profile (a cheaper model, if configured);
 * - `resolve`: the near-duplicate / correction check (short pairs, a light model is enough).
 */
export const LLM_TASKS = ['extract', 'extract_economy', 'resolve'] as const;
export type LlmTask = (typeof LLM_TASKS)[number];

export interface JsonCompletionRequest<T> {
  /** Stable id of the prompt (accounting, telemetry), e.g. "extract.episodes.v1". */
  promptId: string;
  system: string;
  user: string;
  /** Output schema: the reply is validated in code, never trusted. */
  schema: z.ZodType<T>;
  /** Which task's model serves the call. */
  task: LlmTask;
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
