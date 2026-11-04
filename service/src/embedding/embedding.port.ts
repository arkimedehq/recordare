// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

export type EmbeddingKind = 'query' | 'document';

/**
 * Who waits for the vectors (independent of the kind, which picks the model's query / document prompt):
 * `interactive` — a request someone is waiting on (the memory context, a recall tool, `remember`), sent at once;
 * `background` (the default) — queue workers and nightly passes, which give way to the interactive ones
 * (`PrioritizedEmbeddings`).
 */
export type EmbeddingPriority = 'interactive' | 'background';

export interface EmbedOptions {
  priority?: EmbeddingPriority;
}

export interface EmbeddingPort {
  /** Model id stored next to each vector (D27: changing model = re-embed job). */
  readonly model: string;
  readonly dim: number;
  embed(texts: string[], kind: EmbeddingKind, opts?: EmbedOptions): Promise<number[][]>;
}

export const EMBEDDING_PORT = Symbol('EMBEDDING_PORT');
