// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Recordare hook for Claude Code (one script, three events; Node ≥ 18, no dependencies):
 * - UserPromptSubmit: sends the prompt to Recordare's ingest, then returns the memories relevant to it
 *   (`POST api/v1/context`) as additional context for this turn;
 * - Stop: sends Claude's answer;
 * - SessionEnd: tells Recordare the conversation ended (extraction now instead of after the idle delay).
 * Never blocks Claude Code: any failure is silent (exit 0, nothing printed) — memory is best effort here.
 * Configuration: the plugin's options (url, token), or RECORDARE_URL / RECORDARE_TOKEN in the environment.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

const URL_ = (process.env.CLAUDE_PLUGIN_OPTION_URL || process.env.RECORDARE_URL || '').replace(/\/+$/, '');
const TOKEN = process.env.CLAUDE_PLUGIN_OPTION_TOKEN || process.env.RECORDARE_TOKEN || '';
const MAX = 60 * 1024; // the ingest accepts 64 KiB per message

const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const clip = (s) => (Buffer.byteLength(s) > MAX ? Buffer.from(s).subarray(0, MAX).toString().replace(/�$/, '') + ' […]' : s);

async function post(path, body, conversation, ms) {
  const res = await fetch(`${URL_}${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json', 'x-recordare-conversation': conversation },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(ms),
  });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.status === 204 ? null : res.json();
}

/** The text of Claude's last answer: the hook's own field when present, else the transcript after the last prompt. */
function lastAnswer(input) {
  if (typeof input.last_assistant_message === 'string' && input.last_assistant_message.trim()) return input.last_assistant_message;
  if (!input.transcript_path) return '';
  const parts = [];
  for (const line of readFileSync(input.transcript_path, 'utf8').split('\n')) {
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    if (e.isSidechain) continue;
    const content = e.message?.content;
    if (e.type === 'user' && (typeof content === 'string' || content?.some?.((b) => b.type === 'text'))) parts.length = 0;
    if (e.type === 'assistant' && Array.isArray(content)) {
      for (const b of content) if (b.type === 'text' && b.text?.trim()) parts.push(b.text);
    }
  }
  return parts.join('\n\n');
}

async function main() {
  if (!URL_ || !TOKEN) return;
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const session = input.session_id;
  if (!session) return;
  const conversation = `claude-code:${session}`;
  const meta = { externalId: conversation, channel: 'claude-code', title: input.cwd ? basename(input.cwd) : undefined };
  const state = join(tmpdir(), `recordare-claude-code-${hash(session)}.json`);
  const now = new Date().toISOString();

  if (input.hook_event_name === 'UserPromptSubmit') {
    const prompt = (input.prompt ?? '').trim();
    if (!prompt) return;
    await post('/api/v1/ingest/messages', { conversation: meta, messages: [
      { externalId: `${session}:u:${hash(prompt + now)}`, role: 'user', content: clip(prompt), sentAt: now },
    ] }, conversation, 4000);
    const ctx = await post('/api/v1/context', { query: prompt.slice(0, 4000) }, conversation, 4000);
    if (ctx?.block) {
      process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: ctx.block } }));
    }
  } else if (input.hook_event_name === 'Stop') {
    const answer = lastAnswer(input).trim();
    if (!answer) return;
    const message = { externalId: `${session}:a:${hash(answer)}`, role: 'assistant', content: clip(answer), sentAt: now };
    await post('/api/v1/ingest/messages', { conversation: meta, messages: [message] }, conversation, 8000);
    writeFileSync(state, JSON.stringify(message), { mode: 0o600 });
  } else if (input.hook_event_name === 'SessionEnd') {
    // Re-sending the last answer (same id: stored once) carries the "conversation ended" hint.
    let message;
    try { message = JSON.parse(readFileSync(state, 'utf8')); } catch { return; }
    await post('/api/v1/ingest/messages', { conversation: meta, messages: [message], hints: { conversationEnded: true } }, conversation, 8000);
    rmSync(state, { force: true });
  }
}

main().catch(() => {}).finally(() => process.exit(0));
