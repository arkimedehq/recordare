// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * One tiny structured call against the configured LLM (LLM_PROVIDER / LLM_PROFILE / LLM_BASE_URL /
 * LLM_API_KEY / LLM_MODEL): first check when adding a provider (D27). Prints result, tokens, latency.
 *   node -r @swc-node/register scripts/smoke-llm.ts
 */
import 'reflect-metadata';
import { z } from 'zod';
import { AnthropicAdapter } from '../src/llm/anthropic.adapter';
import { ClaudeCliAdapter } from '../src/llm/claude-cli.adapter';
import { OpenAiCompatibleAdapter } from '../src/llm/openai-compatible.adapter';
import { resolveProfile } from '../src/llm/provider-profiles';
import { type LlmCallRecord, type LlmCallRecorder } from '../src/llm/llm-call-recorder';

const env = process.env;
const calls: LlmCallRecord[] = [];
const recorder = { record: async (c: LlmCallRecord) => { calls.push(c); } } as unknown as LlmCallRecorder;
const cfg = {
  baseURL: env['LLM_BASE_URL'] || undefined,
  apiKey: env['LLM_API_KEY'] || undefined,
  model: env['LLM_MODEL'] ?? '',
  profile: resolveProfile(env['LLM_PROFILE'] ?? 'generic', env['LLM_PROFILE_JSON'] || undefined),
};
const llm = env['LLM_PROVIDER'] === 'anthropic' ? new AnthropicAdapter(cfg, recorder)
  : env['LLM_PROVIDER'] === 'claude-cli' ? new ClaudeCliAdapter({ model: cfg.model }, recorder)
    : new OpenAiCompatibleAdapter(cfg, recorder);

const schema = z.object({ events: z.array(z.object({ content: z.string(), date: z.string() })) });

async function main(): Promise<void> {
  const started = Date.now();
  const out = await llm.completeJson({
    promptId: 'smoke.v1',
    system: 'Extract the events the user lived, with absolute dates. Reply with JSON {"events":[{"content":"...","date":"YYYY-MM-DD"}]}.',
    user: 'Message time: Sunday 2026-01-18. User: "Ieri sono andato a sciare a Cervinia con Marco."',
    schema,
    maxTokens: 300,
  });
  console.log(JSON.stringify({ profile: cfg.profile.name, model: cfg.model, ms: Date.now() - started, out, calls }, null, 1));
}

main().catch((e: unknown) => { console.error((e as Error).message); process.exit(1); });
