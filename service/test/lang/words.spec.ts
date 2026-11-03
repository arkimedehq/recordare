// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { wordCount } from '../../src/lang';

describe('word count from Intl, any language (D54: a short follow-up is matched with the turn before it)', () => {
  it.each([
    ['e lui?', 2],
    ['sì, quello', 2],
    ['And her?', 2],
    ['¿Y ella?', 2],
    ['Et lui ?', 2],
    ['Und er?', 2],
    ['А он?', 2],
    ['وهو؟', 1],
    ['और वह?', 2],
    ['他呢？', 2],
    ['それは？', 2],
    ['그 사람은?', 2],
    ['Cosa abbiamo fatto in Giappone la scorsa primavera?', 8],
  ])('%s → %i', (text, n) => {
    expect(wordCount(text)).toBe(n);
  });
});
