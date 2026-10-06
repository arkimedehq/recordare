// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Environment configuration, validated at startup (fail fast on a bad deploy).
 * LLM and embedding endpoints are provider-neutral (D27): any OpenAI-compatible server or the
 * native Anthropic API, with provider differences described by a profile.
 */
import { z } from 'zod';
import { QUALITY_PROFILES } from '../engine/quality-profile';
import { LLM_TASKS, type LlmTask } from '../llm/llm.port';

const bool = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const llmProvider = z.enum(['openai-compatible', 'anthropic', 'claude-cli']);

/** Per-task endpoint overrides: LLM_<TASK>_MODEL / _PROVIDER / _PROFILE / _PROFILE_JSON / _BASE_URL / _API_KEY.
 * Anything unset falls back to the matching LLM_* default, so one model for everything stays one line. */
export function taskEnvKey(task: LlmTask, field: 'MODEL' | 'PROVIDER' | 'PROFILE' | 'PROFILE_JSON' | 'BASE_URL' | 'API_KEY'): string {
  return `LLM_${task.toUpperCase()}_${field}`;
}
const taskOverrides = Object.fromEntries(LLM_TASKS.flatMap((t) => [
  [taskEnvKey(t, 'MODEL'), z.string().optional()],
  [taskEnvKey(t, 'PROVIDER'), llmProvider.optional()],
  [taskEnvKey(t, 'PROFILE'), z.string().optional()],
  [taskEnvKey(t, 'PROFILE_JSON'), z.string().optional()],
  [taskEnvKey(t, 'BASE_URL'), z.string().url().optional()],
  [taskEnvKey(t, 'API_KEY'), z.string().optional()],
]));

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  /** Queue key prefix: separates installations (or test runs) sharing one Redis. */
  QUEUE_PREFIX: z.string().regex(/^[a-z0-9_-]+$/).default('recordare'),
  /** v1 home / research profile (D33): bootstrap admin credential. */
  ADMIN_API_KEY: z.string().min(32),
  /** Idle debounce before extracting a conversation (D1, D5): global, seconds. */
  IDLE_DELAY_SECONDS: z.coerce.number().int().positive().default(900),
  /** Max characters of messages per extraction call; set = overrides the quality profile's value. */
  EXTRACTION_WINDOW_CHARS: z.coerce.number().int().min(1000).optional(),
  /** Installation default quality profile (D35); owners may override it. */
  QUALITY_PROFILE: z.enum(QUALITY_PROFILES).default('balanced'),

  /** `claude-cli`: local evaluation only, through the operator's own Claude plan (headless Claude Code). */
  LLM_PROVIDER: llmProvider.default('openai-compatible'),
  /** Provider profile name (reasoning switch, structured-output mode…), see llm/provider-profiles.ts. */
  LLM_PROFILE: z.string().default('generic'),
  /** Optional JSON override / definition of the profile (e.g. for a provider not listed). */
  LLM_PROFILE_JSON: z.string().optional(),
  LLM_BASE_URL: z.string().url().optional(),
  LLM_API_KEY: z.string().optional(),
  /** Default model of every task (see taskOverrides for per-task models / providers). */
  LLM_MODEL: z.string(),

  EMBEDDING_BASE_URL: z.string().url(),
  EMBEDDING_API_KEY: z.string().default('none'),
  EMBEDDING_MODEL: z.string(),
  /** Fixed per installation; changing it requires a re-embed job (D27). */
  EMBEDDING_DIM: z.coerce.number().int().positive(),

  LOG_LLM_CALLS: bool.default(true),
  /** Evaluation / tests only: honour `X-Recordare-Now` to ask questions "as of" a past instant. */
  ALLOW_CLOCK_OVERRIDE: bool.default(false),
});

/** Validated as a whole; the per-task keys are read by name by the LLM module (taskEnvKey). */
export const envSchema = baseSchema.extend(taskOverrides);

export type Env = z.infer<typeof baseSchema>;

export function validateEnv(raw: Record<string, unknown>): Env & Record<string, unknown> {
  // Empty values (`KEY=` in .env) mean "not set".
  const cleaned = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== ''));
  const parsed = envSchema.safeParse(cleaned);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${issues}`);
  }
  return parsed.data as Env & Record<string, unknown>;
}
