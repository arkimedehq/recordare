// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { containsPhrase, LOCALES, normalize, periodPhrases, RELATION_GROUPS } from '../../src/lang';

const relationOf = (question: string) => RELATION_GROUPS.filter((g) => g.words.some((w) => containsPhrase(normalize(question), w))).map((g) => g.key);

describe('language data (owner\'s rule: all languages, at least the most used)', () => {
  it('has period phrases from Intl for every locale', () => {
    for (const locale of LOCALES) {
      const yesterday = normalize(new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-1, 'day'));
      if (!/\d/.test(yesterday)) expect([locale, periodPhrases('yesterday').includes(yesterday)]).toEqual([locale, true]);
    }
  });

  it.each([
    ['¿Qué dijo mi hermana?', 'sister'],
    ["Qu'a dit ma sœur ?", 'sister'],
    ['Was hat mein Bruder gesagt?', 'brother'],
    ['我姐姐说了什么', 'sister'],
    ['母は何と言いましたか', 'mother'],
    ['엄마가 뭐라고 했어?', 'mother'],
    ['मेरी बहन ने क्या कहा', 'sister'],
    ['ماذا قالت أختي', 'sister'],
    ['Что сказал мой брат?', 'brother'],
    ['What did my mum say?', 'mother'],
    ['Cosa ha detto mia sorella?', 'sister'],
  ])('%s → %s', (question, key) => {
    expect(relationOf(question)).toContain(key);
  });

  it('matches whole words, and numbers in scripts without spaces only as whole numbers', () => {
    expect(containsPhrase('soniamo', 'son')).toBe(false);
    expect(containsPhrase(normalize('my son'), 'son')).toBe(true);
    expect(containsPhrase('11月', '1月')).toBe(false);
  });
});
