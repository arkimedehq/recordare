// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Scripted session of a standard MCP client with a personal token (WORK_PLAN 6.1, the basic level): the same calls
 * Claude Code / Claude Desktop make. Use a test person: it writes one episode (then forgets it) and one pending note.
 *   RECORDARE_URL=http://localhost:8080 RECORDARE_TOKEN=rp_… npm run smoke:mcp
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const url = process.env['RECORDARE_URL'] ?? 'http://localhost:8080';
const token = process.env['RECORDARE_TOKEN'];
if (!token) throw new Error('RECORDARE_TOKEN (a personal token, rp_…) is required');

const EXPECTED = ['correct_episode', 'forget_episode', 'log_episode', 'remember', 'resolve_period', 'search_episodes', 'search_memory'];
const marker = `smoke-${Date.now().toString(36)}`;
let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

async function main(): Promise<void> {
  const client = new Client({ name: 'recordare-smoke', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${url}/mcp`), { requestInit: { headers: { authorization: `Bearer ${token}` } } }));
  const tool = async (name: string, args: Record<string, unknown>) =>
    (await client.callTool({ name, arguments: args })).structuredContent as Record<string, unknown>;

  const tools = (await client.listTools()).tools.map((t) => t.name).sort();
  check('tools listed', EXPECTED.every((t) => tools.includes(t)), tools.join(', '));

  const period = await tool('resolve_period', { expression: 'last week' });
  check('resolve_period', typeof period['from'] === 'string', `${String(period['from'])} → ${String(period['to'])}`);

  const logged = await tool('log_episode', { content: `Smoke test ${marker}: bought a test bicycle` });
  check('log_episode', logged['stored'] === true);

  const found = JSON.stringify(await tool('search_episodes', { query: `test bicycle ${marker}` }));
  check('search_episodes finds it', found.includes(marker));

  const note = await tool('remember', { content: `Smoke test ${marker}: prefers green tea` });
  check('remember', note['stored'] === true);
  // Without ingested messages of the holder behind it, an agent's note waits for the person's confirmation (API.md §3).
  const notes = JSON.stringify(await tool('search_memory', { query: `green tea ${marker}`, include_pending: true }));
  check('search_memory finds it (pending)', notes.includes(marker));

  const forgot = await tool('forget_episode', { id: logged['id'] });
  check('forget_episode', forgot['forgotten'] === true);
  check('forgotten episode gone', !JSON.stringify(await tool('search_episodes', { query: `test bicycle ${marker}` })).includes(marker));

  await client.close();
  console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
  process.exit(failures ? 1 : 0);
}

void main();
