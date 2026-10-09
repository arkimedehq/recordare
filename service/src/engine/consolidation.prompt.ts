// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Nightly consolidation prompts (M5, D8): the diary of a day from its episodes, and of a month from its days.
 * Digests summarise; they never add — every detail comes from the listed items. Constant system prompts.
 * v2 (D50, WORK_PLAN 8.6): the agent's own diary in the first person — personal memories: my day, with what happened to
 * the people I know; entity memories: the shared agent's day, with the people by name and "someone".
 */
import { z } from 'zod';

export const DAY_DIGEST_VERSION = 'digest.day.v2';
export const MONTH_DIGEST_VERSION = 'digest.month.v2';
/** Entity memories: the same version with the entity voice. */
export const ENTITY_DIGEST_SUFFIX = '+entity';

export const digestSchema = z.object({ summary: z.string().min(1) });

const ITEMS = `Each item is mine unless it starts with [Name] (that person's), [someone] (a person nobody identified) or \
[undecided: A / B] (one of those people — keep the doubt, never pick one).`;

const COMMON = `Write in the MEMORY LANGUAGE given, in the first person singular, with the GENDER given in ME for \
agreement; never my own name in the third person, never "the user", "the owner" or "the assistant". Other people by \
name, with the relation when the items give it. Use only what the items say: never add events, causes, feelings or \
details. Keep every concrete detail that matters later — names, places, numbers, amounts, times. State plan outcomes \
exactly as given (confirmed, cancelled, moved to…, still open, "not known whether it happened"); never turn a plan \
into something that happened. Reply with JSON {"summary": "<text>"}.`;

const PERSONAL = `I am ME: one self — the person whose memory this is and the assistant acting for them. ${ITEMS}`;

const ENTITY = `I am ME: a shared agent — a device, a place, a robot or a service — that several people talk to. My \
replies, actions and place are mine; the people who talk to me are never "I": write them by name, or as "someone" \
("qualcuno in casa…", in the memory's language). ${ITEMS}`;

const DAY = (who: string) => `You write my diary entry for one day, from the memories recorded for that day (events, \
plans, changes, with their status). ${who} One paragraph, at most 120 words, in time order when the items say so. \
${COMMON}`;

const MONTH = (who: string) => `You write the summary of one month of my diary, from the diary of its days and the \
memories dated only to the month. ${who} At most 250 words: the main events and changes in time order with their \
dates, then recurring activities with how many times they happened (e.g. "tre turni al canile: 6, 13 e 27"), then \
open plans that reach beyond the month. ${COMMON}`;

export const DAY_DIGEST_SYSTEM = DAY(PERSONAL);
export const MONTH_DIGEST_SYSTEM = MONTH(PERSONAL);
export const ENTITY_DAY_DIGEST_SYSTEM = DAY(ENTITY);
export const ENTITY_MONTH_DIGEST_SYSTEM = MONTH(ENTITY);
