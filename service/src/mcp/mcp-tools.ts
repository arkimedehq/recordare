// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * MCP tools (docs/API.md §3). Schemas stay in the provider-neutral subset (flat objects, enums,
 * plain strings — D27). Reads use the whole memory in every conversation (D50), except private memories (D52): told only
 * to whoever they belong to — the speaker of the conversation's latest turn — and to a personal memory's holder; writes
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
import { type ProceduresService } from '../procedures/procedures.service';
import { MAX_STEPS, STEP_CHARS } from '../procedures/procedures.schemas';

export interface ToolDeps {
  principal: Principal;
  memoryId: string;
  conversations: ConversationResolver;
  episodes: EpisodeSearchService;
  memory: MemorySearchService;
  writes: MemoryWriteService;
  knowledge: KnowledgeSearchService;
  sources: SourcesService;
  procedures: ProceduresService;
  clock: ClockPort;
  settings: { timezone: string; locale: string; personal: boolean };
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
    return deps.conversations.resolve(deps.principal, deps.memoryId, header(headers, CONVERSATION_HEADER) ?? meta.recordare?.conversation);
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
      + 'about a period; a vague span ("lately", "these weeks") is not a period: leave them out. '
      + 'mode: "search" = most relevant, "list" = chronological in the period (overviews, counting), '
      + '"latest" = most recent first ("when did I last…"). An item or chat excerpt marked `heard` was overheard in the room '
      + 'by a listening device, not said to you: tell it as heard at home, and its speaker may have been misrecognised — '
      + 'what it says of you may be someone else\'s. An item marked `seen` is something your own senses noticed (a camera, '
      + 'a microphone, a sensor): tell it as seen, not as told, and who you recognised in it may be wrong. A chat excerpt by `assistant` is your own earlier reply: what you told '
      + 'them then (advice, a recipe, a name), not something they lived.',
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
    return result(await deps.episodes.search(deps.memoryId, clientId, {
      conversationId: ctx.conversationId, query: args.query, from: args.from, to: args.to, mode: args.mode, includePlans: args.include_plans, limit: args.limit,
    }, now(extra)) as unknown as Record<string, unknown>);
  });

  server.registerTool('search_memory', {
    title: 'Search what you know about yourself and others',
    description: 'Search your memory of preferences, habits, values, relationships, knowledge and current state (car, home, '
      + 'job…) — yours and of the people you know; each item has its subject. Use `as_of` (ISO date) for "what was it on '
      + 'that date" questions; each fact comes with its history. A note with `pattern` is a habit you noticed yourself in '
      + 'repeated episodes, not something said: tell it as such. A note with `learned` you read (a search, a page): say where '
      + 'and when; unless `confirmed`, it is not confirmed yet, and with `mayBeOutdated` it may have changed since.',
    inputSchema: {
      query: z.string().describe('Topic'),
      as_of: isoDay.optional().describe('ISO date (YYYY-MM-DD); default today'),
      include_pending: z.boolean().optional(),
    },
  }, async (args, extra) => {
    const ctx = await context(extra);
    return result(await deps.memory.search(deps.memoryId, { conversationId: ctx.conversationId, query: args.query, asOf: args.as_of, includePending: args.include_pending }, now(extra)) as unknown as Record<string, unknown>);
  });

  server.registerTool('search_knowledge', {
    title: 'Search what you learned',
    description: 'Search the sources you learned (manuals, documents, pages, notes you were given or wrote): first the '
      + 'procedures about it, whole (how to do a task: its steps in order — follow `here`, the household\'s own way, above the '
      + 'generic step; a step with `failed` went wrong last time; unless `learned.confirmed`, say it is not confirmed), then '
      + 'passages of their text, each with its source (title, author, who gave it, when) and the episodes that refer to it. '
      + 'For what happened, use search_episodes.',
    inputSchema: { query: z.string().describe('What to look up'), limit: z.number().int().min(1).max(20).optional() },
  }, async (args, extra) => {
    const ctx = await context(extra);
    const procedures = await deps.procedures.search(deps.memoryId, args.query, 2);
    const found = await deps.knowledge.search(deps.memoryId, { query: args.query, limit: args.limit, conversationId: ctx.conversationId }, now(extra));
    return result({ procedures, ...found } as unknown as Record<string, unknown>);
  });

  server.registerTool('learn_procedure', {
    title: 'Learn how to do a task',
    description: 'Keep a task of several steps whole, to do it later or tell how (making the bed, starting the dishwasher): '
      + 'the steps in order, as taught or read — do not drop or "improve" steps. from "page" when you read it (a search, a '
      + 'page, a learned source: give its uri or source_id), "person" when the person speaking taught it. To add how it is '
      + 'done here to a procedure you hold (the household\'s own way of a step), pass variant_of (its id), variant and step. '
      + 'Whether it is trusted is decided by who brought it, not by you.',
    inputSchema: {
      title: z.string().optional().describe('The task, as people name it'),
      when: z.string().optional().describe('When it is used, if it matters'),
      steps: z.array(z.string()).max(MAX_STEPS).optional().describe(`The steps in order (at most ${MAX_STEPS}, ${STEP_CHARS} characters each)`),
      from: z.enum(['page', 'person']).optional(),
      uri: z.string().optional(),
      source_id: z.uuid().optional(),
      variant_of: z.uuid().optional().describe('A procedure you hold: add the household\'s way to it'),
      variant: z.string().optional(),
      step: z.number().int().min(1).optional().describe('The step the variant changes; none: the whole task'),
    },
  }, async (args, extra) => {
    const ctx = await context(extra);
    if (!writable(ctx)) return result({ error: 'cannot write here' });
    const who = { conversationId: ctx.conversationId ?? null, personal: deps.settings.personal };
    try {
      if (args.variant_of) {
        if (!args.variant) return result({ error: 'variant_of needs variant (how it is done here)' });
        return result(await deps.procedures.variant(deps.memoryId, args.variant_of, who, { step: args.step, text: args.variant.slice(0, STEP_CHARS) }, now(extra)));
      }
      const steps = (args.steps ?? []).map((s) => s.trim()).filter(Boolean).map((s) => s.slice(0, STEP_CHARS));
      if (!args.title || !steps.length || !args.from) return result({ error: 'title, steps and from are required' });
      return result(await deps.procedures.learn(deps.memoryId, who, { title: args.title.slice(0, 300), when: args.when?.slice(0, 500), steps, from: args.from,
        uri: args.uri, sourceId: args.source_id }, now(extra)));
    } catch (err) {
      return result({ error: (err as Error).message });
    }
  });

  server.registerTool('report_procedure_run', {
    title: 'Tell how a task went',
    description: 'After doing a procedure (or when a person corrects how you did it): done; failed (at step N, what went wrong); '
      + 'corrected (at step N, note = the right way, as the person said it — it becomes the household\'s way).',
    inputSchema: {
      procedure_id: z.uuid(),
      outcome: z.enum(['done', 'failed', 'corrected']),
      step: z.number().int().min(1).optional(),
      note: z.string().optional(),
    },
  }, async (args, extra) => {
    const ctx = await context(extra);
    if (!writable(ctx)) return result({ error: 'cannot write here' });
    if (args.outcome === 'corrected' && !args.note?.trim()) return result({ error: 'a correction needs its note (the right way)' });
    try {
      return result(await deps.procedures.run(deps.memoryId, args.procedure_id, { conversationId: ctx.conversationId ?? null, personal: deps.settings.personal },
        { outcome: args.outcome, step: args.step, note: args.note?.trim().slice(0, STEP_CHARS) }, now(extra)));
    } catch (err) {
      return result({ error: (err as Error).message });
    }
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
      for_task: z.boolean().optional().describe('true when you learn it in order to do a task (a manual, a how-to): its procedures may be kept'),
    },
  }, async (args, extra) => {
    const ctx = await context(extra);
    if (!writable(ctx)) return result({ error: 'cannot write here' });
    const externalId = `mcp:${createHash('sha256').update(args.title.trim().toLowerCase()).digest('hex').slice(0, 32)}`;
    const r = await deps.sources.learn(deps.memoryId, clientId, {
      externalId, title: args.title, text: args.text, kind: args.kind ?? 'document', author: args.author, uri: args.uri, providedBy: 'me', final: true,
      ...(args.for_task !== undefined ? { forTask: args.for_task } : {}),
    }, now(extra), ctx.conversationId);
    return result({ sourceId: r.sourceId, status: r.status, passages: r.passages, stored: !r.duplicate });
  });

  server.registerTool('resolve_period', {
    title: 'Turn a period expression into dates',
    description: 'Deterministic: "questa settimana", "la settimana scorsa", "a febbraio", "lo scorso dicembre", "last week"… → {from, to} (ISO, inclusive).',
    inputSchema: { expression: z.string() },
  }, async (args, extra) => {
    const today = localDate(now(extra), deps.settings.timezone);
    const p = resolvePeriod(args.expression, today);
    return result(p ? { ...p } : { error: 'unknown expression: pass explicit dates (from / to)' });
  });

  server.registerTool('log_episode', {
    title: 'Note something that happened or is planned',
    description: 'Explicit capture ("note that today I serviced the car"). Resolve the date yourself (ISO).'
      + ' Conversations are remembered automatically: use it only when explicitly asked, and never ask whether to remember or save something.',
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
    const id = await deps.writes.logEpisode(deps.memoryId, { conversationId: ctx.conversationId, clientId: clientId as string, memoryDirect: deps.principal.kind === 'memory_token' }, {
      content: args.content, kind: args.kind, occurredAt: args.occurred_at, occurredUntil: args.occurred_until,
      datePrecision: args.date_precision, people: args.people, place: args.place,
    });
    return result({ id, stored: true });
  });

  server.registerTool('remember', {
    title: 'Remember something',
    description: 'Explicit "remember that…" about preferences, habits, values, knowledge.'
      + ' Conversations are remembered automatically: use it only when explicitly asked, and never ask whether to remember or save something.',
    inputSchema: {
      content: z.string(),
      category: z.enum(['preference', 'habit', 'value', 'relationship', 'knowledge', 'profile', 'constraint']).optional(),
    },
  }, async (args, extra) => {
    const ctx = await context(extra);
    if (!writable(ctx)) return result({ error: 'cannot write here' });
    const id = await deps.writes.remember(deps.memoryId, { conversationId: ctx.conversationId, clientId: clientId as string, memoryDirect: deps.principal.kind === 'memory_token' }, args);
    return result({ id, stored: true });
  });

  server.registerTool('correct_episode', {
    title: 'Correct a memory',
    description: 'Correct a remembered episode (wrong date or detail). The old version is kept as history, never shown as current.',
    inputSchema: { id: z.uuid(), content: z.string().optional(), occurred_at: isoDay.optional(), date_precision: precision },
  }, async (args, extra) => {
    const ctx = await context(extra);
    if (!writable(ctx)) return result({ error: 'cannot write here' });
    const id = await deps.writes.correctEpisode(deps.memoryId, { conversationId: ctx.conversationId, clientId: clientId as string, memoryDirect: deps.principal.kind === 'memory_token' }, {
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
    await deps.writes.forgetEpisode(deps.memoryId, args.id, { conversationId: ctx.conversationId });
    return result({ forgotten: true });
  });
}

function result(payload: Record<string, unknown>) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload) }], structuredContent: payload };
}
