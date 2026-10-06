// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * LlmPort over the native Anthropic Messages API (D27). Structured output (`output_config.format`
 * from the SDK's zod helper, validated again in code), a cached system prompt (stable prefix → cheaper repeated calls), effort and
 * thinking from the profile, and the server-side refusal fallback when the profile enables it.
 * The model id always comes from configuration.
 */
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { type ProviderProfile } from './provider-profiles';
import { type LlmCallRecord, type LlmCallRecorder } from './llm-call-recorder';
import { LlmOutputError, outputBudget, type JsonCompletionRequest, type LlmCallContext, type LlmPort } from './llm.port';

export interface AnthropicConfig {
  apiKey?: string;
  baseURL?: string;
  model: string;
  profile: ProviderProfile;
  fetch?: typeof fetch;
}

const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

export class AnthropicAdapter implements LlmPort {
  private readonly client: Anthropic;

  constructor(private readonly cfg: AnthropicConfig, private readonly recorder?: LlmCallRecorder) {
    this.client = new Anthropic({
      ...(cfg.apiKey ? { apiKey: cfg.apiKey } : {}),
      ...(cfg.baseURL ? { baseURL: cfg.baseURL } : {}),
      ...(cfg.fetch ? { fetch: cfg.fetch } : {}),
      maxRetries: 2, // the SDK retries 408/409/429/5xx and connection errors
    });
  }

  async completeJson<T>(req: JsonCompletionRequest<T>, ctx: LlmCallContext = {}): Promise<T> {
    const model = this.cfg.model;
    const a = this.cfg.profile.anthropic;
    // Reasoning requests think adaptively unless the profile configures thinking explicitly.
    const thinking = a.thinking ?? (req.reasoning ? { type: 'adaptive' } : undefined);
    let lastIssue = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      const started = Date.now();
      let usage: Omit<LlmCallRecord, 'status'> = {
        promptId: req.promptId, provider: this.cfg.profile.name, model, inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, latencyMs: 0,
      };
      try {
        const res = await this.client.beta.messages.create({
          model,
          max_tokens: outputBudget(req),
          system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content: attempt === 0 ? req.user : `${req.user}\n\n(Previous output was invalid: ${lastIssue}. Follow the schema exactly.)` }],
          output_config: { format: betaZodOutputFormat(req.schema), ...(a.effort ? { effort: a.effort } : {}) },
          ...(thinking ? { thinking: thinking as unknown as Anthropic.Beta.BetaThinkingConfigParam } : {}),
          ...(a.refusalFallback ? { fallbacks: 'default' as const, betas: [FALLBACK_BETA] } : {}),
        });
        usage = {
          ...usage,
          inputTokens: res.usage.input_tokens,
          cachedInputTokens: res.usage.cache_read_input_tokens ?? 0,
          outputTokens: res.usage.output_tokens,
          latencyMs: Date.now() - started,
        };
        if (res.stop_reason === 'refusal') {
          await this.recorder?.record({ ...usage, status: 'error' }, ctx);
          throw new LlmOutputError('request declined by the model (refusal)', req.promptId);
        }
        // Parse and validate here (not with the SDK's parse helper): refusals are checked first and
        // invalid output gets one retry instead of an exception.
        const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
        let candidate: unknown = undefined;
        try {
          candidate = JSON.parse(text);
        } catch {
          candidate = undefined;
        }
        const parsed = req.schema.safeParse(candidate);
        if (parsed.success) {
          await this.recorder?.record({ ...usage, status: 'ok' }, ctx);
          return parsed.data;
        }
        lastIssue = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
        await this.recorder?.record({ ...usage, status: 'invalid_output' }, ctx);
      } catch (err) {
        if (err instanceof LlmOutputError) throw err;
        await this.recorder?.record({ ...usage, latencyMs: Date.now() - started, status: 'error' }, ctx);
        throw err;
      }
    }
    throw new LlmOutputError(`invalid output after repair: ${lastIssue}`, req.promptId);
  }
}
