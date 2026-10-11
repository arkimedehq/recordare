// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Experiment (RESEARCH_NOTES H13, arm C): predict, then extract the gap. The idea is Nemori's predict-calibrate
 * principle (Ma et al., arXiv:2508.03341), reimplemented: before reading a window the memory predicts, from what it
 * already knows and from who speaks when (never the text), what the window will tell; the extraction call then gets
 * the prediction, so what differs from it — a plan moved or cancelled, a correction, something new — stands out.
 * The extraction rules stay the same; one more call per window (`EXTRACTION_PREDICT`).
 */
import { z } from 'zod';
import { buildExtractionUser, type PromptContext } from './extraction.prompt';

export const PREDICT_PROMPT_VERSION = 'predict.v1';

export const PREDICT_SYSTEM = `You are the memory of an agent, written in its first person ("I"). A new conversation window is about to be read.
You see what I already know (open plans, current facts, notes, known episodes, the people I know) and who speaks when,
but not what they say. From what I know only, predict what this window most likely tells: which open plans are still
on and in what state, what is likely to come up with these people, what I expect to be true now.

Rules:
- 3 to 8 short statements, in the memory language, each concrete: names, dates, places and numbers taken from what I
  know; point to the items with their numbers (P1, F2, N3, E4).
- Never invent: a statement rests on what I know. When I know little about these people, write fewer statements.
- Expectations, not facts: "the dinner of P2 is probably still on Thursday", not "the dinner was moved".

Answer with JSON: {"expected": ["…", "…"]}`;

export const predictSchema = z.object({ expected: z.array(z.string()).max(12).catch([]) });

/** The extraction input with the messages' text left out: speakers and times only. */
export function buildPredictUser(ctx: PromptContext): string {
  return buildExtractionUser({ ...ctx, messages: ctx.messages.map((m) => ({ ...m, content: '…' })) })
    .replace('CONVERSATION WINDOW:', 'CONVERSATION WINDOW (who speaks when; the text is hidden):');
}

/** The block the extraction call gets after its input. */
export function calibrationBlock(expected: string[]): string {
  return [
    `WHAT I EXPECTED (predicted from my memory before reading the window; nobody said it):`,
    expected.map((e) => `- ${e}`).join('\n') || '(nothing)',
    '',
    `Compare the window with what I expected. What only confirms it adds nothing new. Where the window differs — a plan
moved, cancelled or done, something corrected (say who was wrong), a new person, place, number, group or event — that
is what the window teaches me: store each such difference, linked to the plan, fact or episode it changes. The
prediction is never a source: store only what the window says.`,
  ].join('\n');
}
