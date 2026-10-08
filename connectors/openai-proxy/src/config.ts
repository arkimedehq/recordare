// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/** The proxy's configuration, from the environment (README → Configuration). */

export type ResolverName = 'generic' | 'openwebui' | 'anythingllm';

export interface ProxyConfig {
  port: number;
  /** The real OpenAI-compatible provider, e.g. `https://api.deepseek.com/v1`. */
  upstreamBaseUrl: string;
  /** Sent upstream instead of the caller's Authorization; unset = the caller's Authorization goes through. */
  upstreamApiKey?: string;
  /** When set, callers must present it as `Authorization: Bearer …` (then `upstreamApiKey` is required). */
  proxyApiKey?: string;
  /** Recordare; unset = a plain pass-through proxy (nothing remembered). */
  recordareUrl?: string;
  /** A client key (`rk_…`, several people, `X-Recordare-User`) or a personal token (`rp_…`, one person). */
  recordareApiKey?: string;
  /** True for a personal token. */
  personal: boolean;
  /** Identity resolvers, tried in this order. */
  resolvers: ResolverName[];
  /** `"<platform>:<platform user id>"` (or the bare id for generic headers) → Recordare user. */
  userMap: Record<string, string>;
  /** Only mapped users are remembered. */
  mapOnly: boolean;
  /** The user of requests whose marker names no real user (AnythingLLM single-user mode: `[User ID]`). */
  defaultUser?: string;
  /** Open WebUI JWT mode: the HS256 secret (`FORWARD_USER_INFO_HEADER_JWT_SECRET`); set = plain user headers ignored. */
  openWebUiJwtSecret?: string;
  /** Timeout of each Recordare call before the answer (ingest of the message, then the memory context). */
  recallTimeoutMs: number;
  /** After this many quiet seconds the proxy tells Recordare the conversation ended; 0 = leave it to Recordare's idle delay. */
  endIdleSeconds: number;
  /** Time zone of the day buckets used as conversation ids when a platform sends none. */
  timeZone: string;
  /** Extra regular expressions (on the last user message) marking a platform's background call. */
  skipPatterns: RegExp[];
  /** Add the memory context before each answer. */
  recall: boolean;
  /** Send the turns to Recordare. */
  capture: boolean;
  /** Debug only: log the messages sent upstream (personal data). */
  logUpstream: boolean;
  /** Largest accepted request body. */
  maxBodyBytes: number;
}

const str = (v: string | undefined): string | undefined => (v && v.trim() ? v.trim() : undefined);
const bool = (v: string | undefined, d: boolean): boolean => (v === undefined || v === '' ? d : /^(1|true|yes|on)$/i.test(v.trim()));
const num = (v: string | undefined, d: number): number => {
  const n = Number(v);
  return v !== undefined && v.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : d;
};

const RESOLVERS: ResolverName[] = ['generic', 'openwebui', 'anythingllm'];

function parseMap(raw: string | undefined): Record<string, string> {
  if (!raw?.trim()) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('USER_MAP must be a JSON object');
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) if (typeof v === 'string' && v.trim()) out[k.trim()] = v.trim();
  return out;
}

function parsePatterns(raw: string | undefined): RegExp[] {
  if (!raw?.trim()) return [];
  const list: unknown = raw.trim().startsWith('[') ? JSON.parse(raw) : raw.split('||');
  if (!Array.isArray(list)) throw new Error('SKIP_PATTERNS must be a JSON array or "||"-separated');
  return list.map((p) => String(p).trim()).filter(Boolean).map((p) => new RegExp(p, 'i'));
}

/** Throws on an invalid configuration (the process should not start). */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ProxyConfig {
  const upstreamBaseUrl = str(env.UPSTREAM_BASE_URL);
  if (!upstreamBaseUrl) throw new Error('UPSTREAM_BASE_URL is required');
  const proxyApiKey = str(env.PROXY_API_KEY);
  const upstreamApiKey = str(env.UPSTREAM_API_KEY);
  if (proxyApiKey && !upstreamApiKey) throw new Error('PROXY_API_KEY needs UPSTREAM_API_KEY (the caller\'s key is the proxy\'s)');
  const recordareApiKey = str(env.RECORDARE_API_KEY);
  const resolvers = (str(env.RESOLVERS) ?? RESOLVERS.join(',')).split(',').map((s) => s.trim()).filter(Boolean);
  for (const r of resolvers) if (!RESOLVERS.includes(r as ResolverName)) throw new Error(`unknown resolver "${r}"`);
  return {
    port: num(env.PORT, 8788),
    upstreamBaseUrl: upstreamBaseUrl.replace(/\/+$/, ''),
    upstreamApiKey,
    proxyApiKey,
    recordareUrl: str(env.RECORDARE_URL),
    recordareApiKey,
    personal: !!recordareApiKey?.startsWith('rp_'),
    resolvers: resolvers as ResolverName[],
    userMap: parseMap(env.USER_MAP),
    mapOnly: bool(env.USER_MAP_ONLY, false),
    defaultUser: str(env.DEFAULT_USER),
    openWebUiJwtSecret: str(env.OPENWEBUI_JWT_SECRET),
    recallTimeoutMs: num(env.RECALL_TIMEOUT_MS, 1500),
    endIdleSeconds: num(env.END_IDLE_SECONDS, 0),
    timeZone: str(env.TZ) ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    skipPatterns: parsePatterns(env.SKIP_PATTERNS),
    recall: bool(env.RECALL, true),
    capture: bool(env.CAPTURE, true),
    logUpstream: bool(env.LOG_UPSTREAM, false),
    maxBodyBytes: num(env.MAX_BODY_BYTES, 25 * 1024 * 1024),
  };
}
