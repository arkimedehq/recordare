// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Dates in the owner's timezone. Coarse dates are stored as the start of their period in that
 * timezone, with a precision (docs/DATA_MODEL.md → Time); calendars help models resolve
 * "sabato" / "last Friday" against the message time (spike finding).
 */
export type Precision = 'minute' | 'day' | 'month' | 'year' | 'approximate' | 'unknown';

const WEEKDAYS: Record<string, string[]> = {
  it: ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'],
  en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
};

/** Offset (ms) of `tz` at instant `d`: local wall time − UTC. */
function tzOffsetMs(d: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - d.getTime();
}

/** Midnight of a local calendar date (YYYY-MM-DD) in `tz`, as an instant. */
export function zonedMidnight(isoDate: string, tz: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  const guess = new Date(Date.UTC(y, m - 1, d));
  return new Date(guess.getTime() - tzOffsetMs(guess, tz));
}

/** Local calendar date (YYYY-MM-DD) of an instant in `tz`. */
export function localDate(d: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function weekdayIndex(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // Monday = 0
}

export function addDays(isoDate: string, n: number): string {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function weekdayName(isoDate: string, locale: string): string {
  return (WEEKDAYS[locale] ?? WEEKDAYS['en'] as string[])[weekdayIndex(isoDate)] as string;
}

/** Explicit weekday → date table around `ref`. */
export function calendar(ref: string, back: number, ahead: number, locale: string): string {
  const rows: string[] = [];
  for (let i = -back; i <= ahead; i++) {
    const day = addDays(ref, i);
    rows.push(`${weekdayName(day, locale)} ${day}${i === 0 ? '  ← message day' : ''}`);
  }
  return rows.join('\n');
}

/** Model date ("YYYY-MM-DD" | "YYYY-MM" | "YYYY") → stored instant + precision. */
export function toStored(value: string | null | undefined, precision: Precision | undefined, tz: string): { at: Date | null; precision: Precision } {
  if (!value) return { at: null, precision: 'unknown' };
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return { at: zonedMidnight(v.slice(0, 10), tz), precision: precision && precision !== 'unknown' ? precision : 'day' };
  if (/^\d{4}-\d{2}$/.test(v)) return { at: zonedMidnight(`${v}-01`, tz), precision: 'month' };
  if (/^\d{4}$/.test(v)) return { at: zonedMidnight(`${v}-01-01`, tz), precision: 'year' };
  return { at: null, precision: 'unknown' };
}

/** End (exclusive) of the period that starts at `at` with `precision`, in `tz`. */
export function periodEnd(at: Date, precision: Precision, tz: string): Date {
  const day = localDate(at, tz);
  if (precision === 'year') return zonedMidnight(`${Number(day.slice(0, 4)) + 1}-01-01`, tz);
  if (precision === 'month') {
    const [y, m] = day.split('-').map(Number) as [number, number];
    return zonedMidnight(m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`, tz);
  }
  return zonedMidnight(addDays(day, 1), tz);
}

/** Human-readable date with precision, in the owner's language. */
export function describe(at: Date | null, precision: Precision, tz: string, locale: string): string {
  if (!at) return locale === 'it' ? 'data ignota' : 'unknown date';
  const day = localDate(at, tz);
  if (precision === 'year') return day.slice(0, 4);
  if (precision === 'month') return day.slice(0, 7);
  const base = `${weekdayName(day, locale)} ${day}`;
  return precision === 'approximate' ? `${locale === 'it' ? 'circa' : 'about'} ${base}` : base;
}
