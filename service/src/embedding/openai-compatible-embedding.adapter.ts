// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Embeddings over any OpenAI-compatible /v1/embeddings server (Arkimede's embedding-service,
 * Ollama, vLLM, hosted providers). Batches requests and checks the dimension, so a wrong model
 * can never write vectors of another size into the index.
 */
import OpenAI from 'openai';
import { type EmbeddingKind, type EmbeddingPort } from './embedding.port';

export interface EmbeddingConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  dim: number;
  batchSize?: number;
  fetch?: typeof fetch;
}

export class OpenAiCompatibleEmbeddingAdapter implements EmbeddingPort {
  private readonly client: OpenAI;
  readonly model: string;
  readonly dim: number;

  constructor(private readonly cfg: EmbeddingConfig) {
    this.model = cfg.model;
    this.dim = cfg.dim;
    this.client = new OpenAI({ baseURL: cfg.baseURL, apiKey: cfg.apiKey, maxRetries: 2, ...(cfg.fetch ? { fetch: cfg.fetch } : {}) });
  }

  async embed(texts: string[], kind: EmbeddingKind): Promise<number[][]> {
    const out: number[][] = [];
    const size = this.cfg.batchSize ?? 64;
    for (let i = 0; i < texts.length; i += size) {
      const batch = texts.slice(i, i + size);
      // `input_type` is honoured by servers that distinguish query / document prompts
      // (e.g. Arkimede's embedding-service) and ignored by the others.
      // encoding_format 'float': the SDK otherwise asks for base64 and mis-decodes servers that return
      // plain float arrays (most OpenAI-compatible embedding servers).
      const res = await this.client.embeddings.create({ model: this.model, input: batch, encoding_format: 'float', input_type: kind } as OpenAI.EmbeddingCreateParams);
      const vectors = [...res.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
      for (const v of vectors) {
        if (v.length !== this.dim) throw new Error(`embedding dimension ${v.length} != configured ${this.dim} (model ${this.model})`);
      }
      out.push(...vectors);
    }
    return out;
  }
}
