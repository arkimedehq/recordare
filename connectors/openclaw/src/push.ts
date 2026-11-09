// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Initiatives pushed (D55 F3): what the memory decided to say on its own reaches the person as a message in their last
 * direct chat, when they are not talking to the agent. In a turn the memory context already carries them; this is the
 * other way in.
 * - Which initiatives: the feed (`InitiativeInbox.catchUp`, every `initiativesPollSeconds`) — what Recordare pushed on the
 *   client's `messaging` channel and nobody delivered yet. No public address is needed.
 * - To whom: the person's last direct-chat session seen in a turn. A contact by their addresses (`telegram` / `<chat id>`
 *   is the sender `telegram:<chat id>` this plugin declares); the holder (`for: null`) by `selfSenders` (memoryPer agent)
 *   or by the senders mapped to that user (memoryPer user). Never a group.
 * - How: an OpenClaw session notice with `deliver` — the text as it is, on the session's channel, without the model; the
 *   agent gets a system event so its next turn knows what it said.
 * - Outcomes: `said` / `asked` on `messaging` when the channel took it; otherwise `failed` — no direct chat seen for the
 *   person, a session without a conversation, a send that failed or a channel that cannot deliver (a session reset in
 *   between is tried once more on its new run). A pushed initiative is never offered again in a turn, so `failed` is what
 *   gives it back: Recordare closes it and arms its intent again the next day, instead of letting it lapse unsaid.
 * The senders' sessions and the feed cursors are kept on disk (`<stateDir>/recordare/push.json`, owner-only).
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { type Delivered, type Initiative, InitiativeInbox, type RecordareClient } from '@arkimedehq/recordare-client';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/plugin-entry';
import { type RecordareConfig } from './config.js';

/** A sender's last direct-chat session. */
export interface SessionRef { agentId?: string; sessionKey: string; at: number }

const MAX_SENDERS = 1000;

/** The senders' last direct-chat sessions and the feed cursors, on disk when a file is given. */
export class PushState {
  private senders: Record<string, SessionRef> = {};
  private cursors: Record<string, number> = {};

  constructor(private readonly file: string | null, private readonly warn: (msg: string) => void) {
    if (!file) return;
    try {
      const raw = JSON.parse(readFileSync(file, 'utf8')) as { senders?: Record<string, SessionRef>; cursors?: Record<string, number> };
      this.senders = raw.senders ?? {};
      this.cursors = raw.cursors ?? {};
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') this.warn('recordare: initiatives state unreadable, starting afresh');
    }
  }

  /** A turn of `sender` (`"<channel>:<senderId>"`) in a direct chat. */
  note(sender: string, session: { agentId?: string; sessionKey: string }, now = Date.now()): void {
    const was = this.senders[sender];
    this.senders[sender] = { ...(session.agentId ? { agentId: session.agentId } : {}), sessionKey: session.sessionKey, at: now };
    const keys = Object.keys(this.senders);
    if (keys.length > MAX_SENDERS) {
      for (const k of keys.sort((a, b) => this.senders[a]!.at - this.senders[b]!.at).slice(0, keys.length - MAX_SENDERS)) delete this.senders[k];
    }
    // The time alone changing is not worth a write: the order among one person's senders is rough anyway.
    if (!was || was.sessionKey !== session.sessionKey || was.agentId !== session.agentId) this.save();
  }

  /** The most recent session among these senders. */
  latest(senders: string[]): SessionRef | undefined {
    return senders.map((s) => this.senders[s]).filter((s): s is SessionRef => !!s).sort((a, b) => b.at - a.at)[0];
  }

  cursor(user: string): number | undefined { return this.cursors[user]; }

  setCursor(user: string, seq: number): void {
    if (this.cursors[user] === seq) return;
    this.cursors[user] = seq;
    this.save();
  }

  private save(): void {
    if (!this.file) return;
    try {
      mkdirSync(dirname(this.file), { recursive: true, mode: 0o700 });
      const tmp = `${this.file}.tmp`;
      writeFileSync(tmp, JSON.stringify({ senders: this.senders, cursors: this.cursors }), { mode: 0o600 });
      renameSync(tmp, this.file);
    } catch (err) {
      this.warn(`recordare: initiatives state not saved (${(err as Error).message})`);
    }
  }
}

/** The senders an initiative may reach: a contact's addresses, or the holder's own senders. */
export function targetSenders(cfg: RecordareConfig, user: string, i: Initiative): string[] {
  if (i.for) return i.for.addresses.map((a) => `${a.channel}:${a.id}`);
  if (cfg.memoryPer === 'agent') return cfg.selfSenders;
  return Object.entries(cfg.users).filter(([, u]) => u === user).map(([sender]) => sender);
}

/** The users whose feed is read: the agent's account, or every mapped person (memoryPer user). */
export function feedUsers(cfg: RecordareConfig): string[] {
  if (cfg.memoryPer === 'agent') return cfg.defaultUser ? [cfg.defaultUser] : [];
  return [...new Set([...Object.values(cfg.users), ...(cfg.defaultUser ? [cfg.defaultUser] : [])])];
}

/** What the agent is told it said (its next turn's context; the model never sees the notice itself). */
function systemEvent(i: Initiative): string {
  const to = i.for?.name ? ` to ${i.for.name}` : '';
  return `On your own, from your long-term memory, you just ${i.kind === 'ask' ? 'asked' : 'said'}${to}: "${i.text}"`;
}

/**
 * The initiatives inbox over OpenClaw session notices, or null when the host has no session notices (an older OpenClaw)
 * or the feature is off.
 */
export function createInitiativePush(
  api: OpenClawPluginApi, cfg: RecordareConfig, client: RecordareClient, state: PushState, headerUser: (user: string) => string,
): InitiativeInbox | null {
  if (!cfg.initiatives) return null;
  const system = api.runtime?.system;
  const capture = system?.captureSessionGeneration;
  const post = system?.postSessionNotice;
  if (!capture || !post) {
    api.logger.warn('recordare: this OpenClaw has no session notices; initiatives reach people in their turns only');
    return null;
  }
  const log = (m: string) => api.logger.warn(`recordare: ${m}`);

  const failed = (i: Initiative, why: string): Delivered => {
    log(`initiative ${i.id} not sent (${why})`);
    return { outcome: 'failed', channel: 'messaging' };
  };

  async function deliver(user: string, i: Initiative): Promise<Delivered> {
    const session = state.latest(targetSenders(cfg, user, i));
    if (!session) return failed(i, 'no direct chat with the person yet');
    // A session reset between the capture and the post is skipped by OpenClaw: once more on its new run.
    for (let attempt = 0; attempt < 2; attempt++) {
      const generation = await capture!({ ...(session.agentId ? { agentId: session.agentId } : {}), sessionKey: session.sessionKey });
      if (!generation) return failed(i, 'the session has no conversation');
      const res = await post!({
        generation,
        notice: { type: 'recordare-initiative', text: i.text, data: { initiativeId: i.id } },
        idempotencyKey: `recordare:${i.id}`,
        systemEvent: systemEvent(i),
        deliver: {},
      });
      if (res.status === 'skipped') continue;
      if (res.status === 'failed') return failed(i, `${res.stage} failed`);
      if (!res.delivered) return failed(i, 'the channel cannot deliver');
      return { outcome: i.kind === 'ask' ? 'asked' : 'said', channel: 'messaging' };
    }
    return failed(i, 'the session changed');
  }

  // The client's own user ids in the feed; the header user is empty with a personal token (the token is the memory).
  const users = feedUsers(cfg);
  return new InitiativeInbox({
    client: {
      initiatives: (user: string, q: Parameters<RecordareClient['initiatives']>[1]) => client.initiatives(headerUser(user), q),
      reportInitiative: (user: string, id: string, outcome: Parameters<RecordareClient['reportInitiative']>[2], o?: Parameters<RecordareClient['reportInitiative']>[3]) =>
        client.reportInitiative(headerUser(user), id, outcome, o),
      presence: (user: string, impulse: Parameters<RecordareClient['presence']>[1]) => client.presence(headerUser(user), impulse),
    } as unknown as RecordareClient,
    deliver: (user, i) => deliver(user, i),
    users: () => users,
    channels: ['messaging'],
    cursors: { get: (u) => state.cursor(u), set: (u, s) => state.setCursor(u, s) },
    log,
  });
}
