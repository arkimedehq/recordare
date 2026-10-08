// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Period phrases and month names in every locale of LOCALES: Intl gives "today", "yesterday", "the day before
 * yesterday", "last / this week | month | year" and the month names; the table below adds what Intl has not (common
 * synonyms, seasons). Built once at start-up.
 */
import { LOCALES, normalize } from './locales';
import { type PeriodKey } from './types';

/** Synonyms and seasons Intl does not give, by language. */
const EXTRA: Record<string, Partial<Record<PeriodKey, string[]>>> = {
  en: { dayBeforeYesterday: ['day before yesterday'], lastWeek: ['previous week'], thisWinter: ['this winter'], thisSummer: ['this summer'] },
  it: { dayBeforeYesterday: ["l'altro ieri", 'altroieri'], lastWeek: ['scorsa settimana'], lastMonth: ['scorso mese'],
    lastYear: ["l'anno passato"], thisYear: ['questo anno'], thisWinter: ["quest'inverno", 'questo inverno'], thisSummer: ["quest'estate", 'questa estate'] },
  es: { thisWinter: ['este invierno'], thisSummer: ['este verano'] },
  fr: { thisWinter: ['cet hiver'], thisSummer: ['cet été'] },
  de: { lastWeek: ['vergangene woche'], thisWinter: ['diesen winter'], thisSummer: ['diesen sommer'] },
  pt: { thisWinter: ['este inverno'], thisSummer: ['este verão'] },
  ru: { thisWinter: ['этой зимой'], thisSummer: ['этим летом'] },
  zh: { thisWinter: ['今年冬天'], thisSummer: ['今年夏天'] },
  ja: { thisWinter: ['今年の冬'], thisSummer: ['今年の夏'] },
};

function intlPeriods(locale: string): Partial<Record<PeriodKey, string[]>> {
  const r = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const f = (n: number, unit: Intl.RelativeTimeFormatUnit) => normalize(r.format(n, unit));
  const auto = (n: number, unit: Intl.RelativeTimeFormatUnit) => {
    const s = f(n, unit);
    // numeric:'auto' falls back to "2 days ago" where the language has no word for it: no phrase then.
    return /\d/.test(s) ? [] : [s];
  };
  return {
    today: auto(0, 'day'), yesterday: auto(-1, 'day'), dayBeforeYesterday: auto(-2, 'day'),
    lastWeek: auto(-1, 'week'), thisWeek: auto(0, 'week'), lastMonth: auto(-1, 'month'), thisMonth: auto(0, 'month'),
    lastYear: auto(-1, 'year'), thisYear: auto(0, 'year'),
  };
}

const PHRASES = new Map<PeriodKey, string[]>();
for (const locale of LOCALES) {
  const add = (from: Partial<Record<PeriodKey, string[]>> | undefined) => {
    for (const [k, list] of Object.entries(from ?? {}) as Array<[PeriodKey, string[]]>) {
      const all = PHRASES.get(k) ?? PHRASES.set(k, []).get(k)!;
      for (const p of list.map(normalize)) if (p && !all.includes(p)) all.push(p);
    }
  };
  add(intlPeriods(locale));
  add(EXTRA[locale]);
}
// Longest first: "l'altro ieri" must win over "ieri", "day before yesterday" over "yesterday".
for (const list of PHRASES.values()) list.sort((a, b) => b.length - a.length);

/** Every phrase for a period, in all supported languages, longest first. */
export const periodPhrases = (key: PeriodKey): readonly string[] => PHRASES.get(key) ?? [];

/** Month names (long and, where distinct, short forms) in all languages → 1..12, longest first. */
export const MONTH_NAMES: ReadonlyArray<readonly [string, number]> = (() => {
  const out = new Map<string, number>();
  for (const locale of LOCALES) {
    for (const month of ['long', 'short'] as const) {
      const fmt = new Intl.DateTimeFormat(locale, { month, timeZone: 'UTC' });
      for (let m = 1; m <= 12; m++) {
        const name = normalize(fmt.format(new Date(Date.UTC(2026, m - 1, 15)))).replace(/\.$/, '');
        // Short forms of 3 letters or less ("mar", "may" vs "mai") are too ambiguous in running text.
        if (name && !/^\d+$/.test(name) && (month === 'long' || [...name].length > 3) && !out.has(name)) out.set(name, m);
      }
    }
  }
  return [...out].sort((a, b) => b[0].length - a[0].length);
})();
