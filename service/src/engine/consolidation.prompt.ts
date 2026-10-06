// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Nightly consolidation prompts (M5, D8): the diary of a day from its episodes, and of a month from its days.
 * Digests summarise; they never add — every detail comes from the listed items. Constant system prompts.
 */
import { z } from 'zod';

export const DAY_DIGEST_VERSION = 'digest.day.v1';
export const MONTH_DIGEST_VERSION = 'digest.month.v1';

export const digestSchema = z.object({ summary: z.string().min(1) });

const COMMON = `Write in the OWNER LANGUAGE given, in the third person about the owner by name. Use only what the \
items say: never add events, causes, feelings or details. Keep every concrete detail that matters later — names, \
places, numbers, amounts, times. State plan outcomes exactly as given (confirmed, cancelled, moved to…, still open, \
"not known whether it happened"); never turn a plan into something that happened. Reply with JSON {"summary": "<text>"}.`;

export const DAY_DIGEST_SYSTEM = `You write the diary entry of one day of a person's life for a personal memory \
service, from the memories recorded for that day (events, plans, changes, with their status). One paragraph, at most \
120 words, in time order when the items say so. ${COMMON}`;

export const MONTH_DIGEST_SYSTEM = `You write the summary of one month of a person's life for a personal memory \
service, from the diary of its days and the memories dated only to the month. At most 250 words: the main events and \
changes in time order with their dates, then recurring activities with how many times they happened (e.g. "three \
shifts at the shelter: 6, 13 and 27"), then open plans that reach beyond the month. ${COMMON}`;
