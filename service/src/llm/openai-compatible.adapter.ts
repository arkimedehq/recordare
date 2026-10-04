// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * LlmPort over any OpenAI-compatible chat endpoint (OpenAI, DeepSeek, Mistral, Groq, OpenRouter,
 * vLLM, LM Studio, Ollama, gateways). Provider differences come from the profile (D27).
 * Spike lessons: reasoning off (or capped tokens return empty content), validate every reply,
 * one repair attempt for invalid output, retries only for transient errors.
 */
import OpenAI from 'openai';
import { z } from 'zod';
import { type ProviderProfile } from './provider-profiles';
import { type LlmCallRecord, type LlmCallRecorder } from './llm-call-recorder';
import { LlmOutputError, outputBudget, type JsonCompletionRequest, type LlmCallContext, type LlmPort } from './llm.port';

export interface OpenAiCompatibleConfig {
  baseURL?: string;
  apiKey?: string;
  model: string;
  lightModel?: string;
  profile: ProviderProfile;
  /** Injected for tests. */
  fetch?: typeof fetch;
  timeoutMs?: number;
}

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

const TRANSIENT_ATTEMPTS = 3;

/** Extract a JSON object from a reply that may be wrapped in fences or prose (prompt-only mode). */
export function parseJsonObject(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error('no JSON object in reply');
  }
}

function isTransient(err: unknown): boolean {
  if (err instanceof OpenAI.APIConnectionError) return true;
  if (err instanceof OpenAI.APIError) return err.status === 429 || (err.status ?? 0) >= 500;
  return false;
}

export class OpenAiCompatibleAdapter implements LlmPort {
  private readonly client: OpenAI;

  constructor(private readonly cfg: OpenAiCompatibleConfig, private readonly recorder?: LlmCallRecorder) {
    this.client = new OpenAI({
      baseURL: cfg.baseURL,
      apiKey: cfg.apiKey || 'none',
      maxRetries: 0,
      timeout: cfg.timeoutMs ?? 120_000,
      ...(cfg.fetch ? { fetch: cfg.fetch } : {}),
    });
  }

  async completeJson<T>(req: JsonCompletionRequest<T>, ctx: LlmCallContext = {}): Promise<T> {
    const model = req.role === 'light' ? (this.cfg.lightModel ?? this.cfg.model) : this.cfg.model;
    const messages: ChatMessage[] = [
      { role: 'system', content: this.systemPrompt(req) },
      { role: 'user', content: req.user },
    ];
    let lastIssue = '';
    for (let repair = 0; repair < 2; repair++) {
      const { content, usage } = await this.call(req, model, messages, ctx);
      try {
        const parsed = req.schema.safeParse(parseJsonObject(content));
        if (parsed.success) {
          await this.recorder?.record({ ...usage, status: 'ok' }, ctx);
          return parsed.data;
        }
        lastIssue = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
      } catch (err) {
        lastIssue = (err as Error).message;
      }
      await this.recorder?.record({ ...usage, status: 'invalid_output' }, ctx);
      messages.push({ role: 'assistant', content }, {
        role: 'user',
        content: `Your previous output was not valid (${lastIssue}). Return ONLY one JSON object that satisfies the requested schema, with actual values.`,
      });
    }
    throw new LlmOutputError(`invalid output after repair: ${lastIssue}`, req.promptId);
  }

  private systemPrompt<T>(req: JsonCompletionRequest<T>): string {
    if (this.cfg.profile.structuredOutput !== 'prompt') return req.system;
    const schema = JSON.stringify(z.toJSONSchema(req.schema));
    return `${req.system}\n\nReply with ONLY a JSON object matching this JSON Schema:\n${schema}`;
  }

  private body<T>(req: JsonCompletionRequest<T>, model: string, messages: ChatMessage[]): Record<string, unknown> {
    const p = this.cfg.profile;
    const body: Record<string, unknown> = { model, messages, ...(req.reasoning ? {} : p.reasoningOff) };
    body[p.tokenParam] = outputBudget(req);
    if (p.supportsTemperature) body['temperature'] = 0;
    if (p.structuredOutput === 'json_object') body['response_format'] = { type: 'json_object' };
    if (p.structuredOutput === 'json_schema') {
      body['response_format'] = {
        type: 'json_schema',
        json_schema: { name: req.promptId.replace(/[^a-zA-Z0-9_-]/g, '_'), schema: z.toJSONSchema(req.schema) },
      };
    }
    return body;
  }

  private async call<T>(
    req: JsonCompletionRequest<T>, model: string, messages: ChatMessage[], ctx: LlmCallContext,
  ): Promise<{ content: string; usage: Omit<LlmCallRecord, 'status'> }> {
    for (let attempt = 1; ; attempt++) {
      const started = Date.now();
      try {
        const res = await this.client.chat.completions.create(
          this.body(req, model, messages) as unknown as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
        );
        const u = res.usage;
        const usage = {
          promptId: req.promptId,
          provider: this.cfg.profile.name,
          model,
          inputTokens: u?.prompt_tokens ?? 0,
          cachedInputTokens: u?.prompt_tokens_details?.cached_tokens ?? 0,
          outputTokens: u?.completion_tokens ?? 0,
          latencyMs: Date.now() - started,
        };
        return { content: res.choices[0]?.message?.content ?? '', usage };
      } catch (err) {
        if (!isTransient(err) || attempt >= TRANSIENT_ATTEMPTS) {
          await this.recorder?.record({
            promptId: req.promptId, provider: this.cfg.profile.name, model, inputTokens: 0, cachedInputTokens: 0,
            outputTokens: 0, latencyMs: Date.now() - started, status: 'error',
          }, ctx);
          throw err;
        }
        await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
      }
    }
  }
}
