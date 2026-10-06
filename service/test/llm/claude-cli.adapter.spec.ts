// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { ClaudeCliAdapter } from '../../src/llm/claude-cli.adapter';
import { type LlmCallRecord, type LlmCallRecorder } from '../../src/llm/llm-call-recorder';

const binary = join(__dirname, '..', 'fixtures', 'fake-claude.mjs');
const schema = z.object({ events: z.array(z.string()) });

describe('ClaudeCliAdapter (local evaluation only)', () => {
  it('runs claude -p with no tools / settings / MCP and our system prompt, validates and repairs once', async () => {
    const counter = join(mkdtempSync(join(tmpdir(), 'fakeclaude-')), 'n');
    process.env['FAKE_CLAUDE_COUNTER'] = counter;
    process.env['FAKE_CLAUDE_RESULTS'] = JSON.stringify(['not json', '```json\n{"events":["sci"]}\n```']);
    const calls: LlmCallRecord[] = [];
    const recorder = { record: async (c: LlmCallRecord) => { calls.push(c); } } as unknown as LlmCallRecorder;
    const a = new ClaudeCliAdapter({ model: 'sonnet', binary }, recorder);
    await expect(a.completeJson({ promptId: 'p', system: 'SYS', user: 'hello', schema, task: 'extract' })).resolves.toEqual({ events: ['sci'] });
    const first = JSON.parse(readFileSync(`${counter}.args.0`, 'utf8')) as { args: string[]; stdin: string };
    expect(first.args).toEqual(expect.arrayContaining(['-p', '--output-format', 'json', '--model', 'sonnet', '--tools', '', '--setting-sources', '', '--strict-mcp-config', '--system-prompt', 'SYS']));
    expect(first.stdin).toBe('hello');
    expect(calls.map((c) => c.status)).toEqual(['invalid_output', 'ok']);
    expect(calls[1]).toMatchObject({ inputTokens: 105, cachedInputTokens: 100, outputTokens: 7, provider: 'claude-cli' });
  });
});
