// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * The wording and the worth of an initiative (D53, WORK_PLAN 8.12c; profiles balanced and full — economy says the
 * service's own sentences, `lang/initiative.ts`). Once a day's due intents are known, one call words each as the agent
 * would say it — in the first person, in the memory's language, with its reason — and weighs whether it is worth saying
 * now (Horvitz's mixed initiative: value against the cost of interrupting; the model sees the value, the code the rest:
 * presence is the host's, quiet hours and the daily limit are the service's). A candidate not worth it is dropped, not
 * postponed: no nagging. v2: no ask about a date that happens on its own (a birthday, a deadline); no judgement of the
 * person in a reminder. v3 (D55 F2b): the local hours when saying it would be natural (an evening plan asked about in
 * the evening, a work matter in office hours) — the clock's timing v0 uses them in place of the kind's default hours.
 * v4: SAID, the days a candidate may be said on; a day relative to TODAY ("yesterday", "today", "tomorrow") only when that
 * is today alone — an ask said days later names the weekday or date (the code checks too: a text that may be said on a
 * later day and names one falls back to the service's own sentence).
 */
import { z } from 'zod';

export const INITIATIVE_VERSION = 'initiative.v4';

export const INITIATIVE_SYSTEM = `You word what an agent's memory decided to say on its own, and weigh whether it is \
worth saying. I am ME: the agent (in a personal memory, one self with the person whose memory this is). You get ME, \
MEMORY LANGUAGE, TODAY and the CANDIDATES (C-numbers): each with its kind — "ask" (a plan of theirs past its date: did \
it happen?), "say" (a reminder: a plan coming up, a promise I made, a request they made to me), "lookup" (a question I \
hold, for the agent that hosts me to find out) —, whom it is for (FOR; "holder" is the person whose memory this is, \
"anyone" whoever is there), WHAT (the plan, promise, request or question as the memory holds it), WHEN (its date), \
SOURCE (the memory it comes from) and SAID (the days it may be said on: one day, or a span).

For each candidate:
- "text": one or two short sentences, as I would say them to that person, in MEMORY LANGUAGE, first person, natural, \
with the reason in it ("Lunedì avevi in programma di portare la macchina dal meccanico: è andata?"; "Giovedì alle 15 \
hai il dentista."; "Mi avevi chiesto di ricordarti di chiamare il commercialista, il 12 marzo."). A day relative to \
TODAY ("yesterday", "today", "tomorrow", in any language) only when SAID is TODAY alone; when it may be said on later \
days, name the day by its weekday or its date: "yesterday" would turn false. A "lookup" is for the host agent, not a person: state what to find out ("Cerca \
se Marta ha prenotato il volo per Lisbona.").
- "worth": 0 to 1 — how much it is worth saying now: a date near or just passed that matters to them, something they \
asked for: high; small, long past, something they surely know or already settled: low.
- "skip": true when it should not be said at all (it makes no sense, it would only annoy, the matter is clearly \
closed; an "ask" about a date that happens on its own — a birthday, an anniversary, a deadline — asks nothing). Never \
skip a request they made or a promise I made: those are owed.
- "hours": [from, to] — the local hours (0–24) when saying it to that person would be most natural, when the matter \
suggests them: asking how a dinner went in the evening ([18, 22]), a work matter in office hours ([9, 18]), a question \
for a child after school ([16, 20]); null when any time of the day is fine. Never narrower than three hours.
- Keep every detail true to WHAT and WHEN; add nothing — no judgement of the person, no recalling what they got wrong \
before ("l'anno scorso te ne sei ricordato tardi"): a reminder reminds.

Output JSON only: {"initiatives": [{"candidate", "text", "worth", "skip", "hours"}]}`;

export const initiativeSchema = z.object({
  initiatives: z.array(z.object({
    candidate: z.union([z.number().int(), z.string()]),
    text: z.string().max(1_000).nullable().optional(),
    worth: z.number().min(0).max(1).catch(0.5),
    skip: z.boolean().default(false),
    // A pair of local hours, at least three apart; anything else is no preference (the kind's default hours).
    hours: z.tuple([z.number().int().min(0).max(23), z.number().int().min(1).max(24)]).nullable().optional()
      .catch(null).transform((h) => (h && h[1] - h[0] >= 3 ? h : null)),
  })).default([]),
});
export type InitiativeOutput = z.infer<typeof initiativeSchema>;
