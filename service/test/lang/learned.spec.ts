// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { LOCALES } from '../../src/lang';
import { learnedSentence } from '../../src/lang/learned';

const AT = new Date('2026-10-10T09:00:00Z');

describe('the learning episode in every language (WORK_PLAN 8.9)', () => {
  it.each(LOCALES.map((l) => [l]))('%s: names the title and the giver, with a date', (locale) => {
    const s = learnedSentence(locale, AT, 'Europe/Rome', 'TITLE', 'Paolo', 'feminine');
    expect(s).toContain('TITLE');
    expect(s).toContain('Paolo');
    expect(s).toMatch(/2026|٢٠٢٦|২০২৬|۲۰۲۶|२०२६|2569|۱۴۰۵/); // the year, in the locale's digits or calendar (Thai 2569, Persian 1405)
    expect(learnedSentence(locale, AT, 'Europe/Rome', 'TITLE', null, 'masculine')).not.toContain('Paolo');
  });

  it('writes the first person with the memory\'s gender where the verb agrees, and falls back to English', () => {
    expect(learnedSentence('it', AT, 'Europe/Rome', 'Manuale della caldaia', 'Paolo', 'masculine')).toBe('Il 10 ottobre 2026 ho imparato «Manuale della caldaia», da Paolo.');
    expect(learnedSentence('it', new Date('2026-10-08T09:00:00Z'), 'Europe/Rome', 'X', null, 'masculine')).toBe("L'8 ottobre 2026 ho imparato «X».");
    expect(learnedSentence('it', new Date('2026-10-01T09:00:00Z'), 'Europe/Rome', 'X', null, 'masculine')).toBe('Il 1º ottobre 2026 ho imparato «X».');
    expect(learnedSentence('fr', new Date('2026-10-01T09:00:00Z'), 'Europe/Rome', 'X', null, 'masculine')).toBe("Le 1er octobre 2026, j'ai appris « X ».");
    expect(learnedSentence('ru', AT, 'Europe/Rome', 'X', null, 'feminine')).toContain('я изучила');
    expect(learnedSentence('ru', AT, 'Europe/Rome', 'X', null, 'masculine')).toContain('я изучил «');
    expect(learnedSentence('pl', AT, 'Europe/Rome', 'X', null, 'feminine')).toContain('nauczyłam się');
    expect(learnedSentence('uk', AT, 'Europe/Rome', 'X', null, 'neutral')).toContain('вивчив/вивчила');
    expect(learnedSentence('xx-YY', AT, 'Europe/Rome', 'X', null, 'masculine')).toMatch(/^On .*2026 I learned “X”\.$/);
  });
});
