// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Who said each message, recorded as knowledge (D50, docs/DATA_MODEL.md → Agent memory): the kind of author, the contact
 * when there is one, how the attribution was established and how sure it is.
 */

/**
 * `self`: the memory's self (personal mode: the account's speaker); `contact`: an identified person of this memory;
 * `someone`: an unidentified person; `agent`: the assistant; `own`: content the client marked as the agent's own
 * (knowledge given to it, its perceptions, a document); `tool`: a tool call / result.
 */
export const AUTHOR_KINDS = ['self', 'contact', 'someone', 'agent', 'own', 'tool'] as const;
export type AuthorKind = (typeof AUTHOR_KINDS)[number];

/**
 * `account`: the account's own user (personal mode); `declared`: a participant's channel id declared by the client;
 * `client_assertion`: the client asserted it (its own participant user id, or the role it gave the message);
 * `self_introduction`, `addressed_by_name`, `voiceprint`, `face`: reserved for later steps; `none`: not established.
 */
export const ATTRIBUTION_METHODS = ['account', 'declared', 'self_introduction', 'addressed_by_name', 'voiceprint', 'face', 'client_assertion', 'none'] as const;
export type AttributionMethod = (typeof ATTRIBUTION_METHODS)[number];

export interface Attribution {
  kind: AuthorKind;
  personId: string | null;
  method: AttributionMethod;
  /** 0–1; null when nothing was established. */
  confidence: number | null;
}

export const SOMEONE: Attribution = { kind: 'someone', personId: null, method: 'none', confidence: null };

/**
 * SQL predicate: the message is the account's speaker's own turn (role `user`, the memory's self or own content, or the
 * conversation's `owner` participant) — what the extraction prompts call the owner (personal) or the person (entity)
 * until first person arrives (WORK_PLAN 8.4). `m` is the alias of `messages`.
 */
export const accountSpeaker = (m: string): string =>
  `(${m}.role = 'user' OR ${m}.author_kind IN ('self', 'own') OR EXISTS (SELECT 1 FROM conversation_participants asp
     WHERE asp.conversation_id = ${m}.conversation_id AND asp.ref = ${m}.author_ref AND asp.role = 'owner'))`;

/**
 * SQL predicate: the message is the memory's own turn in either mode — personal memories (8.4): the self or own content
 * (`author_kind`), so an identified contact's `user` turn is theirs; entity memories: `accountSpeaker` (unchanged until
 * 8.5). `m` is the alias of `messages`.
 */
export const memorySpeaker = (m: string): string =>
  `(CASE WHEN (SELECT o.mode FROM owners o WHERE o.person_id = ${m}.owner_id) = 'personal'
     THEN ${m}.author_kind IN ('self', 'own') ELSE ${accountSpeaker(m)} END)`;
