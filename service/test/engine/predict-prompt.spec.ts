// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { describe, expect, it } from 'vitest';
import { buildExtractionUser, type PromptContext } from '../../src/engine/extraction.prompt';
import { buildPredictUser, calibrationBlock, predictSchema } from '../../src/engine/predict.prompt';

const ctx: PromptContext = {
  selfNames: ['Luca'], gender: 'masculine', contacts: [], openQuestions: [], learnedSources: [], locale: 'it', messageDay: '2026-12-02',
  calendar: '', openPlans: ['P1: cena da Gigina giovedì 5'], currentFacts: [], currentNotes: [], knownEpisodes: [], knownSlots: [],
  messages: [{ n: 1, speaker: 'C1', sentAt: '2026-12-02 09:10', content: 'La cena slitta a venerdì.' }],
};

describe('predict, then extract the gap (H13 arm C, predict.v1)', () => {
  it('the prediction sees what I know and who speaks when, never the text', () => {
    const u = buildPredictUser(ctx);
    expect(u).toContain('P1: cena da Gigina giovedì 5');
    expect(u).toContain('[1] 2026-12-02 09:10 C1: …');
    expect(u).not.toContain('slitta');
  });

  it('the extraction input stays the same, the prediction comes after it as an expectation', () => {
    const block = calibrationBlock(['La cena di P1 è probabilmente ancora giovedì']);
    expect(`${buildExtractionUser(ctx)}\n\n${block}`.startsWith(buildExtractionUser(ctx))).toBe(true);
    expect(block).toContain('- La cena di P1 è probabilmente ancora giovedì');
    expect(block).toContain('never a source');
    expect(predictSchema.parse({ expected: 'x' })).toEqual({ expected: [] });
  });
});
