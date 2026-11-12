// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/** Contracts of procedures kept whole (WORK_PLAN 8.16 F2, D57). */
import { z } from 'zod';

export const MAX_STEPS = 30;
export const STEP_CHARS = 300;

const conversation = z.object({ externalId: z.string().min(1).max(200) }).optional()
  .describe('The conversation it happens in (who is speaking there is who taught it, corrected it or ran it).');

export const learnProcedureSchema = z.object({
  title: z.string().trim().min(1).max(300).describe('The task, as people name it ("make the bed").'),
  when: z.string().trim().max(500).optional().describe('When it is used, if it matters ("on Sundays, the guest room").'),
  steps: z.array(z.string().trim().min(1).max(STEP_CHARS)).min(1).max(MAX_STEPS).describe('The steps in order, as taught or read.'),
  from: z.enum(['page', 'person']).describe('page: read in a source, a page or a tool\'s output; person: taught by who is speaking.'),
  uri: z.string().max(2000).optional().describe('Where it was read (its site is the informant).'),
  sourceId: z.uuid().optional().describe('The learned source it comes from (learn_source), when there is one.'),
  conversation,
});
export type LearnProcedureRequest = z.infer<typeof learnProcedureSchema>;

export const procedureVariantSchema = z.object({
  step: z.number().int().min(1).max(MAX_STEPS).optional().describe('The step it changes; none: the whole task.'),
  text: z.string().trim().min(1).max(STEP_CHARS).describe('How it is done here ("the pillow goes over the bedspread").'),
  conversation,
});
export type ProcedureVariantRequest = z.infer<typeof procedureVariantSchema>;

export const procedureRunSchema = z.object({
  outcome: z.enum(['done', 'failed', 'corrected']),
  step: z.number().int().min(1).max(MAX_STEPS).optional().describe('failed / corrected: the step it happened at.'),
  note: z.string().trim().max(STEP_CHARS).optional().describe('failed: what went wrong; corrected: the right way (required).'),
  conversation,
}).refine((r) => r.outcome !== 'corrected' || !!r.note, { message: 'a correction needs its note (the right way)', path: ['note'] });
export type ProcedureRunRequest = z.infer<typeof procedureRunSchema>;
