// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Language data for the deterministic helpers (owner's rule 2026-10-08: all languages, at least the most used). Every
 * language applies at once — a person may write in several, and their words do not collide; the owner's locale only
 * formats dates. To add a language: add it to LOCALES (months and relative periods come from Intl), then its relation
 * words and, if it has articles, its "the owner" forms.
 */
export { containsPhrase, LOCALES, normalize } from './locales';
export { nameOwner } from './owner';
export { MONTH_NAMES, periodPhrases, WEEKDAY_NAMES } from './periods';
export { PERIOD_KEYS, type PeriodKey, type RelationKey } from './types';
import { RELATIONS } from './relations';
import { normalize } from './locales';
import { type RelationKey } from './types';

/** Each relation with its words in all languages (normalized). */
export const RELATION_GROUPS: ReadonlyArray<{ key: RelationKey; words: readonly string[] }> = (Object.keys(RELATIONS) as RelationKey[])
  .map((key) => ({ key, words: [...new Set(Object.values(RELATIONS[key]).flat().map(normalize))] }));
