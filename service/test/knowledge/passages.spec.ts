// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { splitPassages } from '../../src/knowledge/passages';

describe('passages of a learned source (WORK_PLAN 8.9)', () => {
  it('splits by headings and paragraphs, keeping the heading of each passage', () => {
    const text = '# Caldaia\n\nLa caldaia va revisionata ogni due anni.\n\n## Reset\nPremere il tasto rosso per 5 secondi.\n\nPoi attendere.';
    expect(splitPassages(text)).toEqual([
      { heading: 'Caldaia', content: 'La caldaia va revisionata ogni due anni.' },
      { heading: 'Reset', content: 'Premere il tasto rosso per 5 secondi.\n\nPoi attendere.' },
    ]);
  });

  it('keeps every passage under the maximum, cutting long paragraphs at sentences and long sentences at spaces', () => {
    const sentence = 'Questa è una frase di prova abbastanza lunga per riempire il testo. ';
    const text = `${sentence.repeat(80)}\n\n${'parola '.repeat(600)}`;
    const passages = splitPassages(text);
    expect(passages.length).toBeGreaterThan(4);
    expect(passages.every((p) => p.content.length <= 1_600)).toBe(true);
    expect(passages.map((p) => p.content).join(' ').replace(/\s+/g, ' ').trim()).toBe(text.replace(/\s+/g, ' ').trim());
  });

  it('splits scripts without spaces at their sentence marks', () => {
    const text = '锅炉每两年检修一次。'.repeat(300);
    const passages = splitPassages(text);
    expect(passages.length).toBeGreaterThan(1);
    expect(passages.every((p) => p.content.length <= 1_600 && p.content.endsWith('。'))).toBe(true);
  });
});
