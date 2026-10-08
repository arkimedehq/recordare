// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * The memory tools the plugin offers, each a Recordare MCP tool under a `recordare_` name. OpenClaw needs the names in
 * the manifest (`contracts.tools`) before the plugin runs, so the schemas are a static copy of Recordare's
 * (service/src/mcp/mcp-tools.ts, docs/API.md §3): keep them in sync. `log_episode` is left out on purpose — the
 * conversation is captured, so the agent never needs to log it again (as in Arkimede).
 */

const isoDay = { type: 'string', pattern: '^\\d{4}-\\d{2}(-\\d{2})?$' } as const;
const precision = { type: 'string', enum: ['day', 'month', 'year', 'approximate'] } as const;
const uuid = { type: 'string', description: 'The episode id, from search_episodes' } as const;

export interface ToolSpec {
  /** Recordare's MCP tool name. */
  mcpName: string;
  label: string;
  description: string;
  parameters: Record<string, unknown>;
}

// Extra arguments are allowed (Recordare ignores them): a model adding e.g. a `date` should not lose the call.
const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required });

export const TOOLS: ToolSpec[] = [
  {
    mcpName: 'search_episodes',
    label: 'Recordare: search what happened',
    description: 'Search what the user lived, did or planned (events, plans, changes), with dates and status, in the user\'s '
      + 'long-term memory. Use `from`/`to` (ISO dates, inclusive; see recordare_resolve_period) for questions about a period. '
      + 'mode: "search" = most relevant, "list" = chronological in the period (overviews, counting), "latest" = most recent first.',
    parameters: obj({
      query: { type: 'string', description: 'What to look for — pass the user\'s question also when listing a period' },
      from: { ...isoDay, description: 'Start date, ISO (YYYY-MM-DD or YYYY-MM)' },
      to: { ...isoDay, description: 'End date, ISO (YYYY-MM-DD or YYYY-MM), inclusive' },
      mode: { type: 'string', enum: ['search', 'list', 'latest'] },
      include_plans: { type: 'boolean' },
      limit: { type: 'integer', minimum: 1, maximum: 50 },
    }),
  },
  {
    mcpName: 'search_memory',
    label: 'Recordare: search who the user is',
    description: 'Search the user\'s preferences, habits, values, relationships, knowledge and current state (car, home, job…) '
      + 'in their long-term memory. Use `as_of` (ISO date) for "what was it on that date" questions; each fact comes with its history.',
    parameters: obj({
      query: { type: 'string', description: 'Topic' },
      as_of: { ...isoDay, description: 'ISO date (YYYY-MM-DD); default today' },
      include_pending: { type: 'boolean' },
    }, ['query']),
  },
  {
    mcpName: 'resolve_period',
    label: 'Recordare: period to dates',
    description: 'Deterministic: "this week", "last week", "in February", "last December", "la settimana scorsa"… → {from, to} (ISO, inclusive).',
    parameters: obj({ expression: { type: 'string' } }, ['expression']),
  },
  {
    mcpName: 'remember',
    label: 'Recordare: remember',
    description: 'Explicit "remember that…" about the user\'s preferences, habits, values, knowledge (long-term memory).',
    parameters: obj({
      content: { type: 'string' },
      category: { type: 'string', enum: ['preference', 'habit', 'value', 'relationship', 'knowledge', 'profile', 'constraint'] },
    }, ['content']),
  },
  {
    mcpName: 'correct_episode',
    label: 'Recordare: correct a memory',
    description: 'The user corrects a remembered episode (wrong date or detail). The old version is kept as history, never shown as current.',
    parameters: obj({ id: uuid, content: { type: 'string' }, occurred_at: isoDay, date_precision: precision }, ['id']),
  },
  {
    mcpName: 'forget_episode',
    label: 'Recordare: forget a memory',
    description: 'The user asks to forget an episode. It is deleted with its corrections and never recreated.',
    parameters: obj({ id: uuid }, ['id']),
  },
];

export const toolName = (spec: ToolSpec): string => `recordare_${spec.mcpName}`;
