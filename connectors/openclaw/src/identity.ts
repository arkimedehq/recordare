// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/** Who a turn belongs to in Recordare, which conversation it is, and which turns are never remembered. */
import { type RecordareConfig } from './config.js';

/**
 * The Recordare user of a sender: the `users` mapping, else — for turns without a channel sender (CLI, Control UI) —
 * `defaultUser`. An unmapped sender is not remembered, except with a personal token and no mapping at all
 * (a single-person install: every turn is the token's person).
 */
export function resolveUser(cfg: RecordareConfig, channel: string | undefined, senderId: string | undefined): string | undefined {
  if (senderId) {
    const mapped = channel ? cfg.users[`${channel}:${senderId}`] : undefined;
    if (mapped) return mapped;
    return cfg.personal && Object.keys(cfg.users).length === 0 ? cfg.defaultUser : undefined;
  }
  return cfg.defaultUser;
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
