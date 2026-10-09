// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Who a request belongs to, per request, by pluggable resolvers (README → Identity):
 * - generic: `X-Recordare-User` / `X-Recordare-Conversation` / `X-Recordare-Message` (and `X-Recordare-User-Name`)
 *   set by the platform (LibreChat fills them from its placeholders in librechat.yaml);
 * - openwebui: the forwarded user headers (`X-OpenWebUI-User-Id`, `-User-Name`, `-Chat-Id`), or its signed JWT;
 * - anythingllm: a marker in the workspace system prompt, `[[recordare user={user.id} name="{user.name}"
 *   ws={workspace.id}]]`, read from the first system message and removed from every system message before the request
 *   goes upstream.
 * Then the memory (D50, `MEMORY_PER`): by default the proxy's one memory, the platform user a participant recognised
 * inside it (or the account holder, `SELF_USERS`); per workspace or per user on request.
 * The proxy trusts its caller (keep it on the platform's private network, or set PROXY_API_KEY): headers and markers
 * are set by the platform's admin configuration, never by what a person types (user messages are never read for them).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import type { ProxyConfig } from './config.js';
import { type ChatMessage, textOf } from './messages.js';

/** A platform user as a participant of the memory: their client user id (after the alias map) and their name. */
export interface Participant {
  ref: string;
  identity: { externalUserId: string };
  displayName?: string;
}

export interface Identity {
  /** Which resolver found it: the Recordare channel is `proxy:<platform>`. */
  platform: 'generic' | 'openwebui' | 'anythingllm';
  /** The memory's Recordare user (`X-Recordare-User`; ignored with a personal token). */
  user: string;
  /** Who wrote the message: absent = the account holder ("I"); else a participant recognised inside the memory. */
  participant?: Participant;
  /** The Recordare conversation's externalId. */
  conversation: string;
  /** The platform's own id of the person's message, when it sends one. */
  messageId?: string;
}

export interface Resolution {
  identity: Identity | null;
  /** The messages to forward (markers removed). */
  messages: ChatMessage[];
}

/**
 * A header value, or undefined when missing, empty or not a real id: an unexpanded placeholder (`{{…}}`) or a value
 * like `null`, `undefined`, `none`, `new` (alone or after a prefix: `librechat:new`).
 */
export function headerValue(headers: IncomingHttpHeaders, name: string): string | undefined {
  const raw = headers[name.toLowerCase()];
  const v = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  if (!v || v.includes('{{') || /(^|:)(null|undefined|none|new)$/i.test(v)) return undefined;
  return v;
}

/** `YYYY-MM-DD` in the given time zone. */
export function dayOf(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// ── AnythingLLM marker ─────────────────────────────────────────────────────────────────────────────────────────────
// `(?!\])` takes the last `]]` of a run, so a placeholder value like `[User ID]` right before the end still parses.
const MARKER = /\s*\[\[recordare\b(.*?)\]\](?!\])/gi;
const ATTR = /(\w+)=("[^"]*"|\[[^\]]*\]|\S+)/g;

/** The attributes of a marker body (`user=… ws=…`). */
function markerAttrs(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of body.matchAll(ATTR)) {
    const key = m[1];
    const value = m[2];
    if (key && value) out[key.toLowerCase()] = value.replace(/^"|"$/g, '');
  }
  return out;
}

/** A value AnythingLLM left unexpanded (`[User ID]` in single-user mode, `{user.id}`) — not a real id. */
const placeholder = (v: string | undefined): boolean => !v || v.startsWith('[') || v.includes('{');

const hasMarker = (text: string): boolean => {
  MARKER.lastIndex = 0;
  const found = MARKER.test(text);
  MARKER.lastIndex = 0;
  return found;
};

/** Removes every marker from the system messages; returns the attributes of the first one in the first system message. */
export function stripMarkers(messages: ChatMessage[]): { messages: ChatMessage[]; attrs: Record<string, string> | null } {
  let attrs: Record<string, string> | null = null;
  const firstSystem = messages.findIndex((m) => m.role === 'system');
  const strip = (text: string, i: number): string => text.replace(MARKER, (_all, body: string) => {
    if (attrs === null && i === firstSystem) attrs = markerAttrs(body);
    return '';
  }).trim();
  const out = messages.map((m, i) => {
    if (m.role !== 'system') return m;
    if (typeof m.content === 'string') return hasMarker(m.content) ? { ...m, content: strip(m.content, i) } : m;
    if (Array.isArray(m.content) && hasMarker(textOf(m.content))) {
      return {
        ...m,
        content: m.content.map((p) => (p && typeof p === 'object' && typeof (p as { text?: unknown }).text === 'string'
          ? { ...p, text: strip((p as { text: string }).text, i) } : p)),
      };
    }
    return m;
  });
  return { messages: out, attrs };
}

// ── Open WebUI JWT (HS256, `X-OpenWebUI-User-Jwt`) ─────────────────────────────────────────────────────────────────
function b64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

/** The verified claims of an HS256 JWT, or null (bad signature, other algorithm, expired, malformed). */
export function verifyJwt(token: string, secret: string, now = Date.now()): Record<string, unknown> | null {
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) return null;
  try {
    const header = JSON.parse(b64url(h).toString('utf8')) as { alg?: string };
    if (header.alg !== 'HS256') return null;
    const expected = createHmac('sha256', secret).update(`${h}.${p}`).digest();
    const given = b64url(s);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    const claims = JSON.parse(b64url(p).toString('utf8')) as Record<string, unknown>;
    if (typeof claims.exp === 'number' && claims.exp * 1000 < now) return null;
    return claims;
  } catch {
    return null;
  }
}

// ── Resolution ─────────────────────────────────────────────────────────────────────────────────────────────────────
interface Raw {
  platform: Identity['platform']; userId: string; name?: string; conversation?: string; messageId?: string; scope?: string;
  /** AnythingLLM's workspace id. */
  ws?: string;
}

function generic(headers: IncomingHttpHeaders): Raw | null {
  const userId = headerValue(headers, 'x-recordare-user');
  if (!userId) return null;
  return {
    platform: 'generic', userId,
    name: headerValue(headers, 'x-recordare-user-name'),
    conversation: headerValue(headers, 'x-recordare-conversation'),
    messageId: headerValue(headers, 'x-recordare-message'),
  };
}

function openWebUi(headers: IncomingHttpHeaders, cfg: ProxyConfig, now: number): Raw | null {
  let userId: string | undefined;
  let name: string | undefined;
  if (cfg.openWebUiJwtSecret) {
    const jwt = headerValue(headers, 'x-openwebui-user-jwt');
    const claims = jwt ? verifyJwt(jwt, cfg.openWebUiJwtSecret, now) : null;
    userId = typeof claims?.sub === 'string' ? claims.sub : undefined;
    name = typeof claims?.name === 'string' && claims.name.trim() ? claims.name.trim() : undefined;
  } else {
    userId = headerValue(headers, 'x-openwebui-user-id');
    name = headerValue(headers, 'x-openwebui-user-name');
  }
  if (!userId) return null;
  const chat = headerValue(headers, 'x-openwebui-chat-id');
  return { platform: 'openwebui', userId, name, conversation: chat ? `openwebui:${chat}` : undefined };
}

function anythingLlm(attrs: Record<string, string> | null, cfg: ProxyConfig): Raw | null {
  if (!attrs) return null;
  const userId = (placeholder(attrs.user) ? undefined : attrs.user) ?? cfg.defaultUser;
  if (!userId) return null;
  const ws = placeholder(attrs.ws) ? 'ws' : attrs.ws;
  return {
    platform: 'anythingllm',
    userId,
    name: placeholder(attrs.name) ? undefined : attrs.name,
    ws: placeholder(attrs.ws) ? undefined : attrs.ws,
    // An explicit `conv=` wins; otherwise one conversation per workspace, user and day (AnythingLLM sends no thread id).
    conversation: attrs.conv && !placeholder(attrs.conv) ? `anythingllm:${attrs.conv}` : undefined,
    scope: `anythingllm:${ws}:${userId}`,
  };
}

/** A platform user's id: the alias map, else `<platform>:<id>` (the bare id for generic headers). */
function personId(raw: Raw, cfg: ProxyConfig): string | undefined {
  const key = `${raw.platform}:${raw.userId}`;
  const mapped = cfg.userMap[key] ?? (raw.platform === 'generic' ? cfg.userMap[raw.userId] : undefined);
  if (mapped) return mapped;
  if (cfg.mapOnly) return undefined;
  return raw.platform === 'generic' ? raw.userId : key;
}

/** The memory of a request (`MEMORY_PER`); undefined = not remembered (a client key without `RECORDARE_USER`). */
function memoryOf(raw: Raw, person: string, cfg: ProxyConfig): string | undefined {
  if (cfg.memoryPer === 'user') return person;
  if (cfg.personal) return 'me'; // the token is the memory: no user header is sent
  if (cfg.memoryPer === 'workspace' && raw.platform === 'anythingllm' && raw.ws) {
    return cfg.userMap[`anythingllm:ws:${raw.ws}`] ?? `anythingllm:ws:${raw.ws}`;
  }
  return cfg.recordareUser;
}

/** The speaker as a participant of the memory, or undefined for the account holder (`SELF_USERS`; per user: always). */
function participantOf(raw: Raw, person: string, cfg: ProxyConfig): Participant | undefined {
  if (cfg.memoryPer === 'user') return undefined;
  const key = `${raw.platform}:${raw.userId}`;
  if ([key, person, ...(raw.platform === 'generic' ? [raw.userId] : [])].some((k) => cfg.selfUsers.includes(k))) return undefined;
  return { ref: person, identity: { externalUserId: person }, ...(raw.name ? { displayName: raw.name } : {}) };
}

/**
 * Resolves the request's identity (null = pure pass-through) and removes the AnythingLLM markers. Without a platform
 * conversation id, the conversation is one per platform scope, user and day (`dayOf`, the configured time zone).
 */
export function resolveIdentity(cfg: ProxyConfig, headers: IncomingHttpHeaders, messages: ChatMessage[], now = new Date()): Resolution {
  const marker = cfg.resolvers.includes('anythingllm') ? stripMarkers(messages) : { messages, attrs: null };
  for (const name of cfg.resolvers) {
    const raw = name === 'generic' ? generic(headers)
      : name === 'openwebui' ? openWebUi(headers, cfg, now.getTime())
        : anythingLlm(marker.attrs, cfg);
    if (!raw) continue;
    const person = personId(raw, cfg);
    const user = person ? memoryOf(raw, person, cfg) : undefined;
    if (!person || !user) return { identity: null, messages: marker.messages };
    const conversation = raw.conversation ?? `${raw.scope ?? `${raw.platform}:${raw.userId}`}:${dayOf(now, cfg.timeZone)}`;
    const participant = participantOf(raw, person, cfg);
    return {
      identity: { platform: raw.platform, user, conversation, messageId: raw.messageId, ...(participant ? { participant } : {}) },
      messages: marker.messages,
    };
  }
  return { identity: null, messages: marker.messages };
}
