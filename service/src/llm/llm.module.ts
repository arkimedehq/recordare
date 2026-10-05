// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Env } from '../config/env';
import { LLM_PORT, type LlmPort } from './llm.port';
import { LlmCallRecorder } from './llm-call-recorder';
import { OpenAiCompatibleAdapter } from './openai-compatible.adapter';
import { resolveProfile } from './provider-profiles';
import { AnthropicAdapter } from './anthropic.adapter';
import { ClaudeCliAdapter } from './claude-cli.adapter';
import { EMBEDDING_PORT, type EmbeddingPort } from '../embedding/embedding.port';
import { OpenAiCompatibleEmbeddingAdapter } from '../embedding/openai-compatible-embedding.adapter';
import { CLOCK_PORT, systemClock } from '../clock/clock.port';

/** Model access for the whole service, chosen by configuration only (D27). */
@Global()
@Module({
  providers: [
    LlmCallRecorder,
    {
      provide: LLM_PORT,
      inject: [ConfigService, LlmCallRecorder],
      useFactory: (config: ConfigService<Env, true>, recorder: LlmCallRecorder): LlmPort => {
        const common = {
          baseURL: config.get('LLM_BASE_URL', { infer: true }),
          apiKey: config.get('LLM_API_KEY', { infer: true }),
          model: config.get('LLM_MODEL', { infer: true }),
          lightModel: config.get('LLM_LIGHT_MODEL', { infer: true }),
          profile: resolveProfile(config.get('LLM_PROFILE', { infer: true }), config.get('LLM_PROFILE_JSON', { infer: true })),
        };
        const provider = config.get('LLM_PROVIDER', { infer: true });
        if (provider === 'anthropic') return new AnthropicAdapter(common, recorder);
        if (provider === 'claude-cli') return new ClaudeCliAdapter({ model: common.model, lightModel: common.lightModel }, recorder);
        return new OpenAiCompatibleAdapter(common, recorder);
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
