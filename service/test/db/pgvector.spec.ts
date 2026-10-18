// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { storeEmbeddings, vectorParam } from '../../src/db/pgvector';

describe('pgvector helpers (D25; WORK_PLAN 2.3: no separate vector-store port)', () => {
  const recorder = () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    return { calls, db: { query: async (sql: string, params: unknown[]) => { calls.push({ sql, params }); return []; } } };
  };

  it('a vector parameter is the pgvector text form', () => {
    expect(vectorParam([0.5, -1, 2e-7])).toBe('[0.5,-1,2e-7]');
  });

  it('stores the model and the embedded text where the table keeps them', async () => {
    const { calls, db } = recorder();
    await storeEmbeddings(db, 'episodes', 'bge-m3', [{ id: 'e1', vector: [1, 2], text: 'Cena da Anna' }]);
    await storeEmbeddings(db, 'source_passages', 'bge-m3', [{ id: 'p1', vector: [3] }]);
    await storeEmbeddings(db, 'messages', 'bge-m3', [{ id: 'm1', vector: [4] }]);
    expect(calls).toEqual([
      { sql: 'UPDATE episodes SET embedding = $2::vector, embedding_model = $3, embedding_text = $4 WHERE id = $1', params: ['e1', '[1,2]', 'bge-m3', 'Cena da Anna'] },
      { sql: 'UPDATE source_passages SET embedding = $2::vector, embedding_model = $3 WHERE id = $1', params: ['p1', '[3]', 'bge-m3'] },
      { sql: 'UPDATE messages SET embedding = $2::vector WHERE id = $1', params: ['m1', '[4]'] },
    ]);
  });

  it('a row the provider returned no vector for keeps a null embedding', async () => {
    const { calls, db } = recorder();
    await storeEmbeddings(db, 'facts', 'bge-m3', [{ id: 'f1', vector: undefined, text: 'x' }, { id: 'f2', vector: [], text: 'y' }]);
    expect(calls).toEqual([]);
  });
});
