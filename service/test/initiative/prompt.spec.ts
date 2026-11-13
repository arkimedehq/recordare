// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/** initiative.v3 (D55 F2b): the local hours the model gives are kept only when they are a usable window. */
import { initiativeSchema, INITIATIVE_SYSTEM, INITIATIVE_VERSION } from '../../src/initiative/initiative.prompt';

describe('initiative.v3 hours', () => {
  const parse = (hours: unknown) => initiativeSchema.parse({ initiatives: [{ candidate: 'C1', text: 'x', worth: 0.8, hours }] }).initiatives[0]!.hours;

  it('keeps a pair of local hours at least three apart; anything else is no preference', () => {
    expect(parse([18, 22])).toEqual([18, 22]);
    expect(parse([9, 18])).toEqual([9, 18]);
    expect(parse([10, 11])).toBeNull(); // narrower than three hours
    expect(parse([22, 2])).toBeNull(); // across midnight: not asked for
    expect(parse(['evening'])).toBeNull();
    expect(parse(null)).toBeNull();
    expect(parse(undefined)).toBeNull();
  });

  it('asks for them in the prompt, versioned', () => {
    expect(INITIATIVE_VERSION).toBe('initiative.v5');
    expect(INITIATIVE_SYSTEM).toContain('"hours": [from, to]');
  });
});

describe('initiative.v4 days', () => {
  it('names a day relative to today only when the candidate is said today alone (an ask may be said days later)', () => {
    expect(INITIATIVE_SYSTEM).toContain('only when SAID is TODAY alone');
    // Its own examples hold no relative day either.
    expect(INITIATIVE_SYSTEM).not.toMatch(/"(Ieri|Domani)\b/);
    expect(INITIATIVE_SYSTEM).not.toContain('è oggi');
  });
});

describe('initiative.v5 what I read (8.16 F3)', () => {
  it('keeps where and when it was read, never as known for sure', () => {
    expect(INITIATIVE_SYSTEM).toContain('keep where and when I read it in the text');
    expect(INITIATIVE_SYSTEM).toContain('an "ask" says I have not checked it');
  });
});
