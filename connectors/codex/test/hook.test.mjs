// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Unit tests of the shared hook script (the Claude Code and Codex copies are byte-identical): a tiny mock Recordare
 * answers the charter and the context; the hook runs as the hosts run it (payload on stdin, context on stdout).
 * Run: node --test connectors/codex/test/hook.test.mjs
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';

const SCRIPT = new URL('../scripts/recordare-hook.mjs', import.meta.url).pathname;
const CHARTER = { charter: '## Your memory\nYou have a long-term memory.', version: 'charter.v1' };
const requests = [];
let server;
let url;

before(async () => {
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      requests.push({ method: req.method, url: req.url, body: body ? JSON.parse(body) : undefined });
      const send = (status, json) => res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(json));
      if (req.method === 'GET' && req.url === '/api/v1/charter') return send(200, CHARTER);
      if (req.method === 'POST' && req.url === '/api/v1/context') return send(200, { block: '<memory-context>\nI am Ada.\n</memory-context>' });
      send(404, {});
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  url = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

/** Runs the hook with `payload` on stdin against `base`; resolves with its stdout and exit code. */
function hook(payload, base = url, client = 'codex') {
  return new Promise((resolve) => {
    const env = { ...process.env, RECORDARE_URL: base, RECORDARE_TOKEN: 'rp_test', XDG_CONFIG_HOME: mkdtempSync(join(tmpdir(), 'rec-')) };
    const child = spawn(process.execPath, [SCRIPT, client], { env });
    let out = '';
    child.stdout.on('data', (c) => (out += c));
    child.on('close', (code) => resolve({ out, code }));
    child.stdin.end(JSON.stringify(payload));
  });
}

test('SessionStart puts the memory charter in the session context', async () => {
  requests.length = 0;
  const { out, code } = await hook({ hook_event_name: 'SessionStart', session_id: 's1', source: 'startup' });
  assert.equal(code, 0);
  assert.deepEqual(JSON.parse(out), { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: CHARTER.charter } });
  assert.deepEqual(requests.map((r) => `${r.method} ${r.url}`), ['GET /api/v1/charter']);
});

test('UserPromptSubmit asks for the context of every prompt, the self card left on', async () => {
  requests.length = 0;
  const { out } = await hook({ hook_event_name: 'UserPromptSubmit', session_id: 's1', prompt: 'and him?' }, url, 'claude-code');
  assert.equal(JSON.parse(out).hookSpecificOutput.additionalContext, '<memory-context>\nI am Ada.\n</memory-context>');
  const ctx = requests.find((r) => r.url === '/api/v1/context');
  assert.equal(ctx.body.query, 'and him?');
  assert.equal('card' in ctx.body, false); // the service's default: card on
  assert.equal(ctx.body.ingest.messages[0].role, 'user');
});

test('Recordare down: no charter, no context, the turn goes on (exit 0, nothing printed)', async () => {
  for (const hook_event_name of ['SessionStart', 'UserPromptSubmit']) {
    const { out, code } = await hook({ hook_event_name, session_id: 's1', prompt: 'hi' }, 'http://127.0.0.1:9');
    assert.equal(code, 0);
    assert.equal(out, '');
  }
});
