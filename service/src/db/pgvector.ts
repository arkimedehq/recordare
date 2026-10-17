// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * pgvector, the memory's vector store (D25). There is no separate vector-store port (WORK_PLAN 2.3, decided
 * 2026-10-18): recall ranks by vector, full text and dates in one SQL query, and forgetting deletes rows and their
 * vectors in one transaction — a second store would lose both. Vector parameters and embedding writes go through here;
 * the similarity SQL (`1 - (a <=> b)`, cosine) stays in the queries that rank by it.
 */
/** A DataSource, an EntityManager or a transaction. */
type Queryable = { query(sql: string, params?: unknown[]): Promise<unknown> };

/** A vector as a pgvector query parameter (cast it with `::vector` in the SQL). */
export function vectorParam(vector: readonly number[]): string {
  return `[${vector.join(',')}]`;
}

/**
 * The tables with an embedding, and what they keep next to it: the model (a change of model re-embeds) and, for the
 * memory's own rows, the text that was embedded (retrieval keys included).
 */
const COLUMNS = {
  messages: [],
  source_passages: ['embedding_model'],
  episodes: ['embedding_model', 'embedding_text'],
  facts: ['embedding_model', 'embedding_text'],
  notes: ['embedding_model', 'embedding_text'],
} as const;

export type EmbeddedTable = keyof typeof COLUMNS;

/**
 * Stores the embeddings of rows, one update each; a row without a vector (the provider returned fewer) keeps a null
 * embedding — full text still finds it.
 */
export async function storeEmbeddings(
  db: Queryable, table: EmbeddedTable, model: string, rows: ReadonlyArray<{ id: string; vector: readonly number[] | undefined; text?: string }>,
): Promise<void> {
  const extra = COLUMNS[table];
  const sets = ['embedding = $2::vector', ...extra.map((c, i) => `${c} = $${i + 3}`)].join(', ');
  for (const row of rows) {
    if (!row.vector?.length) continue;
    const values = extra.map((c) => (c === 'embedding_model' ? model : row.text ?? null));
    await db.query(`UPDATE ${table} SET ${sets} WHERE id = $1`, [row.id, vectorParam(row.vector), ...values]);
  }
}
