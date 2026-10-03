// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

export type EmbeddingKind = 'query' | 'document';

export interface EmbeddingPort {
  /** Model id stored next to each vector (D27: changing model = re-embed job). */
  readonly model: string;
  readonly dim: number;
  embed(texts: string[], kind: EmbeddingKind): Promise<number[][]>;
}

export const EMBEDDING_PORT = Symbol('EMBEDDING_PORT');
