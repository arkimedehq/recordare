// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/** Timing v0 (D55 F2a): the clock's cost-sensitive gate. */
import { decideMoment, type MomentInput, TIMING } from '../../src/initiative/initiative.service';

const base: MomentInput = { kind: 'ask', timing: 'flexible', worth: null, owed: false, localHour: 12, preferred: [10, 20], deliveredToday: 0, sinceDueMs: 0, untilEndMs: 86_400_000 };

describe('decideMoment', () => {
  it('a timed one goes at its time, within the grace, and not after', () => {
    expect(decideMoment({ ...base, kind: 'say', timing: 'timed', sinceDueMs: 60_000 })).toMatchObject({ p: 1, deliver: true, reason: 'timed' });
    expect(decideMoment({ ...base, kind: 'say', timing: 'timed', sinceDueMs: TIMING.timedPushGraceMs + 1 })).toMatchObject({ p: 0, deliver: false, reason: 'timed_missed' });
    expect(decideMoment({ ...base, kind: 'say', timing: 'timed', sinceDueMs: -1 })).toMatchObject({ deliver: false });
  });

  it('a flexible one when the hour suits it and the person has not had too much today', () => {
    expect(decideMoment(base)).toMatchObject({ p: TIMING.defaultPrior, threshold: TIMING.threshold.ask, deliver: true, reason: 'moment' });
    const early = decideMoment({ ...base, localHour: 8 });
    expect(early).toMatchObject({ deliver: false, reason: 'off_hours' });
    expect(early.p).toBeCloseTo(TIMING.defaultPrior * TIMING.offHoursFit);
    expect(decideMoment({ ...base, deliveredToday: 1 })).toMatchObject({ deliver: false, reason: 'low' });
    expect(decideMoment({ ...base, worth: 0.95, deliveredToday: 0 }).p).toBeCloseTo(0.95);
    // Preferred hours across midnight.
    expect(decideMoment({ ...base, preferred: [20, 2], localHour: 1 }).deliver).toBe(true);
  });

  it('an owed one (a request, a promise) at its last chance, even when the moment is poor', () => {
    const late = { ...base, kind: 'say' as const, owed: true, localHour: 7, untilEndMs: TIMING.lastChanceMs - 1 };
    expect(decideMoment(late)).toMatchObject({ deliver: true, reason: 'last_chance' });
    expect(decideMoment({ ...late, owed: false }).deliver).toBe(false);
  });
});
