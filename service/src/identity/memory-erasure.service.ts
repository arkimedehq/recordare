// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { z } from 'zod';
import { AuthService } from '../auth/auth.service';

/** The memory's id again, so a mistyped or reused call never erases a memory (400 `confirm_mismatch`). */
export const eraseQuery = z.object({ confirm: z.uuid() });

/** What an erasure took, by kind (every row, forgotten ones included). */
export interface ErasedCounts {
  conversations: number;
  messages: number;
  episodes: number;
  facts: number;
  notes: number;
  digests: number;
  sources: number;
  contacts: number;
}

/**
 * Erasing a whole memory (WORK_PLAN 8.13, maintainer's decision 2026-10-26): a memory does not forget everything about
 * someone, it dies. Everything it holds goes in one transaction — the holder, its contacts, identities, tokens,
 * conversations and raw log, episodes, facts, notes, digests, sources, exports, the recall log — with no tombstone,
 * since no message is left to extract again. The LLM call log keeps its rows without the memory (token counts and
 * costs, no content). Memories about someone else are forgotten one item at a time with the existing tools.
 */
@Injectable()
export class MemoryErasure {
  constructor(private readonly db: DataSource, private readonly auth: AuthService) {}

  async erase(memoryId: string, confirm: string): Promise<ErasedCounts> {
    if (confirm !== memoryId) throw new BadRequestException({ code: 'confirm_mismatch' });
    const counts = await this.db.transaction(async (tx) => {
      // Wait for a consolidation or an extraction already running on this memory (the locks they take), before the row
      // lock their writes would wait on; jobs that start later miss the lock or find nothing (they carry ids only).
      await tx.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 11))`, [memoryId]);
      await tx.query(
        `SELECT pg_advisory_xact_lock(hashtextextended(id::text, 7)) FROM conversations WHERE memory_id = $1 ORDER BY id`, [memoryId]);
      // Ingest blocks on this lock until the memory is gone, then fails on its foreign key.
      const [memory] = await tx.query(`SELECT person_id FROM memories WHERE person_id = $1 FOR UPDATE`, [memoryId]);
      if (!memory) throw new NotFoundException();
      const [row] = await tx.query(
        `SELECT (SELECT count(*)::int FROM conversations WHERE memory_id = $1) AS conversations,
                (SELECT count(*)::int FROM messages WHERE memory_id = $1) AS messages,
                (SELECT count(*)::int FROM episodes WHERE memory_id = $1) AS episodes,
                (SELECT count(*)::int FROM facts WHERE memory_id = $1) AS facts,
                (SELECT count(*)::int FROM notes WHERE memory_id = $1) AS notes,
                (SELECT count(*)::int FROM digests WHERE memory_id = $1) AS digests,
                (SELECT count(*)::int FROM sources WHERE memory_id = $1) AS sources,
                (SELECT count(*)::int FROM persons WHERE memory_id = $1) AS contacts`, [memoryId]);
      // The holder's person row: the memory and every row of it follow (ON DELETE CASCADE).
      await tx.query(`DELETE FROM persons WHERE id = $1`, [memoryId]);
      return row as ErasedCounts;
    });
    this.auth.forget(); // its tokens are gone
    return counts;
  }
}
