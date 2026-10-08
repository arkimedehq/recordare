// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/** The plugin's configuration (`plugins.entries.recordare.config` in openclaw.json); mirrors openclaw.plugin.json. */
export interface RecordareConfig {
  /** Recordare's address, e.g. `http://localhost:8080`. */
  url: string;
  /** A client key (`rk_…`, several people) or a personal token (`rp_…`, one person). */
  apiKey: string;
  /** `"<channel>:<senderId>"` → Recordare user (the client's user id; with a personal token any non-empty value). */
  users: Record<string, string>;
  /** The user of turns without a channel sender (CLI, Control UI, the owner); empty = such turns are not remembered. */
  defaultUser?: string;
  /** Add the memories relevant to each message before the agent answers. */
  autoRecall: boolean;
  /** Send the conversation to Recordare. */
  capture: boolean;
  /** Offer the recordare_* memory tools. */
  tools: boolean;
  /** Capture group chats too (the turns of mapped senders, with the other members' messages as context). */
  groups: boolean;
  /** Per call to Recordare before the agent answers (ingest of the message, then the context): default 3000 ms. */
  timeoutMs: number;
  /** True for a personal token: one person, Recordare ignores the user header. */
  personal: boolean;
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);

/** Parses the plugin config (with RECORDARE_URL / RECORDARE_API_KEY as fallbacks); null when url or key is missing. */
export function parseConfig(raw: Record<string, unknown> | undefined, env: NodeJS.ProcessEnv = process.env): RecordareConfig | null {
  const c = raw ?? {};
  const url = str(c.url) ?? str(env.RECORDARE_URL);
  const apiKey = str(c.apiKey) ?? str(env.RECORDARE_API_KEY);
  if (!url || !apiKey) return null;
  const users: Record<string, string> = {};
  if (c.users && typeof c.users === 'object') {
    for (const [k, v] of Object.entries(c.users as Record<string, unknown>)) {
      const user = str(v);
      if (user) users[k.trim()] = user;
    }
  }
  const personal = apiKey.startsWith('rp_');
  return {
    url,
    apiKey,
    users,
    // A personal token is one person: with no mapping at all, every turn is theirs (single-person install).
    defaultUser: str(c.defaultUser) ?? (personal ? 'me' : undefined),
    autoRecall: bool(c.autoRecall, true),
    capture: bool(c.capture, true),
    tools: bool(c.tools, true),
    groups: bool(c.groups, true),
    timeoutMs: typeof c.timeoutMs === 'number' && c.timeoutMs > 0 ? c.timeoutMs : 3000,
    personal,
  };
}
