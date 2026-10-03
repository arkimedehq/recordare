// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Environment configuration, validated at startup (fail fast on a bad deploy).
 * LLM and embedding endpoints are provider-neutral (D27): any OpenAI-compatible server or the
 * native Anthropic API, with provider differences described by a profile.
 */
import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

export const envSchema = z.object({
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

  LLM_PROVIDER: z.enum(['openai-compatible', 'anthropic']).default('openai-compatible'),
  /** Provider profile name (reasoning switch, structured-output mode…), see llm/provider-profiles.ts. */
  LLM_PROFILE: z.string().default('generic'),
  /** Optional JSON override / definition of the profile (e.g. for a provider not listed). */
  LLM_PROFILE_JSON: z.string().optional(),
  LLM_BASE_URL: z.string().url().optional(),
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL: z.string(),
  /** Optional cheaper model for light tasks (digests, dedupe). Defaults to LLM_MODEL. */
  LLM_LIGHT_MODEL: z.string().optional(),

  EMBEDDING_BASE_URL: z.string().url(),
  EMBEDDING_API_KEY: z.string().default('none'),
  EMBEDDING_MODEL: z.string(),
  /** Fixed per installation; changing it requires a re-embed job (D27). */
  EMBEDDING_DIM: z.coerce.number().int().positive(),

  LOG_LLM_CALLS: bool.default(true),
  /** Evaluation / tests only: honour `X-Recordare-Now` to ask questions "as of" a past instant. */
  ALLOW_CLOCK_OVERRIDE: bool.default(false),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  // Empty values (`KEY=` in .env) mean "not set".
  const cleaned = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== ''));
  const parsed = envSchema.safeParse(cleaned);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${issues}`);
  }
  return parsed.data;
}
