// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * The HTTP proxy: `POST /v1/chat/completions` (streamed or not) gets the person's memories and is captured; every other
 * `/v1/*` request goes to the upstream provider unchanged; `GET /health` answers locally.
 * The chat never waits on Recordare for longer than the recall timeout and never fails because of it.
 */
import { createServer, type IncomingHttpHeaders, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { Readable } from 'node:stream';
import { answerOfJson, StreamAccumulator, type Answer } from './answer.js';
import type { ProxyConfig } from './config.js';
import { resolveIdentity } from './identity.js';
import type { Logger, Turn } from './memory.js';
import { type ChatRequest, injectBlock, isBackgroundCall, lastUserIndex, personText, textOf } from './messages.js';

/** What the proxy needs from the Recordare side (Memory; a fake in tests). */
export interface MemoryPort {
  beforeTurn(turn: Turn): Promise<string | null>;
  afterTurn(turn: Turn, answer: string): void;
  queued(): number;
}

export interface ProxyDeps {
  log: Logger;
  /** null = Recordare not configured: a plain proxy. */
  memory: MemoryPort | null;
  /** The upstream fetch (tests). */
  fetch?: typeof fetch;
}

/** Request headers never sent upstream: hop-by-hop, length / encoding (re-done by fetch), identity (privacy). */
const DROP_REQUEST = /^(host|connection|keep-alive|proxy-.*|te|trailer|transfer-encoding|upgrade|content-length|accept-encoding|authorization|x-recordare-.*|x-openwebui-.*)$/i;
/** Response headers not copied back: the body is re-sent decoded and chunked by Node. */
const DROP_RESPONSE = /^(connection|keep-alive|transfer-encoding|content-encoding|content-length)$/i;

const errName = (err: unknown): string => (err instanceof Error ? err.message : 'error');

function readBody(req: IncomingMessage, max: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > max) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function openAiError(res: ServerResponse, status: number, message: string, type = 'proxy_error'): void {
  sendJson(res, status, { error: { message, type, code: status } });
}

function bearer(headers: IncomingHttpHeaders): string | undefined {
  return (headers.authorization ?? '').match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
}

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function createProxy(cfg: ProxyConfig, deps: ProxyDeps): Server {
  const { log, memory } = deps;
  const upstreamFetch = deps.fetch ?? fetch;

  function upstreamHeaders(incoming: IncomingHttpHeaders, json: boolean): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(incoming)) {
      if (v === undefined || DROP_REQUEST.test(k)) continue;
      out[k] = Array.isArray(v) ? v.join(', ') : v;
    }
    const auth = cfg.upstreamApiKey ? `Bearer ${cfg.upstreamApiKey}` : incoming.authorization;
    if (auth) out.authorization = auth;
    if (json) out['content-type'] = 'application/json';
    return out;
  }

  function upstreamUrl(path: string): string {
    return `${cfg.upstreamBaseUrl}${path.replace(/^\/v1(?=\/|\?|$)/, '')}`;
  }

  function copyHead(res: ServerResponse, up: Response): void {
    const headers: Record<string, string> = {};
    up.headers.forEach((v, k) => { if (!DROP_RESPONSE.test(k)) headers[k] = v; });
    res.writeHead(up.status, headers);
  }

  /** Any other `/v1/*` request: streamed both ways, unchanged (apart from auth and identity headers). */
  async function passThrough(req: IncomingMessage, res: ServerResponse, body?: Buffer): Promise<void> {
    const ctrl = new AbortController();
    res.on('close', () => { if (!res.writableFinished) ctrl.abort(); });
    const hasBody = !['GET', 'HEAD'].includes(req.method ?? 'GET');
    const up = await upstreamFetch(upstreamUrl(req.url ?? '/'), {
      method: req.method,
      headers: upstreamHeaders(req.headers, false),
      body: hasBody ? (body ?? (Readable.toWeb(req) as unknown as BodyInit)) : undefined,
      signal: ctrl.signal,
      ...(hasBody && !body ? { duplex: 'half' } : {}),
    } as RequestInit);
    copyHead(res, up);
    if (up.body) for await (const chunk of up.body as unknown as AsyncIterable<Uint8Array>) res.write(chunk);
    res.end();
  }

  /** Who and what this chat request is about (null turn = nothing remembered), with the markers removed. */
  function turnOf(req: IncomingMessage, chat: ChatRequest): { turn: Turn | null; chat: ChatRequest } {
    const { identity, messages } = resolveIdentity(cfg, req.headers, chat.messages ?? []);
    const out = { ...chat, messages };
    if (!identity || !memory || req.headers['x-recordare-skip']) return { turn: null, chat: out };
    const li = lastUserIndex(messages);
    if (li < 0) return { turn: null, chat: out };
    const raw = textOf(messages[li]?.content);
    if (isBackgroundCall(raw, cfg.skipPatterns)) return { turn: null, chat: out };
    const text = personText(raw);
    if (!text) return { turn: null, chat: out };
    const ordinal = messages.slice(0, li + 1).filter((m) => m.role === 'user').length;
    return { turn: { identity, text, ordinal, model: typeof chat.model === 'string' ? chat.model : undefined }, chat: out };
  }

  async function chatCompletions(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await readBody(req, cfg.maxBodyBytes);
    let parsed: ChatRequest;
    try {
      parsed = JSON.parse(body.toString('utf8')) as ChatRequest;
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.messages)) throw new Error('no messages');
    } catch {
      await passThrough(req, res, body); // not ours to judge: the provider answers
      return;
    }
    const { turn, chat } = turnOf(req, parsed);
    if (turn && memory) {
      const block = await memory.beforeTurn(turn).catch(() => null);
      if (block) chat.messages = injectBlock(chat.messages ?? [], block);
    }
    if (cfg.logUpstream) log.info(`upstream request (stream: ${chat.stream === true}, tools: ${Array.isArray(chat.tools) ? chat.tools.length : 0}): ${JSON.stringify(chat.messages)}`);

    const ctrl = new AbortController();
    let aborted = false;
    res.on('close', () => { if (!res.writableFinished) { aborted = true; ctrl.abort(); } });
    const up = await upstreamFetch(upstreamUrl(req.url ?? '/v1/chat/completions'), {
      method: 'POST', headers: upstreamHeaders(req.headers, true), body: JSON.stringify(chat), signal: ctrl.signal,
    });
    copyHead(res, up);
    const isStream = (up.headers.get('content-type') ?? '').includes('text/event-stream');
    let answer: Answer | null = null;
    if (isStream && up.body) {
      const acc = new StreamAccumulator();
      for await (const chunk of up.body as unknown as AsyncIterable<Uint8Array>) {
        res.write(chunk);
        acc.push(chunk);
      }
      res.end();
      answer = acc.finish();
    } else {
      const text = await up.text();
      res.end(text);
      try { answer = answerOfJson(JSON.parse(text)); } catch { answer = null; }
    }
    // Only a complete final answer of a successful call is captured (not tool calls of an agent loop, not a cut stream).
    if (turn && memory && up.ok && !aborted && answer?.complete && !answer.toolCalls && answer.text.trim()) {
      memory.afterTurn(turn, answer.text);
    }
  }

  return createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0] ?? '/';
    if (req.method === 'GET' && (path === '/health' || path === '/healthz')) {
      sendJson(res, 200, { status: 'ok', recordare: memory ? 'configured' : 'off', queued: memory?.queued() ?? 0 });
      return;
    }
    if (!path.startsWith('/v1/')) {
      openAiError(res, 404, 'not found', 'not_found');
      return;
    }
    if (cfg.proxyApiKey) {
      const given = bearer(req.headers);
      if (!given || !sameSecret(given, cfg.proxyApiKey)) {
        openAiError(res, 401, 'invalid proxy key', 'invalid_request_error');
        return;
      }
    }
    const handler = req.method === 'POST' && path === '/v1/chat/completions' ? chatCompletions(req, res) : passThrough(req, res);
    handler.catch((err: unknown) => {
      log.warn(`proxy: ${req.method} ${path} failed (${errName(err)})`);
      if (!res.headersSent) openAiError(res, errName(err) === 'body too large' ? 413 : 502, 'upstream unavailable');
      else res.end();
    });
  });
}
