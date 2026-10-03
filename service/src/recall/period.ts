// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Deterministic period resolver (D12): common Italian / English period expressions → inclusive
 * date range in the owner's calendar, so small agent models never compute calendars themselves.
 * Weeks are Monday-based. Unknown expressions return null (the agent passes dates instead).
 */
import { addDays, weekdayIndex } from '../engine/time';

export interface Period {
  from: string; // YYYY-MM-DD, inclusive
  to: string;   // YYYY-MM-DD, inclusive
  label: string;
}

const MONTHS: Record<string, number> = {
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6, luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

const pad = (n: number) => String(n).padStart(2, '0');

function monthRange(year: number, month: number): Period {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(last)}`, label: `${year}-${pad(month)}` };
}

/** @param today local date of "now" in the owner's timezone (YYYY-MM-DD). */
export function resolvePeriod(expression: string, today: string): Period | null {
  const e = expression.toLowerCase().normalize('NFC').replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
  const [y, m] = today.split('-').map(Number) as [number, number];
  const monday = addDays(today, -weekdayIndex(today));
  const has = (...words: string[]) => words.some((w) => e.includes(w));

  if (has('oggi', 'today')) return { from: today, to: today, label: today };
  if (has("l'altro ieri", 'altroieri', 'day before yesterday')) { const d = addDays(today, -2); return { from: d, to: d, label: d }; }
  if (has('ieri', 'yesterday')) { const d = addDays(today, -1); return { from: d, to: d, label: d }; }
  if (has('settimana scorsa', 'scorsa settimana', 'last week', 'previous week')) {
    return { from: addDays(monday, -7), to: addDays(monday, -1), label: 'last week' };
  }
  if (has('questa settimana', 'this week')) return { from: monday, to: today, label: 'this week' };
  if (has('mese scorso', 'scorso mese', 'last month')) return m === 1 ? monthRange(y - 1, 12) : monthRange(y, m - 1);
  if (has('questo mese', 'this month')) return { ...monthRange(y, m), to: today };
  if (has("anno scorso", "l'anno passato", 'last year')) return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31`, label: String(y - 1) };
  if (has("quest'anno", 'questo anno', 'this year')) return { from: `${y}-01-01`, to: today, label: String(y) };
  if (has("quest'inverno", 'questo inverno', 'this winter')) {
    const startYear = m >= 12 ? y : y - 1;
    return { from: `${startYear}-12-01`, to: today, label: 'this winter' };
  }
  if (has("quest'estate", 'questa estate', 'this summer')) return { from: `${m >= 6 ? y : y - 1}-06-01`, to: m >= 6 && m <= 9 ? today : `${m >= 6 ? y : y - 1}-09-30`, label: 'this summer' };

  for (const [name, month] of Object.entries(MONTHS)) {
    if (!new RegExp(`\\b${name}\\b`).test(e)) continue;
    const yearMatch = /\b(19|20)\d{2}\b/.exec(e);
    if (yearMatch) return monthRange(Number(yearMatch[0]), month);
    // A month name without a year = its most recent occurrence not after today.
    const year = month <= m ? y : y - 1;
    const r = monthRange(year, month);
    return month === m ? { ...r, to: today } : r;
  }
  return null;
}
