// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { canonicalLocale, LOCALES, messages } from '../../src/lang';
import { describe as describeDate, weekdayName } from '../../src/engine/time';
import { createMemorySchema, updateMemorySchema } from '../../src/admin/admin.schemas';

describe('the service\'s sentences in every language (WORK_PLAN 2.6)', () => {
  it.each(LOCALES.map((l) => [l]))('%s: every sentence, with the names it is given', (locale) => {
    const m = messages(locale);
    for (const s of [m.factsUnknown, m.plansUnresolved, m.correctedExcerpts, m.passages, m.unknownDate]) expect(s.trim()).not.toBe('');
    expect(m.speakerContact('SPEAKER', 'ME')).toContain('SPEAKER');
    expect(m.speakerContact('SPEAKER', 'ME')).toContain('ME');
    for (const f of [m.speakerSomeone, m.claims, m.othersExcerpts]) expect(f('ME')).toContain('ME');
    expect(m.claims('ME')).toContain('claimedBy');
    expect(m.correctedExcerpts).toContain('correctedBy');
    expect(m.othersExcerpts('ME')).toContain('author');
    expect(m.about('DATE')).toContain('DATE');
    const q = m.sameContact('NAME', 'DAY', 'KNOWN');
    for (const part of ['NAME', 'DAY', 'KNOWN']) expect(q).toContain(part);
    if (locale !== 'en') expect(m.factsUnknown).not.toBe(messages('en').factsUnknown);
  });

  it('a regional locale uses its language; a language not listed falls back to English', () => {
    expect(messages('it-IT')).toBe(messages('it'));
    expect(messages('pt_BR')).toBe(messages('pt'));
    expect(messages('xx-YY')).toBe(messages('en'));
    expect(messages('it').speakerSomeone('Anna')).toBe('chi chiede non si è identificato: "io" nella domanda è chi parla, non io (Anna); i ricordi in prima persona sono miei');
    expect(messages('it').sameContact('Giulia', '8 ottobre', 'Giulia (sorella)')).toBe("Giulia, che ha scritto l'8 ottobre, è la stessa persona di Giulia (sorella)?");
    expect(messages('it').sameContact('Giulia', '9 ottobre', 'Giulia (sorella)')).toBe('Giulia, che ha scritto il 9 ottobre, è la stessa persona di Giulia (sorella)?');
  });

  it('weekday names and dates come from Intl for any locale', () => {
    const monday = '2026-10-05';
    expect(weekdayName(monday, 'it')).toBe('lunedì');
    expect(weekdayName(monday, 'it-IT')).toBe('lunedì');
    expect(weekdayName(monday, 'en')).toBe('Monday');
    expect(weekdayName(monday, 'de')).toBe('Montag');
    expect(weekdayName(monday, 'ja')).toBe('月曜日');
    expect(weekdayName(monday, 'not a locale')).toBe('Monday');
    const at = new Date('2026-10-05T10:00:00Z');
    expect(describeDate(at, 'approximate', 'Europe/Rome', 'it-IT')).toBe('circa lunedì 2026-10-05');
    expect(describeDate(at, 'approximate', 'Europe/Rome', 'es')).toBe('aproximadamente lunes 2026-10-05');
    expect(describeDate(null, 'unknown', 'Europe/Rome', 'fr')).toBe('date inconnue');
  });

  it('a memory\'s language is any BCP 47 locale, stored canonical', () => {
    expect(canonicalLocale('pt-br')).toBe('pt-BR');
    expect(canonicalLocale('not a locale')).toBeUndefined();
    expect(createMemorySchema.parse({ displayName: 'A' }).locale).toBe('it');
    expect(createMemorySchema.parse({ displayName: 'A', locale: 'de-de' }).locale).toBe('de-DE');
    expect(updateMemorySchema.parse({ locale: 'ja' }).locale).toBe('ja');
    expect(createMemorySchema.safeParse({ displayName: 'A', locale: 'not a locale' }).success).toBe(false);
  });
});
