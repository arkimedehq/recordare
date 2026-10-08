// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/** Text out of OpenClaw's session messages (`agent_end`), without what OpenClaw or this plugin added for the model. */

interface Block { type?: string; text?: string }
interface Message { role?: string; content?: string | Block[] }

/** The visible text of a message: the string content, or its `text` blocks (thinking and tool calls left out). */
export function messageText(m: unknown): string {
  const content = (m as Message | null)?.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.filter((b) => b?.type === 'text' && typeof b.text === 'string').map((b) => b.text as string).join('\n');
}

/** Markers OpenClaw puts before a JSON fence of channel metadata in the user turn (model-facing only). */
const META_HEADERS = /^(Conversation info|Sender|Thread starter|Replied message|Forwarded message context|Chat history since last reply)\b.*\((untrusted|untrusted metadata|untrusted, for context)\):\s*$/;

/**
 * What the person wrote: without Recordare's own `<memory-context>` block (prepended for the model — it must never be
 * stored back), OpenClaw's leading `[Mon 2026-03-23 13:12]` timestamp and its untrusted-metadata JSON blocks.
 */
export function cleanUserText(text: string): string {
  let t = text.replace(/<memory-context\b[^>]*>[\s\S]*?<\/memory-context>\s*/g, '');
  const out: string[] = [];
  const lines = t.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (META_HEADERS.test(line.trim()) && lines[i + 1]?.trim() === '```json') {
      i += 2;
      while (i < lines.length && lines[i]?.trim() !== '```') i++;
      continue;
    }
    out.push(line);
  }
  t = out.join('\n').trim();
  return t.replace(/^\[[A-Z][a-z]{2} \d{4}-\d{2}-\d{2} \d{2}:\d{2}[^\]]*\]\s*/, '').trim();
}

/** The last turn of a transcript: the last user message's text and the assistant's answer after it. */
export function lastTurn(messages: unknown[]): { user: string; assistant: string } {
  let start = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if ((messages[i] as Message | null)?.role === 'user') { start = i; break; }
  }
  if (start < 0) return { user: '', assistant: '' };
  const answer = messages.slice(start + 1)
    .filter((m) => (m as Message | null)?.role === 'assistant')
    .map(messageText)
    .filter((s) => s.trim());
  // All the assistant's text of the turn (as the Claude Code connector does); tool calls and results are not sent.
  return { user: cleanUserText(messageText(messages[start])), assistant: answer.join('\n\n').trim() };
}
