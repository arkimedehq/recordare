// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * The part of a long message a chat excerpt shows (D30): the run of consecutive sentences, at most `max` characters, that
 * holds the most of the query's words — not the message's start, where a long reply's answer seldom is ("how many eggs
 * did you say for the omelette?" sits in step 2 of a recipe). No LLM, any language: words come from `Intl.Segmenter`,
 * folded (lower case, no accents) and matched as substrings, so "egg" finds "eggs"; a word longer than five letters also
 * matches without its last two ("recommended" finds "recommend"). No word of the query found: the start, as before.
 */

const SENTENCE = /(?<=[.?!。？！।؟:;])\s+|(?<=[。？！])|\n+/u;
/** Scripts written without spaces between words: their words are short (two letters are a word). */
const NO_SPACES = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}\p{Script=Khmer}\p{Script=Lao}\p{Script=Myanmar}]/u;

const fold = (s: string): string => s.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase();

/** The query's words worth finding, folded: three letters or more (two in scripts without spaces), each once. */
export function queryWords(query: string): string[] {
  const words = new Set<string>();
  for (const s of new Intl.Segmenter(undefined, { granularity: 'word' }).segment(fold(query))) {
    if (!s.isWordLike) continue;
    const w = s.segment;
    if (w.length >= 3 || (NO_SPACES.test(w) && w.length >= 2)) words.add(w.length > 5 && !NO_SPACES.test(w) ? w.slice(0, -2) : w);
  }
  return [...words];
}

export function bestExcerpt(content: string, query: string, max: number): string {
  if (content.length <= max) return content;
  const head = () => `${content.slice(0, max)}…`;
  const words = queryWords(query);
  if (!words.length) return head();
  const pieces = content.split(SENTENCE).map((p) => p.trim()).filter(Boolean);
  const found = pieces.map((p) => { const f = fold(p); return new Set(words.filter((w) => f.includes(w))); });

  let best = { score: 0, from: 0, to: 0 };
  for (let i = 0; i < pieces.length; i++) {
    const seen = new Set<string>();
    let length = 0;
    for (let j = i; j < pieces.length; j++) {
      length += (pieces[j]?.length ?? 0) + (j > i ? 1 : 0);
      if (j > i && length > max) break;
      for (const w of found[j] ?? []) seen.add(w);
      if (seen.size > best.score) best = { score: seen.size, from: i, to: j };
    }
  }
  if (best.score === 0) return head();
  const text = pieces.slice(best.from, best.to + 1).join(' ');
  if (text.length > max) {
    // One sentence longer than the excerpt: the stretch around its first matching word.
    const f = fold(text);
    const at = Math.max(0, Math.min(...words.map((w) => f.indexOf(w)).filter((k) => k >= 0)) - Math.floor(max / 3));
    return `${at > 0 || best.from > 0 ? '…' : ''}${text.slice(at, at + max)}…`;
  }
  return `${best.from > 0 ? '…' : ''}${text}${best.to < pieces.length - 1 ? '…' : ''}`;
}
