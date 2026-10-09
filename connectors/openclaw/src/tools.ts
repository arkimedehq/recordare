// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * The memory tools the plugin offers, each a Recordare MCP tool under a `recordare_` name, built from the schemas the
 * client library publishes (`TOOLS`, kept in sync with the service by its conformance suite). OpenClaw needs the names
 * in the manifest (`contracts.tools`) before the plugin runs: a unit test checks that list against these.
 * `log_episode` is left out on purpose — the conversation is captured, so the agent never needs to log it again (as in
 * Arkimede).
 */
import { TOOLS as RECORDARE_TOOLS } from '@arkimedehq/recordare-client';

export interface ToolSpec {
  /** Recordare's MCP tool name. */
  mcpName: string;
  label: string;
  description: string;
  parameters: Record<string, unknown>;
}

const OFFERED = RECORDARE_TOOLS.filter((t) => t.name !== 'log_episode');
const NAMES = new RegExp(`\\b(${OFFERED.map((t) => t.name).join('|')})\\b`, 'g');

/** The schema as served, minus `$schema`; extra arguments stay allowed (Recordare ignores them): a model adding e.g. a `date` should not lose the call. */
function parameters(schema: Record<string, unknown>): Record<string, unknown> {
  const { $schema: _ignored, ...rest } = structuredClone(schema);
  return rest;
}

export const TOOLS: ToolSpec[] = OFFERED.map((t) => ({
  mcpName: t.name,
  label: `Recordare: ${t.title.charAt(0).toLowerCase()}${t.title.slice(1)}`,
  // Tool names the description mentions are the plugin's (`recordare_…`); the memory is the agent's long-term one (D50).
  description: `${t.description.replace(NAMES, 'recordare_$1')} (Recordare: your long-term memory.)`,
  parameters: parameters(t.inputSchema as Record<string, unknown>),
}));

export const toolName = (spec: ToolSpec): string => `recordare_${spec.mcpName}`;
