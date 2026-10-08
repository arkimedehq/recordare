// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * The most used languages (by speakers), plus the project's own: the deterministic helpers cover all of them. Month names
 * and relative periods ("yesterday", "last week") come from Intl for each; the tables in this folder add the rest.
 */
export const LOCALES = ['en', 'zh', 'hi', 'es', 'fr', 'ar', 'bn', 'pt', 'ru', 'ur', 'id', 'de', 'ja', 'it', 'tr', 'ko',
  'vi', 'fa', 'pl', 'nl', 'th', 'sw', 'uk', 'ro', 'el'] as const;

/** Lower case, NFC, apostrophes folded to ' — the form every phrase is matched in. */
export const normalize = (s: string): string => s.normalize('NFC').toLocaleLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();

/** Scripts written without spaces between words: matched as substrings, not as whole words. */
const NO_SPACES = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}\p{Script=Khmer}\p{Script=Lao}\p{Script=Myanmar}]/u;

/** Whether `phrase` occurs in `text` (both normalized) as whole words — or anywhere, for scripts without spaces. */
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function containsPhrase(text: string, phrase: string): boolean {
  if (!phrase) return false;
  // No spaces: anywhere, but not as the tail of a longer number ("1月" is not inside "11月", "一月" not inside "十一月").
  if (NO_SPACES.test(phrase)) return new RegExp(`(?<![\\p{Nd}〇一二三四五六七八九十百千])${escape(phrase)}`, 'u').test(text);
  return new RegExp(`(?<![\\p{L}\\p{N}])${escape(phrase)}(?![\\p{L}\\p{N}])`, 'u').test(text);
}
