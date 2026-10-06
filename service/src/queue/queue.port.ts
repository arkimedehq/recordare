// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/** Background work. Jobs carry ids only, never content (docs/DATA_MODEL.md → deletion). */
export interface QueuePort {
  /** (Re)schedule the idle extraction of a conversation (D1 debounce: one pending job per conversation). */
  scheduleIdleExtraction(conversationId: string, delayMs: number): Promise<void>;
  /** Compute embeddings for these messages (raw-log fallback search, D13). */
  enqueueMessageEmbeddings(messageIds: string[]): Promise<void>;
}

export const QUEUE_PORT = Symbol('QUEUE_PORT');

export const EXTRACTION_QUEUE = 'extraction';
export const EMBEDDING_QUEUE = 'embedding';
export const CONSOLIDATION_QUEUE = 'consolidation';

/** Runs extraction for a conversation's pending messages; the engine (M4) provides it. */
export interface ExtractionRunner {
  runForConversation(conversationId: string): Promise<void>;
}

export const EXTRACTION_RUNNER = Symbol('EXTRACTION_RUNNER');
