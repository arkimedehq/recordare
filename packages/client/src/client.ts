// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import {
  CONVERSATION_HEADER, type Digest, type Episode, type EpisodeDetail, type EpisodeQuery, type Fact, type IngestRequest, type IngestResult,
  type LearnSource, type LearnSourceResult, MAX_MESSAGES_PER_REQUEST, type Me, type MeSettings, type MemoryContext, type Note, type PlanStatus,
  type Precision, type Source, SOURCE_PART_BYTES,
} from './contract.js';
import { MemoryNotEmptyError, RecordareHttpError } from './errors.js';
import { type ClientOptions, Http } from './http.js';
import { RecordareMcp, type McpOptions } from './mcp.js';

const enc = encodeURIComponent;

/** Query string from the defined values. */
function qs(query: object): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null) params.set(k, String(v));
  const s = params.toString();
  return s ? `?${s}` : '';
}

/**
 * Recordare for one platform (docs/INTEGRATION.md): who a user is, their settings, the conversations
 * the platform sends, deletions, and recall over MCP. Stateless apart from MCP sessions; a host keeps its own outbox and
 * cache (see `delivery` and `PersonDirectory`).
 */
export class RecordareClient {
  readonly http: Http;
  readonly mcp: RecordareMcp;

  constructor(options: ClientOptions & { mcp?: McpOptions }) {
    this.http = new Http(options);
    this.mcp = new RecordareMcp(this.http, options.mcp);
  }

  /** The memory behind `user` (auto-provisioned when the client allows it), its mode and gender. */
  me(user: string): Promise<Me> {
    return this.http.request<Me>('GET', 'api/v1/me', { user });
  }

  /** The memory's settings from the platform: the name (keep it in sync on every rename), the mode and the gender. */
  async updateMe(user: string, settings: MeSettings): Promise<void> {
    try {
      await this.http.request('PATCH', 'api/v1/me', { user, body: settings });
    } catch (err) {
      if (err instanceof RecordareHttpError && err.status === 409) throw new MemoryNotEmptyError();
      throw err;
    }
  }

  /**
   * Sends messages of one conversation, split into requests of at most MAX_MESSAGES_PER_REQUEST. Idempotent: Recordare
   * deduplicates on each message's externalId. Recordare always stores (D50): the on/off switch is the platform's.
   */
  async ingest(user: string, req: IngestRequest): Promise<IngestResult> {
    const total: IngestResult = { conversationId: null, accepted: 0, duplicates: 0, conflicts: [] };
    for (let i = 0; i < req.messages.length; i += MAX_MESSAGES_PER_REQUEST) {
      const last = i + MAX_MESSAGES_PER_REQUEST >= req.messages.length;
      const part = await this.http.request<IngestResult>('POST', 'api/v1/ingest/messages', {
        user,
        body: {
          conversation: req.conversation,
          messages: req.messages.slice(i, i + MAX_MESSAGES_PER_REQUEST),
          // The end-of-conversation hint belongs to the last part only.
          ...(req.hints && last ? { hints: req.hints } : {}),
        },
      });
      total.conversationId = part.conversationId ?? total.conversationId;
      total.accepted += part.accepted;
      total.duplicates += part.duplicates;
      total.conflicts.push(...part.conflicts);
    }
    return total;
  }

  /**
   * The memories relevant to `query` (the message about to be answered) as a fenced block to append to the prompt — or
   * null. Append it at the end of the system prompt (it changes every turn: keep the stable part first for prompt
   * caching); never store it as a chat message.
   */
  context(user: string, conversation: string, query: string): Promise<MemoryContext> {
    return this.http.request<MemoryContext>('POST', 'api/v1/context', { user, body: { query }, headers: { [CONVERSATION_HEADER]: conversation } });
  }

  /**
   * Stores the turn and returns the memory context for it in one round trip (needs the `ingest` and `read` scopes):
   * the context is computed for the ingested conversation, from `query` or else the turn's last user message.
   */
  contextWithTurn(user: string, turn: IngestRequest, query?: string): Promise<MemoryContext> {
    return this.http.request<MemoryContext>('POST', 'api/v1/context', { user, body: { ingest: turn, ...(query ? { query } : {}) } });
  }

  /** The conversation ended (session closed, /new): extraction runs now. A conversation Recordare never had is done. */
  async endConversation(user: string, conversation: string): Promise<void> {
    await this.gone(this.http.request('POST', `api/v1/ingest/conversations/${enc(conversation)}/end`, { user }));
  }

  /** An edited message: Recordare re-extracts what depended on it. */
  async editMessage(user: string, conversation: string, message: string, content: string): Promise<void> {
    await this.http.request('PATCH', `api/v1/ingest/conversations/${enc(conversation)}/messages/${enc(message)}`, { user, body: { content } });
  }

  /** A deleted message: Recordare forgets it and what came only from it. A message it never had counts as done. */
  async deleteMessage(user: string, conversation: string, message: string): Promise<void> {
    await this.gone(this.http.request('DELETE', `api/v1/ingest/conversations/${enc(conversation)}/messages/${enc(message)}`, { user }));
  }

  /** A deleted conversation. A conversation Recordare never had counts as done. */
  async deleteConversation(user: string, conversation: string): Promise<void> {
    await this.gone(this.http.request('DELETE', `api/v1/ingest/conversations/${enc(conversation)}`, { user }));
  }

  // ── Learned sources (WORK_PLAN 8.9, D49): text the agent learns — the client turns files into text ─────────────

  /**
   * The agent learns a text. A big one is sent in parts (at paragraph boundaries, `partBytes` each); any size works.
   * Sending the same `externalId` again replaces the source; the same first part again is a duplicate.
   */
  async learnSource(user: string, source: LearnSource, partBytes = SOURCE_PART_BYTES): Promise<LearnSourceResult> {
    const [first = '', ...rest] = splitParts(source.text, partBytes);
    let result = await this.http.request<LearnSourceResult>('POST', 'api/v1/ingest/sources', { user, body: { ...source, text: first, final: rest.length === 0 } });
    if (result.duplicate) return result;
    for (const [i, text] of rest.entries()) {
      result = await this.http.request<LearnSourceResult>('POST', `api/v1/ingest/sources/${enc(source.externalId)}/parts`,
        { user, body: { part: i + 1, text, final: i === rest.length - 1 } });
    }
    return result;
  }

  /** The agent forgets a source (its text and passages; episodes keep a "forgotten source" marker). One it never had counts as done. */
  async forgetSource(user: string, externalId: string): Promise<void> {
    await this.http.request('DELETE', `api/v1/ingest/sources/${enc(externalId)}`, { user });
  }

  /** What the agent learned, newest first. */
  sources(user: string): Promise<Source[]> {
    return this.http.request('GET', 'api/v1/sources', { user });
  }

  // ── The diary (API.md §4): what Recordare remembers, shown to the person in the platform's UI ──────────────────

  /** The timeline, newest first; pass `nextCursor` back as `cursor` for the next page. */
  episodes(user: string, query: EpisodeQuery = {}): Promise<{ items: Episode[]; nextCursor: string | null }> {
    return this.http.request('GET', `api/v1/episodes${qs(query)}`, { user });
  }

  episode(user: string, id: string): Promise<EpisodeDetail> {
    return this.http.request('GET', `api/v1/episodes/${enc(id)}`, { user });
  }

  /** The person corrects an episode: a new version replaces it (the wrong one stays in its history). */
  async correctEpisode(user: string, id: string, fix: { content?: string; occurredAt?: string; datePrecision?: Exclude<Precision, 'unknown' | 'minute'> }): Promise<string> {
    return (await this.http.request<{ id: string }>('POST', `api/v1/episodes/${enc(id)}/corrections`, { user, body: fix })).id;
  }

  /** The person forgets an episode: it is removed and never recreated. */
  async forgetEpisode(user: string, id: string): Promise<void> {
    await this.http.request('DELETE', `api/v1/episodes/${enc(id)}`, { user });
  }

  digests(user: string, query: { level?: 'day' | 'month'; from?: string; to?: string } = {}): Promise<Digest[]> {
    return this.http.request('GET', `api/v1/digests${qs(query)}`, { user });
  }

  facts(user: string, query: { key?: string; asOf?: string; includePending?: boolean } = {}): Promise<Fact[]> {
    return this.http.request('GET', `api/v1/facts${qs(query)}`, { user });
  }

  notes(user: string, query: { category?: Note['category']; pinned?: boolean; includePending?: boolean } = {}): Promise<Note[]> {
    return this.http.request('GET', `api/v1/notes${qs(query)}`, { user });
  }

  /** Plans, soonest first (open and unresolved unless a status is given). */
  plans(user: string, query: { status?: PlanStatus } = {}): Promise<Episode[]> {
    return this.http.request('GET', `api/v1/plans${qs(query)}`, { user });
  }

  async pinNote(user: string, id: string, pinned: boolean): Promise<void> {
    await this.http.request('PATCH', `api/v1/notes/${enc(id)}`, { user, body: { pinned } });
  }

  /** Removes a note or a fact. */
  async delete(user: string, what: 'notes' | 'facts', id: string): Promise<void> {
    await this.http.request('DELETE', `api/v1/${what}/${enc(id)}`, { user });
  }

  /** A pending (inferred) note or fact: confirmed it becomes the person's, rejected it is removed. */
  async decide(user: string, what: 'notes' | 'facts', id: string, decision: 'confirm' | 'reject'): Promise<void> {
    await this.http.request('POST', `api/v1/${what}/${enc(id)}/${decision}`, { user });
  }

  /** Closes the MCP sessions (on shutdown). */
  close(): Promise<void> {
    return this.mcp.close();
  }

  private async gone(p: Promise<unknown>): Promise<void> {
    try {
      await p;
    } catch (err) {
      if (!(err instanceof RecordareHttpError && err.status === 404)) throw err;
    }
  }
}

/** A text in parts of at most `maxBytes` UTF-8 bytes, cut at paragraph boundaries (inside a long paragraph: at a space, else between characters). */
export function splitParts(text: string, maxBytes: number): string[] {
  const size = (t: string) => Buffer.byteLength(t, 'utf8');
  if (size(text) <= maxBytes) return [text];
  const parts: string[] = [];
  let current = '';
  const push = (piece: string) => {
    const joined = current ? `${current}\n\n${piece}` : piece;
    if (size(joined) <= maxBytes) { current = joined; return; }
    if (current) parts.push(current);
    current = piece;
  };
  for (const paragraph of text.split(/\n\s*\n/)) {
    let rest = paragraph;
    while (size(rest) > maxBytes) {
      let end = rest.length;
      while (end > 0 && size(rest.slice(0, end)) > maxBytes) end = Math.floor(end * 0.9);
      const space = rest.lastIndexOf(' ', end);
      let cut = space > end / 2 ? space : end;
      if (/[\uD800-\uDBFF]/.test(rest.charAt(cut - 1))) cut--; // never between the halves of a surrogate pair
      push(rest.slice(0, cut));
      rest = rest.slice(cut).trimStart();
    }
    if (rest) push(rest);
  }
  if (current) parts.push(current);
  return parts;
}
