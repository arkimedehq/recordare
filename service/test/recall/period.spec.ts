// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { resolvePeriod } from '../../src/recall/period';

describe('resolvePeriod (all supported languages, Monday-based weeks)', () => {
  const cases: Array<[string, string, string | null, string | null]> = [
    // expression, today, from, to
    ['Cosa ho fatto questa settimana?', '2026-02-21', '2026-02-16', '2026-02-21'],
    ['la settimana scorsa', '2026-03-12', '2026-03-02', '2026-03-08'],
    ['What did I do last week?', '2027-02-10', '2027-02-01', '2027-02-07'],
    ['Cosa ho fatto a febbraio?', '2026-04-01', '2026-02-01', '2026-02-28'],
    ['lo scorso dicembre', '2027-02-20', '2026-12-01', '2026-12-31'],
    ['marzo 2026', '2027-01-01', '2026-03-01', '2026-03-31'],
    ["quest'inverno", '2026-04-01', '2025-12-01', '2026-04-01'],
    ['ieri', '2026-01-01', '2025-12-31', '2025-12-31'],
    ['il mese scorso', '2026-01-15', '2025-12-01', '2025-12-31'],
    ["quest'anno", '2026-10-03', '2026-01-01', '2026-10-03'],
    ['quando sono andato a sciare', '2026-04-01', null, null],
    // Other languages: phrases from Intl, plus the tables in src/lang.
    ['¿Qué hice ayer?', '2026-10-08', '2026-10-07', '2026-10-07'],
    ['anteayer', '2026-10-08', '2026-10-06', '2026-10-06'],
    ["Qu'est-ce que j'ai fait la semaine dernière ?", '2026-10-08', '2026-09-28', '2026-10-04'],
    ['Was habe ich letzte Woche gemacht?', '2026-10-08', '2026-09-28', '2026-10-04'],
    ['o que fiz no mês passado', '2026-10-08', '2026-09-01', '2026-09-30'],
    ['что я делал вчера', '2026-10-08', '2026-10-07', '2026-10-07'],
    ['我上周做了什么', '2026-10-08', '2026-09-28', '2026-10-04'],
    ['先月何をしましたか', '2026-10-08', '2026-09-01', '2026-09-30'],
    ['어제 뭐 했어?', '2026-10-08', '2026-10-07', '2026-10-07'],
    ['मैंने पिछला सप्ताह क्या किया', '2026-10-08', '2026-09-28', '2026-10-04'],
    ['ماذا فعلت الأسبوع الماضي', '2026-10-08', '2026-09-28', '2026-10-04'],
    ['geçen ay ne yaptım', '2026-10-08', '2026-09-01', '2026-09-30'],
    ['marzo de 2025', '2026-10-08', '2025-03-01', '2025-03-31'],
    ['im März 2025', '2026-10-08', '2025-03-01', '2025-03-31'],
    ['en septembre', '2026-10-08', '2026-09-01', '2026-09-30'],
    ['11月に', '2026-12-20', '2026-11-01', '2026-11-30'],
    ['一月', '2026-10-08', '2026-01-01', '2026-01-31'],
    ['十一月', '2026-12-20', '2026-11-01', '2026-11-30'],
  ];
  it.each(cases)('%s (today %s)', (expr, today, from, to) => {
    const r = resolvePeriod(expr, today);
    if (from === null) expect(r).toBeNull();
    else expect(r).toMatchObject({ from, to });
  });
});
