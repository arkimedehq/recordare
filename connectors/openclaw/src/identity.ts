// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/** Which memory a turn goes to, who said it, which conversation it is, and which turns are never remembered. */
import type { IngestParticipant } from '@arkimedehq/recordare-client';
import { type RecordareConfig } from './config.js';

/**
 * The Recordare user (the memory) of a turn. `agent` mode: always the agent's account (`defaultUser`; the token's memory
 * with a personal token). `user` mode: the `users` mapping, else — for turns without a channel sender (CLI, Control UI)
 * — `defaultUser`; an unmapped sender is not remembered, except with a personal token and no mapping at all (every
 * turn is the token's memory).
 */
export function resolveUser(cfg: RecordareConfig, channel: string | undefined, senderId: string | undefined): string | undefined {
  if (cfg.memoryPer === 'agent') return cfg.defaultUser;
  if (senderId) {
    const mapped = channel ? cfg.users[`${channel}:${senderId}`] : undefined;
    if (mapped) return mapped;
    return cfg.personal && Object.keys(cfg.users).length === 0 ? cfg.defaultUser : undefined;
  }
  return cfg.defaultUser;
}

/** The participant ref of a channel sender (also their message author). */
export const senderRef = (channel: string | undefined, senderId: string): string => `${channel ?? 'openclaw'}:${senderId}`;

/** A channel sender as a participant of the agent's memory: their channel identity, their name when known. */
export function senderParticipant(channel: string | undefined, senderId: string, displayName?: string): IngestParticipant {
  return {
    ref: senderRef(channel, senderId), role: 'other', identity: { channel: channel ?? 'openclaw', externalId: senderId },
    ...(displayName ? { displayName } : {}),
  };
}

/** Who wrote the person's message of a turn: the memory's holder ("I"), or a participant recognised inside the memory. */
export interface Speaker {
  /** `authorRef` of the message. */
  ref: string;
  /** `user` for the account holder; `other` for anyone else (an identified participant). */
  role: 'user' | 'other';
  /** The participant to declare, for anyone but the account holder. */
  participant?: IngestParticipant;
}

/**
 * The speaker of a turn. `user` mode, turns without a channel sender (CLI, Control UI) and `selfSenders`: the account
 * holder (participant `holder`). Anyone else in `agent` mode: a participant with the channel identity
 * `<channel>:<senderId>` — Recordare links it to a contact of the agent's memory (created on first sight).
 */
export function resolveSpeaker(cfg: RecordareConfig, channel: string | undefined, senderId: string | undefined, displayName?: string): Speaker {
  if (cfg.memoryPer === 'user' || !senderId || cfg.selfSenders.includes(senderRef(channel, senderId))) {
    return { ref: 'holder', role: 'user' };
  }
  const participant = senderParticipant(channel, senderId, displayName);
  return { ref: participant.ref, role: 'other', participant };
}

/**
 * The Recordare conversation of an OpenClaw session: the session key (where: a DM peer, a group, the main session)
 * plus the session id (which run of it: regenerated on /new, /reset and the daily/idle resets), so each OpenClaw
 * session is one Recordare conversation and its end can be signalled.
 */
export function conversationId(sessionKey: string | undefined, sessionId: string | undefined): string | undefined {
  if (!sessionKey && !sessionId) return undefined;
  return `openclaw:${sessionKey ?? 'session'}${sessionId ? `/${sessionId}` : ''}`;
}

/** A session that holds a group / room / channel (not a direct chat): other people speak there. */
export function isGroupSession(sessionKey: string | undefined): boolean {
  return !!sessionKey && /:(group|channel|room):/.test(sessionKey);
}

/** Runs that are not a person talking: scheduled, heartbeat, internal or agent-to-agent. */
export function isSystemRun(ctx: { trigger?: string; inputProvenance?: { kind?: string } }): boolean {
  return ctx.trigger === 'cron' || ctx.trigger === 'heartbeat'
    || ctx.inputProvenance?.kind === 'internal_system' || ctx.inputProvenance?.kind === 'inter_session';
}
