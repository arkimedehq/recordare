// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Recordare for OpenClaw — the full client level (docs/INTEGRATION.md):
 * - before_prompt_build: one call (`POST api/v1/context` with `ingest`) stores the person's message and returns the
 *   memories relevant to it, added before the message as a fenced `<memory-context>` block;
 * - agent_end: sends the agent's answer (and the message again, same id: stored once);
 * - session_end: ends the conversation (`POST …/conversations/{id}/end`: extraction now instead of after the idle delay);
 * - message_received: in group chats, the other members' messages go with the next turn as context (role `other`);
 * - recordare_* tools: Recordare's MCP tools, bound in code to the person and the conversation.
 * Never blocks or breaks OpenClaw: every call is time-boxed, every failure is logged (no content) and swallowed;
 * captured messages that could not be sent are retried in the background.
 */
import { createHash } from 'node:crypto';
import {
  afterFailure, clipUtf8, type DeliveryPolicy, type IngestConversation, type IngestMessage, type IngestParticipant,
  type IngestRequest, RecordareClient,
} from '@arkimedehq/recordare-client';
import type { AgentContext, AgentTool, OpenClawPluginApi, ToolContext } from 'openclaw/plugin-sdk/plugin-entry';
import { type RecordareConfig } from './config.js';
import { conversationId, isGroupSession, isSystemRun, resolveUser } from './identity.js';
import { TOOLS, toolName } from './tools.js';
import { cleanUserText, lastTurn } from './transcript.js';

/** Session-key predicates from OpenClaw's SDK (injected: tests run without OpenClaw). */
export interface SessionKinds {
  isIncognito: (key: string | undefined) => boolean;
  isCron: (key: string | undefined) => boolean;
  isSubagent: (key: string | undefined) => boolean;
}

const VERSION = '0.1.0';
const TOOL_TIMEOUT_MS = 20_000;
/** Background retries of captured messages: ~8 attempts over ≈ 10 minutes, then dropped (logged). */
const RETRY: DeliveryPolicy = { maxAttempts: 8, baseDelayMs: 2_000, maxDelayMs: 5 * 60_000 };
const MAX_QUEUE = 500;
const MAX_TRACKED = 500;
const MAX_GROUP_BUFFER = 50;

const hash = (s: string): string => createHash('sha256').update(s).digest('hex').slice(0, 16);
const errName = (err: unknown): string => (err instanceof Error ? err.message : 'error');

/** A Map that forgets its oldest entries past `max`. */
function remember<K, V>(map: Map<K, V>, key: K, value: V, max = MAX_TRACKED): void {
  map.delete(key);
  map.set(key, value);
  while (map.size > max) map.delete(map.keys().next().value as K);
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  return Promise.race([
    p,
    new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms); }),
  ]).finally(() => clearTimeout(timer));
}

interface Turn {
  user: string;
  conversation: IngestConversation;
  message?: IngestMessage;
}

interface Pending { user: string; req: IngestRequest; attempts: number }

/** The turn's identity, or null when the turn is not remembered. */
interface Who { user: string; conversation: string; channel?: string }

export function registerRecordare(api: OpenClawPluginApi, cfg: RecordareConfig, kinds: SessionKinds): { stop: () => Promise<void> } {
  const log = api.logger;
  const clientInfo = { name: 'openclaw-recordare', version: VERSION };
  // Before the agent answers: short timeouts (the turn waits). Background sends and tools: Recordare's usual 15 s.
  const fast = new RecordareClient({ baseUrl: cfg.url, apiKey: cfg.apiKey, timeoutMs: cfg.timeoutMs, mcp: { clientInfo } });
  const slow = new RecordareClient({ baseUrl: cfg.url, apiKey: cfg.apiKey, mcp: { clientInfo, maxSessions: 50 } });
  /** Header user: none with a personal token (it is the person). */
  const headerUser = (user: string): string => (cfg.personal ? '' : user);

  const turns = new Map<string, Turn>(); // runId → the turn in progress
  const captured = new Map<string, string>(); // conversation → its person (to end it)
  const groupBuffer = new Map<string, IngestMessage[]>(); // session key → other members' messages not sent yet
  const groupParticipants = new Map<string, IngestParticipant[]>(); // session key → the members seen
  const queue: Pending[] = [];
  let timer: NodeJS.Timeout | undefined;
  let stopped = false;

  // ── Delivery: one try now, then background retries with back-off ─────────────────────────────────────────────
  async function deliver(p: Pending): Promise<boolean> {
    try {
      const res = await slow.ingest(headerUser(p.user), p.req);
      if (res.conflicts.length) log.warn(`recordare: ${res.conflicts.length} message id(s) conflicted (kept the stored version)`);
      return true;
    } catch (err) {
      p.attempts++;
      const next = afterFailure(err, p.attempts, RETRY);
      if (next.action === 'park') {
        log.warn(`recordare: dropped ${p.req.messages.length} message(s) after ${p.attempts} attempt(s) (${next.reason}: ${errName(err)})`);
        return true;
      }
      if (queue.length >= MAX_QUEUE) {
        queue.shift();
        log.warn('recordare: retry queue full, dropped the oldest batch');
      }
      queue.push(p);
      schedule(next.delayMs);
      if (p.attempts === 1) log.warn(`recordare: ingest failed (${errName(err)}), retrying in the background`);
      return false;
    }
  }

  function schedule(delayMs: number): void {
    if (stopped || timer) return;
    timer = setTimeout(() => { timer = undefined; void flush(); }, delayMs);
    timer.unref?.();
  }

  async function flush(): Promise<void> {
    const batch = queue.splice(0, queue.length);
    for (const p of batch) await deliver(p);
  }

  function send(user: string, req: IngestRequest): Promise<boolean> {
    return deliver({ user, req, attempts: 0 });
  }

  // ── Who and where ─────────────────────────────────────────────────────────────────────────────────────────────
  function who(ctx: AgentContext): Who | null {
    const key = ctx.sessionKey;
    if (kinds.isIncognito(key) || kinds.isCron(key) || kinds.isSubagent(key) || isSystemRun(ctx)) return null;
    if (!cfg.groups && isGroupSession(key)) return null;
    const channel = ctx.channel ?? ctx.messageProvider;
    const user = resolveUser(cfg, channel, ctx.senderId);
    const conversation = conversationId(key, ctx.sessionId);
    if (!user || !conversation) return null;
    return { user, conversation, channel };
  }

  function conversationMeta(w: Who, ctx: AgentContext): IngestConversation {
    const participants: IngestParticipant[] = [
      { ref: 'owner', role: 'owner' },
      { ref: 'assistant', role: 'assistant', displayName: ctx.agentId ?? 'assistant' },
      ...(ctx.sessionKey ? groupParticipants.get(ctx.sessionKey) ?? [] : []),
    ];
    return {
      externalId: w.conversation,
      source: 'chat',
      channel: w.channel ? `openclaw:${w.channel}` : 'openclaw',
      title: ctx.sessionKey,
      participants,
    };
  }

  /** The other members' messages buffered for this session (groups), minus the one that triggered the turn. */
  function takeGroupMessages(sessionKey: string | undefined, userText: string): IngestMessage[] {
    if (!sessionKey) return [];
    const buffered = groupBuffer.get(sessionKey) ?? [];
    groupBuffer.delete(sessionKey);
    return buffered.filter((m) => cleanUserText(m.content) !== userText);
  }

  // ── Hooks ─────────────────────────────────────────────────────────────────────────────────────────────────────
  api.on('before_prompt_build', async (event, ctx) => {
    try {
      if (!cfg.capture && !cfg.autoRecall) return;
      const w = who(ctx);
      if (!w) return;
      const text = cleanUserText(event.currentUserMessage ?? event.prompt ?? '');
      if (!text) return;
      const now = new Date().toISOString();
      const id = event.currentUserMessageId ?? ctx.runId ?? hash(`${w.conversation}\u0000${text}\u0000${now}`);
      const conversation = conversationMeta(w, ctx);
      const message: IngestMessage = { externalId: `${id}:u`, role: 'user', authorRef: 'owner', content: clipUtf8(text), sentAt: now };
      remember(turns, ctx.runId ?? w.conversation, { user: w.user, conversation, message });
      if (!cfg.capture) {
        const ctxRes = await fast.context(headerUser(w.user), w.conversation, text.slice(0, 4000));
        return ctxRes.block ? { prependContext: ctxRes.block } : undefined;
      }
      // Stored before the agent runs: the memory tools bind what the agent writes to the person's own words.
      const turn: IngestRequest = { conversation, messages: [...takeGroupMessages(ctx.sessionKey, text), message] };
      remember(captured, w.conversation, w.user);
      try {
        if (!cfg.autoRecall) {
          await fast.ingest(headerUser(w.user), turn);
          return undefined;
        }
        const ctxRes = await fast.contextWithTurn(headerUser(w.user), turn, text.slice(0, 4000));
        return ctxRes.block ? { prependContext: ctxRes.block } : undefined;
      } catch (err) {
        // Same message ids: whatever was already stored is stored once.
        log.warn(`recordare: storing the message before the turn failed (${errName(err)}), will retry; no memory context this turn`);
        void send(w.user, turn);
        return undefined;
      }
    } catch (err) {
      log.warn(`recordare: memory context unavailable (${errName(err)})`);
      return undefined;
    }
  });

  api.on('agent_end', async (event, ctx) => {
    try {
      if (!cfg.capture || !event.success) return;
      const stashed = turns.get(ctx.runId ?? '') ?? undefined;
      if (ctx.runId) turns.delete(ctx.runId);
      const w = who(ctx);
      if (!w) return;
      const turn = lastTurn(event.messages ?? []);
      if (!turn.assistant) return;
      const now = new Date().toISOString();
      const runId = event.runId ?? ctx.runId ?? hash(`${w.conversation}\u0000${turn.assistant}`);
      const conversation = conversationMeta(w, ctx);
      const userMessage = stashed?.message
        ?? (turn.user ? { externalId: `${runId}:u`, role: 'user' as const, authorRef: 'owner', content: clipUtf8(turn.user), sentAt: now } : undefined);
      const answer: IngestMessage = { externalId: `${runId}:a`, role: 'assistant', authorRef: 'assistant', content: clipUtf8(turn.assistant), sentAt: now };
      const messages = [...(userMessage ? [userMessage] : []), answer];
      remember(captured, w.conversation, w.user);
      await send(w.user, { conversation, messages });
    } catch (err) {
      log.warn(`recordare: capture failed (${errName(err)})`);
    }
  });

  api.on('session_end', async (event, ctx) => {
    try {
      // Compaction and a Gateway shutdown / restart do not end the conversation (the session goes on afterwards).
      if (!cfg.capture || ['compaction', 'shutdown', 'restart'].includes(event.reason ?? '')) return;
      const conv = conversationId(event.sessionKey ?? ctx.sessionKey, event.sessionId ?? ctx.sessionId);
      const user = conv ? captured.get(conv) : undefined;
      if (!conv || user === undefined) return;
      captured.delete(conv);
      await slow.endConversation(headerUser(user), conv);
    } catch (err) {
      log.warn(`recordare: end of conversation not sent (${errName(err)})`);
    }
  });

  api.on('message_received', (event, ctx) => {
    try {
      const key = event.sessionKey ?? ctx.sessionKey;
      const senderId = event.senderId ?? ctx.senderId;
      if (!cfg.capture || !cfg.groups || !isGroupSession(key) || !senderId || !event.content?.trim()) return;
      const ref = `${ctx.channelId}:${senderId}`;
      const members = groupParticipants.get(key as string) ?? [];
      if (!members.some((p) => p.ref === ref)) {
        remember(groupParticipants, key as string, [...members, { ref, role: 'other', identity: { channel: ctx.channelId, externalId: senderId } }]);
      }
      const at = event.timestamp ? new Date(event.timestamp) : new Date();
      const buffered = groupBuffer.get(key as string) ?? [];
      buffered.push({
        externalId: `msg:${event.messageId ?? ctx.messageId ?? hash(`${ref}\u0000${event.content}\u0000${at.toISOString()}`)}`,
        role: 'other', authorRef: ref, content: clipUtf8(event.content), sentAt: at.toISOString(),
      });
      remember(groupBuffer, key as string, buffered.slice(-MAX_GROUP_BUFFER));
    } catch (err) {
      log.warn(`recordare: group message not buffered (${errName(err)})`);
    }
  });

  // ── Tools ─────────────────────────────────────────────────────────────────────────────────────────────────────
  if (cfg.tools) {
    for (const spec of TOOLS) {
      const name = toolName(spec);
      api.registerTool((ctx: ToolContext): AgentTool | null => {
        if (kinds.isIncognito(ctx.sessionKey)) return null;
        const user = resolveUser(cfg, ctx.messageChannel, ctx.requesterSenderId);
        const conversation = conversationId(ctx.sessionKey, ctx.sessionId);
        if (!user || !conversation) return null;
        return {
          name,
          label: spec.label,
          description: spec.description,
          parameters: spec.parameters,
          async execute(_toolCallId, params) {
            try {
              const res = await withTimeout(slow.mcp.callTool(headerUser(user), conversation, spec.mcpName, params ?? {}), TOOL_TIMEOUT_MS);
              return { content: [{ type: 'text', text: res.isError ? `Error: ${res.text}` : res.text }] };
            } catch (err) {
              log.warn(`recordare: ${name} failed (${errName(err)})`);
              return { content: [{ type: 'text', text: 'Recordare memory is unavailable right now.' }] };
            }
          },
        };
      }, { name });
    }
  }

  return {
    async stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = undefined;
      // One last bounded attempt for what is still queued (OpenClaw gives shutdown hooks ~2 s).
      await withTimeout(Promise.all(queue.splice(0).map((p) => slow.ingest(headerUser(p.user), p.req).catch(() => undefined))), 1500).catch(() => undefined);
      await Promise.all([fast.close(), slow.close()]).catch(() => undefined);
    },
  };
}
