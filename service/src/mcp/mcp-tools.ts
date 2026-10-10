// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * MCP tools (docs/API.md §3). Schemas stay in the provider-neutral subset (flat objects, enums,
 * plain strings — D27). Reads use the whole memory in every conversation (D50: no viewer filter for now); writes
 * need a resolvable conversation (an ingested one, or none with a personal token) to bind their evidence.
 */
import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { type Principal } from '../auth/principal';
import { CONVERSATION_HEADER, type ConversationResolver, type ResolvedConversation } from '../auth/conversation-resolver.service';
import { localDate } from '../engine/time';
import { type ClockPort } from '../clock/clock.port';
import { type EpisodeSearchService } from '../recall/episode-search.service';
import { type MemorySearchService } from '../recall/memory-search.service';
import { type MemoryWriteService } from '../recall/memory-write.service';
import { resolvePeriod } from '../recall/period';
import { createHash } from 'node:crypto';
import { type KnowledgeSearchService } from '../knowledge/knowledge-search.service';
import { type SourcesService } from '../knowledge/sources.service';
import { SOURCE_KINDS } from '../knowledge/sources.schemas';

export interface ToolDeps {
  principal: Principal;
  ownerId: string;
  conversations: ConversationResolver;
  episodes: EpisodeSearchService;
  memory: MemorySearchService;
  writes: MemoryWriteService;
  knowledge: KnowledgeSearchService;
  sources: SourcesService;
  clock: ClockPort;
  owner: { timezone: string; locale: string };
  allowClockOverride: boolean;
}

type Headers = Record<string, string | string[] | undefined>;
type Extra = { requestInfo?: { headers?: unknown }; _meta?: unknown };

function header(h: Headers | undefined, name: string): string | undefined {
  const v = h?.[name];
  return Array.isArray(v) ? v[0] : v;
}

export const NOW_HEADER = 'x-recordare-now';
const precision = z.enum(['day', 'month', 'year', 'approximate']).optional();
/** ISO date (YYYY-MM-DD) or month (YYYY-MM): anything else is rejected with a clear message. */
const isoDay = z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/, 'use an ISO date YYYY-MM-DD (or YYYY-MM); see resolve_period');

export function registerTools(server: McpServer, deps: ToolDeps): void {
  const clientId = deps.principal.kind === 'admin' ? null : deps.principal.clientId;

  async function context(extra: Extra): Promise<ResolvedConversation> {
    const headers = extra.requestInfo?.headers as Headers | undefined;
    const meta = (extra._meta ?? {}) as { recordare?: { conversation?: string } };
    return deps.conversations.resolve(deps.principal, deps.ownerId, header(headers, CONVERSATION_HEADER) ?? meta.recordare?.conversation);
  }
  const writable = (ctx: ResolvedConversation) => ctx.source !== 'none' && clientId !== null;
  /** "Now" of the request: the clock, or X-Recordare-Now when the deployment allows it (eval / tests). */
  function now(extra: Extra): Date {
    const v = deps.allowClockOverride ? header(extra.requestInfo?.headers as Headers | undefined, NOW_HEADER) : undefined;
    const d = v ? new Date(v) : null;
    return d && !Number.isNaN(d.getTime()) ? d : deps.clock.now();
  }

  server.registerTool('search_episodes', {
    title: 'Search what happened',
    description:
      'Search your memory of what happened: what you lived, did, planned or learned, and what happened to the people you '
      + 'know (events, plans, changes), with dates and status. Each item has a subject: you (written in the first person), '
      + 'a person by name, someone, or undecided. Use `from`/`to` (ISO dates, inclusive; see resolve_period) for questions '
      + 'about a period. mode: "search" = most relevant, "list" = chronological in the period (overviews, counting), '
      + '"latest" = most recent first ("when did I last…").',
    inputSchema: {
      query: z.string().optional().describe('What to look for — pass the question also when listing a period: it ranks '
        + 'the items and finds the matching chat excerpts'),
      from: isoDay.optional().describe('Start date, ISO (YYYY-MM-DD or YYYY-MM)'),
      to: isoDay.optional().describe('End date, ISO (YYYY-MM-DD or YYYY-MM), inclusive'),
      mode: z.enum(['search', 'list', 'latest']).optional(),
      include_plans: z.boolean().optional(),
      limit: z.number().int().min(1).max(50).optional(),
    },
  }, async (args, extra) => {
    const ctx = await context(extra);
    return result(await deps.episodes.search(deps.ownerId, clientId, {
      conversationId: ctx.conversationId, query: args.query, from: args.from, to: args.to, mode: args.mode, includePlans: args.include_plans, limit: args.limit,
    }, now(extra)) as unknown as Record<string, unknown>);
  });

  server.registerTool('search_memory', {
    title: 'Search what you know about yourself and others',
    description: 'Search your memory of preferences, habits, values, relationships, knowledge and current state (car, home, '
      + 'job…) — yours and of the people you know; each item has its subject. Use `as_of` (ISO date) for "what was it on '
      + 'that date" questions; each fact comes with its history.',
    inputSchema: {
      query: z.string().describe('Topic'),
      as_of: isoDay.optional().describe('ISO date (YYYY-MM-DD); default today'),
      include_pending: z.boolean().optional(),
    },
  }, async (args, extra) => {
    const ctx = await context(extra);
    return result(await deps.memory.search(deps.ownerId, { conversationId: ctx.conversationId, query: args.query, asOf: args.as_of, includePending: args.include_pending }, now(extra)) as unknown as Record<string, unknown>);
  });

  server.registerTool('search_knowledge', {
    title: 'Search what you learned',
    description: 'Search the sources you learned (manuals, documents, pages, notes you were given or wrote): passages of their '
      + 'text, each with its source (title, author, who gave it, when) and the episodes that refer to it. For what happened, '
      + 'use search_episodes.',
    inputSchema: { query: z.string().describe('What to look up'), limit: z.number().int().min(1).max(20).optional() },
  }, async (args, extra) => {
    const ctx = await context(extra);
    return result(await deps.knowledge.search(deps.ownerId, { query: args.query, limit: args.limit, conversationId: ctx.conversationId }, now(extra)) as unknown as Record<string, unknown>);
  });

  server.registerTool('learn_source', {
    title: 'Learn a text',
    description: 'Learn a text as knowledge (a manual, a page, a note — as plain text; send it again with the same title to replace '
      + 'it). It stays searchable with search_knowledge; the learning becomes a memory of this conversation.',
    inputSchema: {
      title: z.string(),
      text: z.string(),
      author: z.string().optional(),
      kind: z.enum(SOURCE_KINDS).optional(),
      uri: z.string().optional(),
    },
  }, async (args, extra) => {
    const ctx = await context(extra);
    if (!writable(ctx)) return result({ error: 'cannot write here' });
    const externalId = `mcp:${createHash('sha256').update(args.title.trim().toLowerCase()).digest('hex').slice(0, 32)}`;
    const r = await deps.sources.learn(deps.ownerId, clientId, {
      externalId, title: args.title, text: args.text, kind: args.kind ?? 'document', author: args.author, uri: args.uri, providedBy: 'me', final: true,
    }, now(extra), ctx.conversationId);
    return result({ sourceId: r.sourceId, status: r.status, passages: r.passages, stored: !r.duplicate });
  });

  server.registerTool('resolve_period', {
    title: 'Turn a period expression into dates',
    description: 'Deterministic: "questa settimana", "la settimana scorsa", "a febbraio", "lo scorso dicembre", "last week"… → {from, to} (ISO, inclusive).',
    inputSchema: { expression: z.string() },
  }, async (args, extra) => {
    const today = localDate(now(extra), deps.owner.timezone);
    const p = resolvePeriod(args.expression, today);
    return result(p ? { ...p } : { error: 'unknown expression: pass explicit dates (from / to)' });
  });

  server.registerTool('log_episode', {
    title: 'Note something that happened or is planned',
    description: 'Explicit capture ("note that today I serviced the car"). Resolve the date yourself (ISO).',
    inputSchema: {
      content: z.string(),
      kind: z.enum(['event', 'plan']).optional(),
      occurred_at: isoDay.optional(),
      occurred_until: isoDay.optional(),
      date_precision: precision,
      people: z.array(z.string()).optional(),
      place: z.string().optional(),
    },
  }, async (args, extra) => {
    const ctx = await context(extra);
    if (!writable(ctx)) return result({ error: 'cannot write here' });
    const id = await deps.writes.logEpisode(deps.ownerId, { conversationId: ctx.conversationId, clientId: clientId as string, ownerDirect: deps.principal.kind === 'owner_token' }, {
      content: args.content, kind: args.kind, occurredAt: args.occurred_at, occurredUntil: args.occurred_until,
      datePrecision: args.date_precision, people: args.people, place: args.place,
    });
    return result({ id, stored: true });
  });

  server.registerTool('remember', {
    title: 'Remember something',
    description: 'Explicit "remember that…" about preferences, habits, values, knowledge.',
    inputSchema: {
      content: z.string(),
      category: z.enum(['preference', 'habit', 'value', 'relationship', 'knowledge', 'profile', 'constraint']).optional(),
    },
  }, async (args, extra) => {
    const ctx = await context(extra);
    if (!writable(ctx)) return result({ error: 'cannot write here' });
    const id = await deps.writes.remember(deps.ownerId, { conversationId: ctx.conversationId, clientId: clientId as string, ownerDirect: deps.principal.kind === 'owner_token' }, args);
    return result({ id, stored: true });
  });

  server.registerTool('correct_episode', {
    title: 'Correct a memory',
    description: 'Correct a remembered episode (wrong date or detail). The old version is kept as history, never shown as current.',
    inputSchema: { id: z.uuid(), content: z.string().optional(), occurred_at: isoDay.optional(), date_precision: precision },
  }, async (args, extra) => {
    const ctx = await context(extra);
    if (!writable(ctx)) return result({ error: 'cannot write here' });
    const id = await deps.writes.correctEpisode(deps.ownerId, { conversationId: ctx.conversationId, clientId: clientId as string, ownerDirect: deps.principal.kind === 'owner_token' }, {
      id: args.id, content: args.content, occurredAt: args.occurred_at, datePrecision: args.date_precision,
    });
    return result({ id, stored: true });
  });

  server.registerTool('forget_episode', {
    title: 'Forget a memory',
    description: 'Forget an episode, when asked to. It is deleted with its corrections and never recreated.',
    inputSchema: { id: z.uuid() },
  }, async (args, extra) => {
    const ctx = await context(extra);
    if (!writable(ctx)) return result({ error: 'cannot write here' });
    await deps.writes.forgetEpisode(deps.ownerId, args.id);
    return result({ forgotten: true });
  });
}

function result(payload: Record<string, unknown>) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload) }], structuredContent: payload };
}
