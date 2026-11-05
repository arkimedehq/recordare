// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { containsPhrase, LOCALES, normalize, periodPhrases, RELATION_GROUPS, saysRelativeDay } from '../../src/lang';

const relationOf = (question: string) => RELATION_GROUPS.filter((g) => g.words.some((w) => containsPhrase(normalize(question), w))).map((g) => g.key);

describe('language data (memory\'s rule: all languages, at least the most used)', () => {
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

  it('finds a day named relative to now in every locale (Intl), and not a weekday, a date or a longer word', () => {
    for (const locale of LOCALES) {
      const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
      for (const n of [-1, 0, 1]) {
        const word = rtf.format(n, 'day');
        if (!/\d/.test(word)) expect([locale, n, saysRelativeDay(`x ${word} x`)]).toEqual([locale, n, true]);
      }
    }
    expect(saysRelativeDay("Ieri avevi la verifica di geometria: com'è andata?")).toBe(true);
    expect(saysRelativeDay("L'altro ieri avevi il dentista.")).toBe(true);
    expect(saysRelativeDay('明天下午三点开会')).toBe(true);
    expect(saysRelativeDay("Martedì avevi la verifica di geometria: com'è andata?")).toBe(false);
    expect(saysRelativeDay('On 3 November you had the test.')).toBe(false);
    expect(saysRelativeDay("Hai preso l'oggetto?")).toBe(false);
  });
});
