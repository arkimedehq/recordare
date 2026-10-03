// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Provider profiles (D27): every provider-specific detail of an OpenAI-compatible endpoint lives
 * here, as data. The engine never branches on the provider. Unknown providers use `generic` or a
 * JSON override (LLM_PROFILE_JSON).
 */
import { z } from 'zod';

export const providerProfileSchema = z.object({
  name: z.string(),
  /** Extra body fields that switch reasoning ("thinking") off — engines need direct answers. */
  reasoningOff: z.record(z.string(), z.unknown()).default({}),
  /** How to ask for JSON: strict schema, generic JSON mode, or prompt-only (parsed tolerantly). */
  structuredOutput: z.enum(['json_schema', 'json_object', 'prompt']).default('json_object'),
  /** Name of the output-token limit parameter. */
  tokenParam: z.enum(['max_tokens', 'max_completion_tokens']).default('max_tokens'),
  /** Whether the model accepts `temperature` (some reasoning models reject it). */
  supportsTemperature: z.boolean().default(true),
  /** Native Anthropic API only. */
  anthropic: z.object({
    /** `output_config.effort`; engines use low effort (thinking cannot be disabled on every model). */
    effort: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).optional(),
    /** Explicit `thinking` object, e.g. `{ "type": "between_tools" }` on models that accept it; omitted otherwise. */
    thinking: z.record(z.string(), z.unknown()).optional(),
    /** Server-side refusal fallback (`fallbacks: "default"`), for models that support it. */
    refusalFallback: z.boolean().default(true),
  }).default({ refusalFallback: true }),
});

export type ProviderProfile = z.infer<typeof providerProfileSchema>;

const PROFILES: Record<string, ProviderProfile> = {
  generic: providerProfileSchema.parse({ name: 'generic' }),
  deepseek: providerProfileSchema.parse({ name: 'deepseek', reasoningOff: { thinking: { type: 'disabled' } } }),
  ollama: providerProfileSchema.parse({ name: 'ollama', reasoningOff: { reasoning_effort: 'none' } }),
  vllm: providerProfileSchema.parse({ name: 'vllm', structuredOutput: 'json_schema' }),
  anthropic: providerProfileSchema.parse({
    name: 'anthropic',
    structuredOutput: 'json_schema',
    anthropic: { effort: 'low', refusalFallback: true },
  }),
  openai: providerProfileSchema.parse({
    name: 'openai',
    structuredOutput: 'json_schema',
    tokenParam: 'max_completion_tokens',
    supportsTemperature: false,
  }),
};

/** Resolve a profile by name, optionally overridden by a JSON document (validated). */
export function resolveProfile(name: string, overrideJson?: string): ProviderProfile {
  const base = PROFILES[name];
  if (!base && !overrideJson) throw new Error(`Unknown LLM profile "${name}" (known: ${Object.keys(PROFILES).join(', ')})`);
  if (!overrideJson) return base as ProviderProfile;
  return providerProfileSchema.parse({ ...(base ?? { name }), ...JSON.parse(overrideJson) });
}
