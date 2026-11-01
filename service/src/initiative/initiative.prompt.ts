// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * The wording and the worth of an initiative (D53, WORK_PLAN 8.12c; profiles balanced and full — economy says the
 * service's own sentences, `lang/initiative.ts`). Once a day's due intents are known, one call words each as the agent
 * would say it — in the first person, in the memory's language, with its reason — and weighs whether it is worth saying
 * now (Horvitz's mixed initiative: value against the cost of interrupting; the model sees the value, the code the rest:
 * presence is the host's, quiet hours and the daily limit are the service's). A candidate not worth it is dropped, not
 * postponed: no nagging.
 */
import { z } from 'zod';

export const INITIATIVE_VERSION = 'initiative.v1';

export const INITIATIVE_SYSTEM = `You word what an agent's memory decided to say on its own, and weigh whether it is \
worth saying. I am ME: the agent (in a personal memory, one self with the person whose memory this is). You get ME, \
MEMORY LANGUAGE, TODAY and the CANDIDATES (C-numbers): each with its kind — "ask" (a plan of theirs past its date: did \
it happen?), "say" (a reminder: a plan coming up, a promise I made, a request they made to me), "lookup" (a question I \
hold, for the agent that hosts me to find out) —, whom it is for (FOR; "holder" is the person whose memory this is, \
"anyone" whoever is there), WHAT (the plan, promise, request or question as the memory holds it), WHEN (its date) and \
SOURCE (the memory it comes from).

For each candidate:
- "text": one or two short sentences, as I would say them to that person, in MEMORY LANGUAGE, first person, natural, \
with the reason in it ("Ieri avevi in programma di portare la macchina dal meccanico: è andata?"; "Domani alle 15 hai \
il dentista."; "Mi avevi chiesto di ricordarti di chiamare il commercialista: è oggi."). A "lookup" is for the host \
agent, not a person: state what to find out ("Cerca se Marta ha prenotato il volo per Lisbona.").
- "worth": 0 to 1 — how much it is worth saying now: a date near or just passed that matters to them, something they \
asked for: high; small, long past, something they surely know or already settled: low.
- "skip": true when it should not be said at all (it makes no sense, it would only annoy, the matter is clearly \
closed). Never skip a request they made or a promise I made: those are owed.
- Keep every detail true to WHAT and WHEN; add nothing.

Output JSON only: {"initiatives": [{"candidate", "text", "worth", "skip"}]}`;

export const initiativeSchema = z.object({
  initiatives: z.array(z.object({
    candidate: z.union([z.number().int(), z.string()]),
    text: z.string().max(1_000).nullable().optional(),
    worth: z.number().min(0).max(1).catch(0.5),
    skip: z.boolean().default(false),
  })).default([]),
});
export type InitiativeOutput = z.infer<typeof initiativeSchema>;
