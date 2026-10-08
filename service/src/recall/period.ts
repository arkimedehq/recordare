// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Deterministic period resolver (D12): common period expressions in the supported languages (src/lang) → inclusive
 * date range in the owner's calendar, so small agent models never compute calendars themselves.
 * Weeks are Monday-based. Unknown expressions return null (the agent passes dates instead).
 */
import { addDays, weekdayIndex } from '../engine/time';
import { containsPhrase, MONTH_NAMES, normalize, type PeriodKey, periodPhrases } from '../lang';

export interface Period {
  from: string; // YYYY-MM-DD, inclusive
  to: string;   // YYYY-MM-DD, inclusive
  label: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

function monthRange(year: number, month: number): Period {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(last)}`, label: `${year}-${pad(month)}` };
}

/** @param today local date of "now" in the owner's timezone (YYYY-MM-DD). */
export function resolvePeriod(expression: string, today: string): Period | null {
  const e = normalize(expression);
  const [y, m] = today.split('-').map(Number) as [number, number];
  const monday = addDays(today, -weekdayIndex(today));
  const has = (key: PeriodKey) => periodPhrases(key).some((p) => containsPhrase(e, p));

  if (has('today')) return { from: today, to: today, label: today };
  if (has('dayBeforeYesterday')) { const d = addDays(today, -2); return { from: d, to: d, label: d }; }
  if (has('yesterday')) { const d = addDays(today, -1); return { from: d, to: d, label: d }; }
  if (has('lastWeek')) return { from: addDays(monday, -7), to: addDays(monday, -1), label: 'last week' };
  if (has('thisWeek')) return { from: monday, to: today, label: 'this week' };
  if (has('lastMonth')) return m === 1 ? monthRange(y - 1, 12) : monthRange(y, m - 1);
  if (has('thisMonth')) return { ...monthRange(y, m), to: today };
  if (has('lastYear')) return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31`, label: String(y - 1) };
  if (has('thisYear')) return { from: `${y}-01-01`, to: today, label: String(y) };
  if (has('thisWinter')) {
    const startYear = m >= 12 ? y : y - 1;
    return { from: `${startYear}-12-01`, to: today, label: 'this winter' };
  }
  if (has('thisSummer')) return { from: `${m >= 6 ? y : y - 1}-06-01`, to: m >= 6 && m <= 9 ? today : `${m >= 6 ? y : y - 1}-09-30`, label: 'this summer' };

  for (const [name, month] of MONTH_NAMES) {
    if (!containsPhrase(e, name)) continue;
    const yearMatch = /(?<!\d)(19|20)\d{2}(?!\d)/.exec(e);
    if (yearMatch) return monthRange(Number(yearMatch[0]), month);
    // A month name without a year = its most recent occurrence not after today.
    const year = month <= m ? y : y - 1;
    const r = monthRange(year, month);
    return month === m ? { ...r, to: today } : r;
  }
  return null;
}
