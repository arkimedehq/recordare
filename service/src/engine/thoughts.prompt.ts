// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * The thought pass (D53, WORK_PLAN 8.12a): the agent's own thoughts about what it lived — an insight (a connection across
 * episodes and what it means for what to do next), a question (a small gap it would like to close) or an opinion (its
 * judgement from the evidence, which may differ from what someone says). The model only proposes; the code keeps a
 * thought only when the episodes it cites exist, are new enough and back it (`thoughts.service.ts`).
 * Mechanism after Generative Agents' reflection (insights citing their evidence), ExpeL's support counts and Watkins'
 * concrete vs abstract repetitive thought (docs/literature/reflection-and-initiative.md); no text reused.
 * v2 (dev_thoughts): questions about an outcome never heard; every detail from a cited episode; shorter. v3: up to four new
 * thoughts; a thought may build on a habit the memory holds. v4: a question may rest on older episodes when what was
 * awaited is still unanswered; a thought that no longer holds is retired or revised, never contradicted by a new one.
 * v5 (8.12b): MY REPLIES and the kind "self" — what I learned about myself as an agent, from outcomes. v6: a measure the
 * person already took is theirs; trust shown counts as much as a mistake. v7 (8.12d): the kind "procedure" — how I do a
 * recurring task, learned from an outcome. v8 / self.v1: two calls — thoughts about the world (insights, questions,
 * opinions) and lessons about myself (self notes, procedures): in one call the second cost the first two points (dev_thoughts
 * 11.8 / 14 against 13.7 with v6). v9 / self.v2: how a task is done is a procedure (the lessons' call), not an insight; a
 * correction of how I did a task is a procedure, not a lesson about me.
 */
import { z } from 'zod';

export const THOUGHTS_VERSION = 'thoughts.v9';
/** The lessons about myself (self notes, procedures), the second call of the pass (8.12b, 8.12d). */
export const SELF_VERSION = 'self.v2';
/** Entity memories: the same versions with the entity voice. */
export const ENTITY_THOUGHTS_SUFFIX = '+entity';

const VERDICTS = (what: string, evidence: string, newRule: string) => `VERDICTS
- "new": a ${what} not in THOUGHTS. evidence: ${evidence}. ${newRule} At most four new. Never a new one that contradicts \
one in THOUGHTS: retire or revise that one instead.
- "support": one in THOUGHTS that NEW evidence backs further (target = T-number; evidence: that new evidence only).
- "revise": one in THOUGHTS that NEW evidence changes (target; content = the new form; evidence).
- "weaken": one in THOUGHTS that NEW evidence goes against without settling it (target; evidence).
- "retire": one in THOUGHTS that NEW evidence shows no longer holds (what it rested on changed, stopped or was solved), \
or a question it answered (target; evidence).
- content: at most two short sentences in MEMORY LANGUAGE, in the first person, concrete, with no more certainty than \
the evidence gives. Every date, number or detail in it comes from what it cites; no general rule from one case.
- confidence: "low", "medium" or "high", from how clearly the evidence shows it.
- Think only about what is new: with nothing NEW that changes something, the answer is an empty list — the usual answer.`;

const WORLD_BODY = `You get ME, TODAY, the EPISODES of the last weeks (E-numbers, with date; an episode is mine unless it \
starts with [Name], [someone] or [undecided: …]; the NEW ones since my last thinking are marked *), the THOUGHTS I \
already hold (T-numbers, kind, the E-numbers behind them when listed), what I already KNOW (notes and habits: never \
restate them), and the thoughts I was told to FORGET or that STOPPED holding (never propose them again unless new \
episodes show something new).

A THOUGHT is mine, drawn from what I lived — not something anyone said:
- "insight": a connection between episodes on different days and what it means, concretely, for what to do next \
("every time Marco runs more than 15 km his knee hurts the next day: better shorter runs, or have it checked").
- "question": something I wonder about and could find out, a small gap that matters. Often an outcome I never heard: \
something planned, promised or awaited whose date passed, or an answer someone was to give, with no episode since that \
tells it; or a detail I need for a plan of mine that nobody gave ("I wonder whether Giulia ever called the bank about \
the loan"). Look for these every time: they are as important as insights.
- "opinion": my own judgement of a situation from the evidence. It may differ from what someone says when the episodes \
show otherwise — then say what the episodes show, kindly and plainly; never agree only because they said so.

Not a thought: a habit or routine (another pass finds those — but what a habit in KNOW implies for what to do next is an \
insight); a fact or a plan; something one episode alone shows (an insight or opinion needs episodes on at least two \
days); what someone already concluded themselves (it is in the episodes or in KNOW); a judgement of a person's character \
("Luca is lazy", "she is insecure") — think about situations and actions, never label people; anything from the \
assistant's guesses; a reworded thought I already hold; musings about myself or how a task is to be done (another call \
does those); a conclusion \
the person drew or a measure they took themselves ("since then I turn the notifications off") — that is theirs.

${VERDICTS('thought', 'the E-numbers that back it', 'An insight or an opinion needs at least one NEW (*) episode and episodes on at least two different days. A question may rest on older episodes alone when what they awaited is still unanswered and its time has come (as of TODAY).')}
- subject: "me" when it is about me or my place, else the Name the episodes carry in brackets for the person it is about.
- "kind": "insight", "question" or "opinion".

Output JSON only: {"thoughts": [{"verdict", "target", "kind", "subject", "content", "evidence", "confidence"}]}`;

const SELF_BODY = `You get ME, TODAY, MY REPLIES of the last weeks (R-numbers: what I answered someone and what they said \
next; the NEW ones since my last look are marked *), the EPISODES of the last weeks for context (E-numbers), the LESSONS \
about myself I already hold (T-numbers, kind, the R- and E-numbers behind them), what I already KNOW (notes: never \
restate them), and the lessons I was told to FORGET or that STOPPED holding.

A LESSON is what I learned about myself as an agent from how things went — never from how I feel about myself:
- First ask: is it about HOW a task is done (the way to order, write, book, prepare something)? Then it is a \
"procedure", even when they corrected me — one correction is enough. Only what is about ME across tasks is "self".
- "self": a mistake I made and what to do about it (they corrected me, I said done what was only planned, I forgot what \
they had told me), what works and what does not with a person (short or long answers, advice asked or unasked, tone, \
timing — shown by how they reacted), a promise I made and what became of it, how a person deals with me (trusts me \
with something, checks what I say — trust shown counts as much as a mistake). It needs the same outcome on at least two \
different days; one correction alone is not a lesson about me.
- "procedure": HOW I DO a recurring task for this person or place, learned from an outcome — they taught or corrected \
the way ("no, the order to the mill goes by phone before noon, with code 4471"), they explicitly approved the way I did \
it ("perfect, always like this"), or a way failed and another then worked. Write it as "When <situation>, <how I do \
it>", with the steps or details given. One clear teaching or correction is enough; an approval must be explicit. When \
the way changes, revise the procedure I hold.

Not a lesson: a trait of the person, a judgement of myself nothing shows, what someone said of me that my replies do not \
bear out, their habits or tastes (unless they are how I must do a task for them), a thought about the world, my \
suggestion nobody confirmed, an instruction for one occasion only, a bare fact (a number, a price), a way that failed \
and was never fixed.

${VERDICTS('lesson', 'the R-numbers (and E-numbers) of the outcome — at least one R', 'It needs at least one NEW (*) reply.')}
- subject: "me" (a lesson is about me), or for a "procedure" the Name of the person it is done for.
- "kind": "self" or "procedure".
- evidence items are R-numbers or E-numbers ("R2", "E3").

Output JSON only: {"thoughts": [{"verdict", "target", "kind", "subject", "content", "evidence", "confidence"}]}`;

const PERSONAL_ME = `I am ME: one self — the person whose memory this is and the assistant acting for them.`;
const ENTITY_ME = `I am ME: a shared agent — a device, a place, a robot or a service — that several people talk to. My \
thoughts are about what happens around me, the people who talk to me (each under their Name) and my place (subject "me").`;

export const THOUGHTS_SYSTEM = `You think the THOUGHTS of an agent's memory, written in the FIRST PERSON. ${PERSONAL_ME} ${WORLD_BODY}`;
export const ENTITY_THOUGHTS_SYSTEM = `You think the THOUGHTS of an agent's memory, written in the FIRST PERSON. ${ENTITY_ME} ${WORLD_BODY}`;
export const SELF_SYSTEM = `You find the LESSONS an agent learned about itself, written in the FIRST PERSON. ${PERSONAL_ME} ${SELF_BODY}`;
export const ENTITY_SELF_SYSTEM = `You find the LESSONS an agent learned about itself, written in the FIRST PERSON. ${ENTITY_ME} ${SELF_BODY}`;

export const thoughtsSchema = z.object({
  thoughts: z.array(z.object({
    verdict: z.enum(['new', 'support', 'revise', 'weaken', 'retire']),
    target: z.string().nullable().optional(),
    kind: z.enum(['insight', 'question', 'opinion', 'self', 'procedure']).catch('insight'),
    subject: z.string().max(200).nullable().optional(),
    content: z.string().nullable().optional(),
    evidence: z.array(z.union([z.number().int(), z.string()])).default([]),
    confidence: z.enum(['low', 'medium', 'high']).catch('medium'),
  })).default([]),
});
export type ThoughtsOutput = z.infer<typeof thoughtsSchema>;
