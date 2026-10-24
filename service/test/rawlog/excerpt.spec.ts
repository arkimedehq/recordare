// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { bestExcerpt, queryWords } from '../../src/rawlog/excerpt';

const filler = (n: number, s: string) => Array.from({ length: n }, (_, i) => `${s} ${i + 1}.`).join(' ');

describe('bestExcerpt (D30: the passage of a long message that answers the query)', () => {
  it('keeps a short message whole', () => {
    expect(bestExcerpt('Ciao, tutto bene.', 'omelette', 400)).toBe('Ciao, tutto bene.');
  });

  it('shows the sentences holding the query words, not the start (English)', () => {
    const reply = `${filler(30, 'Heat the pan slowly and keep it at a medium temperature for step')} For a classic French omelette you need 2-3 eggs, beaten with a pinch of salt. ${filler(20, 'Serve warm, folding it in three for step')}`;
    const out = bestExcerpt(reply, 'how many eggs did you say for the French omelette?', 400);
    expect(out).toContain('2-3 eggs');
    expect(out.startsWith('…')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(402);
  });

  it('folds accents and finds a longer form of a word (Italian)', () => {
    const reply = `${filler(30, 'Il seco de cordero si cuoce piano, passo')} Per la birra ti consiglio una Pilsner o una Lager, leggere e poco amare. ${filler(10, 'Servi con riso bianco, passo')}`;
    expect(bestExcerpt(reply, 'Quale birra mi avevi consigliato per il Seco de Cordero?', 300)).toContain('Pilsner');
    expect(queryWords('Perché raccomandato?')).toEqual(['perc', 'raccomanda']);
  });

  it('works in a script without spaces (Japanese)', () => {
    const reply = `${'東京の天気は晴れです。'.repeat(40)}ティーツリーオイルはキャリアオイルで十倍に薄めてください。${'京都の紅葉はきれいです。'.repeat(20)}`;
    expect(bestExcerpt(reply, 'ティーツリーオイル 薄め', 200)).toContain('十倍');
  });

  it('shows the answer after a heading ending in a colon (the run is filled with the sentences after it)', () => {
    const reply = `${filler(12, 'Start with the basics of web development, part')} 2. Learn a back-end programming language: once you know the front end, learn a back-end programming language such as Ruby, Python or PHP. ${filler(12, 'Build projects and join a community, part')}`;
    expect(bestExcerpt(reply, 'back-end programming languages recommended', 400)).toContain('Ruby, Python or PHP');
  });

  it('keeps the start when no word of the query is in the message', () => {
    const reply = filler(60, 'Nothing about it here, line');
    expect(bestExcerpt(reply, 'zebra', 100)).toBe(`${reply.slice(0, 100)}…`);
  });
});
