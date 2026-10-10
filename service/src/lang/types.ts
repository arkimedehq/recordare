// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * What the code (not the LLM) needs to know about languages. The engine is language-neutral — the model reads and
 * writes any language — but a few deterministic helpers match words: period expressions (D12), month names, relations in
 * questions, the leak detector of first-person memories. maintainer's rule (2026-10-08): every one of them covers the most used
 * languages, generated from Intl where it can be (months, relative periods) and from the tables here otherwise.
 */

/** Period expressions resolved without an LLM; checked in this order (longer phrases first where they overlap). */
export const PERIOD_KEYS = ['today', 'dayBeforeYesterday', 'yesterday', 'lastWeek', 'thisWeek', 'lastMonth', 'thisMonth',
  'lastYear', 'thisYear', 'thisWinter', 'thisSummer'] as const;
export type PeriodKey = (typeof PERIOD_KEYS)[number];

/** Relations a question may name ("what did my sister say?"); the same key in every language is the same relation. */
export type RelationKey = 'mother' | 'father' | 'sister' | 'brother' | 'wife' | 'husband' | 'partner' | 'son' | 'daughter'
  | 'grandparent' | 'uncleAunt' | 'cousin' | 'nephewNiece' | 'inLaw' | 'colleague' | 'boss' | 'friend';
