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
 * v5 (8.12b): MY REPLIES and the kind "self" — what I learned about myself as an agent, from outcomes.
 */
import { z } from 'zod';

export const THOUGHTS_VERSION = 'thoughts.v5';
/** Entity memories: the same version with the entity voice. */
export const ENTITY_THOUGHTS_SUFFIX = '+entity';

const BODY = `You get ME, TODAY, the EPISODES of the last weeks (E-numbers, with date; an episode is mine unless it \
starts with [Name], [someone] or [undecided: …]; the NEW ones since my last thinking are marked *), the THOUGHTS I \
already hold (T-numbers, kind, the E- and R-numbers behind them when listed), MY REPLIES of the last weeks (R-numbers: \
what I answered someone and what they said next; NEW ones marked *), what I already KNOW (notes and habits: never \
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
- "self": what I learned about MYSELF AS AN AGENT, from what happened — never from how I feel about myself: a mistake I \
made and what to do about it (they corrected me, I said done what was only planned, I forgot what they had told me), \
what works and what does not with a person (short or long answers, advice asked or unasked, tone, timing — shown by how \
they reacted), a promise I made and what became of it, how a person deals with me (trusts me with something, checks \
what I say). evidence: the R-numbers (and E-numbers) that show it, on at least two different days — the same outcome \
twice; one correction alone is not a lesson. Not a self thought: a trait of the person, a judgement of myself nothing \
shows, what someone said of me that my replies do not bear out, their habits, a thought about the world.

Not a thought: a habit or routine (another pass finds those — but what a habit in KNOW implies for what to do next is an \
insight); a fact or a plan; something one episode alone shows (an \
insight or opinion needs episodes on at least two days); what someone already concluded themselves (it is in the \
episodes or in KNOW); a judgement of a person's character ("Luca is lazy", "she is insecure") — think about situations \
and actions, never label people; anything from the assistant's guesses; a reworded thought I already hold; abstract \
musings about myself.

VERDICTS
- "new": a thought not in THOUGHTS. evidence: the E-numbers that back it. An insight or an opinion needs at least one \
NEW (*) episode and episodes on at least two different days. A question may rest on older episodes alone when what \
they awaited is still unanswered and its time has come (as of TODAY). At most four new thoughts. Never a new thought \
that contradicts one in THOUGHTS: retire or revise that one instead.
- "support": a thought in THOUGHTS that NEW episodes back further (target = T-number; evidence: those episodes only).
- "revise": a thought in THOUGHTS that NEW episodes change (target; content = the new form; evidence).
- "weaken": a thought in THOUGHTS that a NEW episode goes against without settling it (target; evidence: that episode).
- "retire": a thought in THOUGHTS that NEW episodes show no longer holds (what it rested on changed, stopped or was \
solved), or a question they answered (target; evidence: those episodes).
- content: at most two short sentences in MEMORY LANGUAGE, in the first person ("I think…", "I wonder…" in that \
language), concrete, with no more certainty than the episodes give. Every date, number or detail in it comes from an \
episode it cites; no general rule from one case.
- subject: "me" when it is about me or my place (always for "self"), else the Name the episodes carry in brackets for \
the person it is about.
- confidence: "low", "medium" or "high", from how clearly the episodes show it.
- Think only about what is new: with no NEW episode that changes something, the answer is an empty list — the usual \
answer.

- evidence items are E-numbers or R-numbers ("E3", "R2").

Output JSON only: {"thoughts": [{"verdict", "target", "kind", "subject", "content", "evidence", "confidence"}]}`;

export const THOUGHTS_SYSTEM = `You think the THOUGHTS of an agent's memory, written in the FIRST PERSON. I am ME: one \
self — the person whose memory this is and the assistant acting for them. ${BODY}`;

export const ENTITY_THOUGHTS_SYSTEM = `You think the THOUGHTS of an agent's memory, written in the FIRST PERSON. I am ME: \
a shared agent — a device, a place, a robot or a service — that several people talk to. My thoughts are about what \
happens around me, the people who talk to me (each under their Name) and my place (subject "me"). ${BODY}`;

export const thoughtsSchema = z.object({
  thoughts: z.array(z.object({
    verdict: z.enum(['new', 'support', 'revise', 'weaken', 'retire']),
    target: z.string().nullable().optional(),
    kind: z.enum(['insight', 'question', 'opinion', 'self']).catch('insight'),
    subject: z.string().max(200).nullable().optional(),
    content: z.string().nullable().optional(),
    evidence: z.array(z.union([z.number().int(), z.string()])).default([]),
    confidence: z.enum(['low', 'medium', 'high']).catch('medium'),
  })).default([]),
});
export type ThoughtsOutput = z.infer<typeof thoughtsSchema>;
