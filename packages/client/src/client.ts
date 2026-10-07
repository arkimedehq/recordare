// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import {
  type IngestRequest, type IngestResult, MAX_MESSAGES_PER_REQUEST, type Me, type MeSettings,
} from './contract.js';
import { MemoryNotEmptyError, RecordareHttpError } from './errors.js';
import { type ClientOptions, Http } from './http.js';
import { RecordareMcp, type McpOptions } from './mcp.js';

const enc = encodeURIComponent;

/**
 * Recordare for one platform (docs/INTEGRATION.md): who a user is and their consent, their settings, the conversations
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

  /** The person behind `user` (auto-provisioned when the client allows it), their consent and kind of memory. */
  me(user: string): Promise<Me> {
    return this.http.request<Me>('GET', 'api/v1/me', { user });
  }

  /** The person's settings from the platform: the name (keep it in sync on every rename) and the kind of memory. */
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
   * deduplicates on each message's externalId. Before consent nothing is stored (`stored: false`).
   */
  async ingest(user: string, req: IngestRequest): Promise<IngestResult> {
    const total: IngestResult = { conversationId: null, accepted: 0, duplicates: 0, conflicts: [], stored: true };
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
      total.stored &&= part.stored;
    }
    return total;
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
