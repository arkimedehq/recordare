// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { describe, expect, it } from 'vitest';
import { composedSystem, ENTITY_SYSTEM, EXTRACTION_SYSTEM, type PromptContext, promptModules } from '../../src/engine/extraction.prompt';

const ctx = (over: Partial<PromptContext> = {}): PromptContext => ({
  selfNames: ['Luca'], gender: 'masculine', contacts: [], openQuestions: [], learnedSources: [], locale: 'it', messageDay: '2026-12-02',
  calendar: '', openPlans: [], currentFacts: [], currentNotes: [], knownEpisodes: [], knownSlots: [],
  messages: [{ n: 1, speaker: 'me', sentAt: '2026-12-02 09:10', content: 'Oggi mando la domanda.' }, { n: 2, speaker: 'me (assistant)', sentAt: '2026-12-02 09:10', content: 'Segnato.' }],
  ...over,
});

describe('composed extraction prompt (H13, compose.v1)', () => {
  it('keeps every part when the window can use them all: the same text as the full prompt', () => {
    const all = { plans: true, questions: true, known: true, others: true };
    expect(composedSystem(false, all)).toBe(EXTRACTION_SYSTEM);
    expect(composedSystem(true, all)).toBe(ENTITY_SYSTEM);
  });

  it('drops plan patches, answers, corrections of known items and others\' claims when the window has none of them', () => {
    const m = promptModules(ctx());
    expect(m).toEqual({ plans: false, questions: false, known: false, others: false });
    const p = composedSystem(false, m);
    expect(p).not.toContain('"plan_patches"');
    expect(p).not.toContain('"answers"');
    expect(p).not.toContain('KNOWN EPISODES and OPEN PLANS');
    expect(p).not.toContain('What another speaker claims ABOUT ME');
    expect(p).toContain('My own slips'); // in-window slips need nothing known
    expect(p.length).toBeLessThan(EXTRACTION_SYSTEM.length);
  });

  it('turns each part on from the window: open plans, open questions, known items, another speaker', () => {
    expect(promptModules(ctx({ openPlans: ['P1: …'] }))).toEqual({ plans: true, questions: false, known: true, others: false });
    expect(promptModules(ctx({ openQuestions: ['Q1: …'] })).questions).toBe(true);
    expect(promptModules(ctx({ currentFacts: ['F1: …'] })).known).toBe(true);
    expect(promptModules(ctx({ messages: [{ n: 1, speaker: 'Mehmet [C2]', sentAt: '', content: 'Ciao' }] })).others).toBe(true);
    expect(promptModules(ctx({ messages: [{ n: 1, speaker: 'me (own)', sentAt: '', content: 'Nota' }] })).others).toBe(false);
  });
});
