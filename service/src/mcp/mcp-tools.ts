// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * MCP tools (docs/API.md §3). Schemas stay in the provider-neutral subset (flat objects, enums,
 * plain strings — D27). M3: `search_episodes` answers from the raw log only (episodes arrive in M4).
 */
import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { type Principal } from '../auth/principal';
import { CONVERSATION_HEADER, VIEWERS_HEADER, type ViewerContextService } from '../auth/viewer-context.service';
import { type RawLogSearchService } from '../rawlog/rawlog-search.service';

export interface ToolDeps {
  principal: Principal;
  ownerId: string;
  viewers: ViewerContextService;
  rawLog: RawLogSearchService;
}

type Headers = Record<string, string | string[] | undefined>;

function header(h: Headers | undefined, name: string): string | undefined {
  const v = h?.[name];
  return Array.isArray(v) ? v[0] : v;
}

const NOTHING = 'nothing to show here';

export function registerTools(server: McpServer, deps: ToolDeps): void {
  server.registerTool('search_episodes', {
    title: 'Search memories',
    description:
      'Search what the user lived, did or planned. Use `from`/`to` (ISO dates, inclusive) for questions about a period. '
      + 'mode: "search" = most relevant, "list" = chronological in the period, "latest" = most recent first ("when did I last…").',
    inputSchema: {
      query: z.string().optional().describe('What to look for'),
      from: z.string().optional().describe('Start date, ISO (YYYY-MM-DD)'),
      to: z.string().optional().describe('End date, ISO (YYYY-MM-DD), inclusive'),
      mode: z.enum(['search', 'list', 'latest']).optional(),
      limit: z.number().int().min(1).max(50).optional(),
    },
  }, async (args, extra) => {
    const headers = extra.requestInfo?.headers as Headers | undefined;
    const meta = (extra._meta ?? {}) as { recordare?: { conversation?: string; viewers?: string[] } };
    const ctx = await deps.viewers.resolve(
      deps.principal, deps.ownerId,
      header(headers, CONVERSATION_HEADER) ?? meta.recordare?.conversation,
      [header(headers, VIEWERS_HEADER), ...(meta.recordare?.viewers ?? [])].filter(Boolean).join(','),
    );
    if (!ctx.ownerOnly) {
      return result({ episodes: [], outsidePeriod: [], digests: [], fromChats: [], notes: [NOTHING] });
    }
    const to = args.to ? endOfDay(args.to) : undefined;
    const from = args.from ? new Date(`${args.from.slice(0, 10)}T00:00:00Z`) : undefined;
    const clientId = deps.principal.kind === 'admin' ? null : deps.principal.clientId;
    const fromChats = args.query
      ? await deps.rawLog.search(deps.ownerId, clientId, { query: args.query, from, to, limit: args.limit ?? 5 })
      : [];
    return result({
      ...(args.from || args.to ? { period: { from: args.from ?? null, to: args.to ?? null } } : {}),
      episodes: [], outsidePeriod: [], digests: [],
      fromChats: fromChats.map(({ score: _score, ...h }) => h),
      notes: fromChats.length ? ['results come from the original chats (verbatim excerpts)'] : [],
    });
  });
}

function endOfDay(iso: string): Date {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function result(payload: Record<string, unknown>) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload) }], structuredContent: payload };
}
