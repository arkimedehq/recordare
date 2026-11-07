// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese
/** Timing v1 (D55 F4): what a person's outcomes teach — part of the day, the estimate from v0's prior, holding, the channel. */
import { acceptance, dayPart, experience, preferredChannel, shouldHold, withOthers } from '../../src/initiative/learning';
import { decideMoment, type MomentInput } from '../../src/initiative/initiative.service';

const outcomes = (n: number, status: string, localHour: number, channel: string) => Array.from({ length: n }, () => ({ status, localHour, channel }));

describe('timing v1 (F4)', () => {
  it('parts of the day', () => {
    expect([7, 8, 11, 12, 17, 18, 21, 22, 3].map(dayPart)).toEqual(['night', 'morning', 'morning', 'afternoon', 'afternoon', 'evening', 'evening', 'night', 'night']);
  });

  it('counts accepted and rejected outcomes, never a failed delivery', () => {
    const exp = experience([...outcomes(2, 'said', 9, 'voice'), ...outcomes(1, 'ignored', 10, 'voice'), ...outcomes(1, 'failed', 9, 'voice'),
      ...outcomes(1, 'declined', 19, 'messaging'), { status: 'said', localHour: 9, channel: null }]);
    expect(exp.get('morning|voice')).toEqual({ accepted: 2, rejected: 1 });
    expect(exp.get('evening|messaging')).toEqual({ accepted: 0, rejected: 1 });
    expect(exp.size).toBe(2);
  });

  it('starts from v0\'s guess and moves with the outcomes', () => {
    const none = experience([]);
    expect(acceptance(none, 'morning', 'voice', 0.7)).toEqual({ estimate: 0.7, outcomes: 0 });
    const ignored = experience(outcomes(3, 'ignored', 9, 'voice'));
    expect(acceptance(ignored, 'morning', 'voice', 0.7).estimate).toBeCloseTo(1.4 / 5);
    expect(acceptance(ignored, 'evening', 'voice', 0.7).estimate).toBe(0.7); // the evening is another part of the day
  });

  it('holds back only after enough outcomes say the person does not take it there', () => {
    expect(shouldHold(experience(outcomes(2, 'ignored', 9, 'voice')), 'morning', 'voice', 0.7)).toBe(false); // two are not enough
    expect(shouldHold(experience(outcomes(3, 'ignored', 9, 'voice')), 'morning', 'voice', 0.7)).toBe(true);
    expect(shouldHold(experience([...outcomes(3, 'ignored', 9, 'voice'), ...outcomes(3, 'said', 9, 'voice')]), 'morning', 'voice', 0.7)).toBe(false);
  });

  it('prefers another channel only when it is clearly better on outcomes of its own', () => {
    const exp = experience([...outcomes(3, 'ignored', 19, 'chat'), ...outcomes(3, 'said', 19, 'messaging')]);
    expect(preferredChannel(exp, 'evening', ['chat', 'messaging'], 1)).toBe('messaging');
    expect(preferredChannel(exp, 'morning', ['chat', 'messaging'], 1)).toBe('chat'); // nothing learnt there
    expect(preferredChannel(experience(outcomes(2, 'said', 19, 'messaging')), 'evening', ['chat', 'messaging'], 1)).toBe('chat'); // too few
    expect(preferredChannel(exp, 'evening', [], 1)).toBeNull();
  });

  it('the moment\'s decision takes the learnt fit in place of v0\'s fit of the hour', () => {
    const base: MomentInput = { kind: 'say', timing: 'flexible', worth: 0.7, owed: false, localHour: 10, preferred: [9, 21], deliveredToday: 0,
      sinceDueMs: 0, untilEndMs: 10 * 3_600_000 };
    expect(decideMoment(base)).toMatchObject({ deliver: true }); // v0: in hours
    expect(decideMoment({ ...base, fit: 0.28 })).toMatchObject({ deliver: false, reason: 'low' }); // v1: three ignored mornings
    expect(decideMoment({ ...base, localHour: 23, fit: 1 })).toMatchObject({ deliver: true }); // the fit replaces the hour's
  });

  it('timing v2 (F6): with company, what was given with others counts on its own key; without, with alone (v1 unchanged)', () => {
    const rows = [...outcomes(3, 'ignored', 15, 'voice').map((r) => ({ ...r, others: true })), ...outcomes(2, 'said', 15, 'voice')];
    expect(experience(rows).get('afternoon|voice')).toEqual({ accepted: 2, rejected: 3 });
    const exp = experience(rows, { company: true });
    expect(exp.get('afternoon|voice')).toEqual({ accepted: 2, rejected: 0 });
    expect(exp.get(`afternoon|${withOthers('voice')}`)).toEqual({ accepted: 0, rejected: 3 });
    expect(shouldHold(exp, 'afternoon', withOthers('voice'), 0.7)).toBe(true);
    expect(shouldHold(exp, 'afternoon', 'voice', 0.7)).toBe(false);
  });
});
