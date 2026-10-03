// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/** Time source; tests and the eval harness inject a fixed clock (questions "asked at" a date). */
export interface ClockPort {
  now(): Date;
}

export const CLOCK_PORT = Symbol('CLOCK_PORT');

export const systemClock: ClockPort = { now: () => new Date() };

export function fixedClock(at: Date): ClockPort {
  return { now: () => new Date(at.getTime()) };
}
