// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Recordare hook for agent CLIs with Claude-Code-style lifecycle hooks (one script, three events; Node ≥ 18, no
 * dependencies). Shared by the Claude Code and the Codex connectors: `node recordare-hook.mjs [client]`, where
 * `client` is `claude-code` (default) or `codex`.
 * - UserPromptSubmit: sends the prompt to Recordare's ingest, then returns the memories relevant to it
 *   (`POST api/v1/context`) as additional context for this turn;
 * - Stop: sends the agent's answer;
 * - SessionEnd: tells Recordare the conversation ended (extraction now instead of after the idle delay).
 * Never blocks the host: any failure is silent (exit 0, nothing printed) — memory is best effort here.
 * Configuration, first found wins: the Claude Code plugin's options (url, token; Claude Code only), RECORDARE_URL /
 * RECORDARE_TOKEN in the environment, then `$XDG_CONFIG_HOME/recordare/<client>.json` (default `~/.config`,
 * `{"url": "…", "token": "…"}`, mode 600).
 * `node recordare-hook.mjs <client> --mcp-headers` prints `{"Authorization": "Bearer …"}` from the same configuration
 * (for an MCP headers helper, e.g. Codex's `http_headers_helper`, so the token stays out of the host's config).
 *
 * The copies in connectors/claude-code/scripts/ and connectors/codex/scripts/ must stay byte-identical
 * (connectors/check-shared.sh, run in CI).
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, join } from 'node:path';

const CLIENT = /^[a-z0-9-]+$/.test(process.argv[2] ?? '') ? process.argv[2] : 'claude-code';
const CODEX = CLIENT === 'codex';
const MAX = 60 * 1024; // the ingest accepts 64 KiB per message

function config() {
  const env = process.env;
  let url = (CLIENT === 'claude-code' && env.CLAUDE_PLUGIN_OPTION_URL) || env.RECORDARE_URL || '';
  let token = (CLIENT === 'claude-code' && env.CLAUDE_PLUGIN_OPTION_TOKEN) || env.RECORDARE_TOKEN || '';
  if (!url || !token) {
    try {
      const dir = env.XDG_CONFIG_HOME || join(homedir(), '.config');
      const file = JSON.parse(readFileSync(join(dir, 'recordare', `${CLIENT}.json`), 'utf8'));
      url ||= file.url || '';
      token ||= file.token || '';
    } catch { /* no config file */ }
  }
  return { url: url.replace(/\/+$/, ''), token };
}
const { url: URL_, token: TOKEN } = config();

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

const lines = (path) => readFileSync(path, 'utf8').split('\n').flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });

/** Claude Code transcript: the text blocks of the main thread's answers after the last prompt. */
function claudeTranscriptAnswer(path) {
  const parts = [];
  for (const e of lines(path)) {
    if (e.isSidechain) continue;
    const content = e.message?.content;
    if (e.type === 'user' && (typeof content === 'string' || content?.some?.((b) => b.type === 'text'))) parts.length = 0;
    if (e.type === 'assistant' && Array.isArray(content)) {
      for (const b of content) if (b.type === 'text' && b.text?.trim()) parts.push(b.text);
    }
  }
  return parts.join('\n\n');
}

/**
 * Codex rollout (`{timestamp, type, payload}` lines): the last agent message after the last user message. Reads the
 * `event_msg` items of both rollout generations: `user_message` / `agent_message` (older), `item_completed` with a
 * `UserMessage` / `AgentMessage` item and `task_complete.last_agent_message` (0.16x).
 */
function codexRolloutAnswer(path) {
  if (!path.endsWith('.jsonl')) return ''; // compressed (.jsonl.zst) rollouts are skipped
  const text = (item) => (item.content ?? []).map((c) => c.text ?? '').join('');
  let answer = '';
  for (const e of lines(path)) {
    const p = e.type === 'event_msg' ? e.payload : null;
    if (!p) continue;
    if (p.type === 'user_message' || (p.type === 'item_completed' && p.item?.type === 'UserMessage')) answer = '';
    const said = p.type === 'agent_message' ? p.message
      : p.type === 'item_completed' && p.item?.type === 'AgentMessage' ? text(p.item)
        : p.type === 'task_complete' ? p.last_agent_message : '';
    if (typeof said === 'string' && said.trim()) answer = said;
  }
  return answer;
}

/** The text of the agent's last answer: the hook's own field when present, else the transcript. */
function lastAnswer(input) {
  if (typeof input.last_assistant_message === 'string' && input.last_assistant_message.trim()) return input.last_assistant_message;
  if (!input.transcript_path) return '';
  return CODEX ? codexRolloutAnswer(input.transcript_path) : claudeTranscriptAnswer(input.transcript_path);
}

async function main() {
  if (process.argv[3] === '--mcp-headers') {
    process.stdout.write(JSON.stringify(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}));
    return;
  }
  if (!URL_ || !TOKEN) return;
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const session = input.session_id;
  if (!session) return;
  if (CODEX && input.agent_id) return; // sub-agent turns are not the person's conversation
  const conversation = `${CLIENT}:${session}`;
  const meta = { externalId: conversation, channel: CLIENT, title: input.cwd ? basename(input.cwd) : undefined };
  const state = join(tmpdir(), `recordare-${CLIENT}-${hash(session)}.json`);
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
    // Codex caps SessionEnd hooks at 3 s, so the request gets 2.5 s there.
    let message;
    try { message = JSON.parse(readFileSync(state, 'utf8')); } catch { return; }
    await post('/api/v1/ingest/messages', { conversation: meta, messages: [message], hints: { conversationEnded: true } }, conversation, CODEX ? 2500 : 8000);
    rmSync(state, { force: true });
  }
}

main().catch(() => {}).finally(() => process.exit(0));
