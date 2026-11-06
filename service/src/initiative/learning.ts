// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Timing v1 (D55 F4): what each person's outcomes teach about when and where to speak — no LLM. An initiative given and
 * taken (said, asked, done) is accepted; one ignored or declined is rejected; a failed delivery teaches nothing. Counted
 * per person, part of the day and channel, and read as a Beta–Bernoulli estimate whose prior is timing v0's own guess
 * (the fit of the hour), so a person with few outcomes keeps v0's behaviour and the estimate moves only as outcomes come.
 * Never touched by it: a time the person chose, the quiet hours, identity thresholds, the room rules of §5c.
 */

export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night';

/** Parts of the day, local hours: 8–12, 12–18, 18–22, otherwise night. */
export function dayPart(localHour: number): DayPart {
  if (localHour >= 8 && localHour < 12) return 'morning';
  if (localHour >= 12 && localHour < 18) return 'afternoon';
  if (localHour >= 18 && localHour < 22) return 'evening';
  return 'night';
}

export const ACCEPTED = ['said', 'asked', 'done'] as const;
export const REJECTED = ['ignored', 'declined'] as const;

export const LEARNING = {
  /** How many outcomes the prior (v0's guess) weighs: three or four outcomes start to outweigh it. */
  priorStrength: 2,
  /** Outcomes needed in a part of the day on a channel before it may hold anything back or change a channel. */
  minOutcomes: 3,
  /** Below this estimate, a flexible initiative is not spoken spontaneously there (it waits for a better moment). */
  holdBelow: 0.35,
  /** Another channel is preferred only when it is clearly better (by this margin) and has outcomes of its own. */
  switchMargin: 0.2,
  /** Only recent outcomes count: habits change. */
  windowDays: 60,
};

export interface Counts {
  accepted: number;
  rejected: number;
}

/** A person's experience: counts by part of the day and channel (`${part}|${channel}`). */
export type Experience = Map<string, Counts>;

/** Builds an experience from outcome rows (their status, the local hour they were given at, the channel). */
export function experience(rows: Array<{ status: string; localHour: number; channel: string | null }>): Experience {
  const exp: Experience = new Map();
  for (const r of rows) {
    if (!r.channel) continue;
    const accepted = (ACCEPTED as readonly string[]).includes(r.status);
    const rejected = (REJECTED as readonly string[]).includes(r.status);
    if (!accepted && !rejected) continue;
    const key = `${dayPart(r.localHour)}|${r.channel}`;
    const c = exp.get(key) ?? { accepted: 0, rejected: 0 };
    if (accepted) c.accepted++; else c.rejected++;
    exp.set(key, c);
  }
  return exp;
}

/** How likely an initiative is taken at this part of the day on this channel, starting from v0's `prior` (0–1). */
export function acceptance(exp: Experience, part: DayPart, channel: string, prior: number): { estimate: number; outcomes: number } {
  const c = exp.get(`${part}|${channel}`) ?? { accepted: 0, rejected: 0 };
  const outcomes = c.accepted + c.rejected;
  const k = LEARNING.priorStrength;
  return { estimate: (c.accepted + k * prior) / (outcomes + k), outcomes };
}

/** Whether to hold a flexible initiative back here and now: the person has shown, often enough, they do not take it. */
export function shouldHold(exp: Experience, part: DayPart, channel: string, prior: number): boolean {
  const a = acceptance(exp, part, channel, prior);
  return a.outcomes >= LEARNING.minOutcomes && a.estimate < LEARNING.holdBelow;
}

/**
 * The channel to use among the acceptable ones (in their order): the first, unless another is clearly better at this
 * part of the day on the person's own outcomes.
 */
export function preferredChannel(exp: Experience, part: DayPart, channels: string[], prior: number): string | null {
  if (!channels.length) return null;
  const first = channels[0]!;
  const base = acceptance(exp, part, first, prior).estimate;
  let best = first;
  let bestEstimate = base;
  for (const ch of channels.slice(1)) {
    const a = acceptance(exp, part, ch, prior);
    if (a.outcomes >= LEARNING.minOutcomes && a.estimate >= base + LEARNING.switchMargin && a.estimate > bestEstimate) {
      best = ch;
      bestEstimate = a.estimate;
    }
  }
  return best;
}
