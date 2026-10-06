// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { taskEnvKey, type Env } from '../config/env';
import { LLM_PORT, LLM_TASKS, type LlmPort, type LlmTask } from './llm.port';
import { LlmRouter } from './llm-router';
import { LlmCallRecorder } from './llm-call-recorder';
import { OpenAiCompatibleAdapter } from './openai-compatible.adapter';
import { resolveProfile } from './provider-profiles';
import { AnthropicAdapter } from './anthropic.adapter';
import { ClaudeCliAdapter } from './claude-cli.adapter';
import { EMBEDDING_PORT, type EmbeddingPort } from '../embedding/embedding.port';
import { OpenAiCompatibleEmbeddingAdapter } from '../embedding/openai-compatible-embedding.adapter';
import { CLOCK_PORT, systemClock } from '../clock/clock.port';

/** Model access for the whole service, chosen by configuration only (D27): one model (and provider) per task. */
@Global()
@Module({
  providers: [
    LlmCallRecorder,
    {
      provide: LLM_PORT,
      inject: [ConfigService, LlmCallRecorder],
      useFactory: (config: ConfigService<Env, true>, recorder: LlmCallRecorder): LlmPort => {
        const raw = config as unknown as ConfigService<Record<string, string | undefined>, false>;
        const shared = new Map<string, LlmPort>();
        const adapterFor = (task: LlmTask): LlmPort => {
          const pick = (field: Parameters<typeof taskEnvKey>[1], fallback: string | undefined) => raw.get(taskEnvKey(task, field)) ?? fallback;
          const ep = {
            provider: pick('PROVIDER', config.get('LLM_PROVIDER', { infer: true })) as Env['LLM_PROVIDER'],
            baseURL: pick('BASE_URL', config.get('LLM_BASE_URL', { infer: true })),
            apiKey: pick('API_KEY', config.get('LLM_API_KEY', { infer: true })),
            model: pick('MODEL', config.get('LLM_MODEL', { infer: true })) as string,
            profileName: pick('PROFILE', config.get('LLM_PROFILE', { infer: true })) as string,
            profileJson: pick('PROFILE_JSON', config.get('LLM_PROFILE_JSON', { infer: true })),
          };
          const key = JSON.stringify(ep);
          const existing = shared.get(key);
          if (existing) return existing;
          const common = { baseURL: ep.baseURL, apiKey: ep.apiKey, model: ep.model, profile: resolveProfile(ep.profileName, ep.profileJson) };
          const adapter = ep.provider === 'anthropic' ? new AnthropicAdapter(common, recorder)
            : ep.provider === 'claude-cli' ? new ClaudeCliAdapter({ model: ep.model }, recorder)
              : new OpenAiCompatibleAdapter(common, recorder);
          shared.set(key, adapter);
          return adapter;
        };
        return new LlmRouter(Object.fromEntries(LLM_TASKS.map((t) => [t, adapterFor(t)])) as Record<LlmTask, LlmPort>,
          (promptId, task, ctx) => recorder.started(promptId, task, ctx));
      },
    },
    {
      provide: EMBEDDING_PORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): EmbeddingPort => new OpenAiCompatibleEmbeddingAdapter({
        baseURL: config.get('EMBEDDING_BASE_URL', { infer: true }),
        apiKey: config.get('EMBEDDING_API_KEY', { infer: true }),
        model: config.get('EMBEDDING_MODEL', { infer: true }),
        dim: config.get('EMBEDDING_DIM', { infer: true }),
      }),
    },
    { provide: CLOCK_PORT, useValue: systemClock },
  ],
  exports: [LLM_PORT, EMBEDDING_PORT, CLOCK_PORT, LlmCallRecorder],
})
export class LlmModule {}
