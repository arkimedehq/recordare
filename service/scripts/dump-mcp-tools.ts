// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Prints the MCP tools exactly as `tools/list` returns them (name, description, JSON Schema of the input), without a
 * database or a running service: a client platform checks with them that its LLM provider accepts the schemas (D27,
 * WORK_PLAN 4.5b).
 *   node -r @swc-node/register scripts/dump-mcp-tools.ts > tools.json
 */
import 'reflect-metadata';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTools, type ToolDeps } from '../src/mcp/mcp-tools';
import { VERSION } from '../src/version';

async function main(): Promise<void> {
  const server = new McpServer({ name: 'recordare', version: VERSION });
  // Only the schemas are read: the services behind the tools are never called.
  registerTools(server, {
    principal: { kind: 'client', clientId: 'dump' }, memoryId: 'dump', settings: { timezone: 'UTC', locale: 'en' },
    allowClockOverride: false,
  } as unknown as ToolDeps);
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'dump', version: VERSION });
  await Promise.all([server.connect(a), client.connect(b)]);
  const { tools } = await client.listTools();
  console.log(JSON.stringify(tools, null, 1));
  await client.close();
}

main().catch((e: unknown) => { console.error((e as Error).message); process.exit(1); });
