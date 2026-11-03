// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/** Word segmentation for every language from Intl (ICU dictionaries split scripts without spaces: 他呢, それは). */
const SEGMENTER = new Intl.Segmenter('und', { granularity: 'word' });

/** The number of words in a text, in any language and script. */
export function wordCount(text: string): number {
  let n = 0;
  for (const s of SEGMENTER.segment(text)) if (s.isWordLike) n++;
  return n;
}
