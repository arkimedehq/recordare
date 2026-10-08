// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/** OpenAI chat messages: the person's text, the platforms' background calls, the memory block in the system prompt. */

export interface ChatMessage {
  role: string;
  content?: unknown;
  tool_calls?: unknown;
  [k: string]: unknown;
}

export interface ChatRequest {
  model?: string;
  messages?: ChatMessage[];
  stream?: boolean;
  [k: string]: unknown;
}

/** The text of a message: a string, or the text parts of a content array (images and files are left out). */
export function textOf(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((p) => (p && typeof p === 'object' && (p as { type?: unknown }).type === 'text' ? String((p as { text?: unknown }).text ?? '') : ''))
    .filter(Boolean)
    .join('\n');
}

/** Index of the last `user` message, or -1. */
export function lastUserIndex(messages: ChatMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i]?.role === 'user') return i;
  return -1;
}

const MEMORY_BLOCK = /<memory-context\b[^>]*>[\s\S]*?<\/memory-context>\s*/g;
const USER_QUERY = /<user_query>\s*([\s\S]*?)\s*<\/user_query>/;

/**
 * What the person wrote in a user message: the query inside a RAG template (Open WebUI wraps it in `<user_query>`),
 * without any memory block a client may have left in it.
 */
export function personText(raw: string): string {
  const q = raw.match(USER_QUERY);
  return (q ? q[1] ?? '' : raw).replace(MEMORY_BLOCK, '').trim();
}

/**
 * Built-in patterns of the platforms' background calls (titles, tags, follow-ups, search queries, autocomplete): they
 * are not the person talking, so they are neither captured nor given memories. Open WebUI's task prompts all start
 * with "### Task:" (its RAG template does too, but carries the person's message in `<user_query>`, checked first).
 */
export const BUILTIN_SKIP: RegExp[] = [
  /^\s*###\s*Task:/i,
  /\b(generate|write|provide|create)\b[^\n]{0,60}\btitle\b[^\n]{0,60}\b(conversation|chat|thread)\b/i,
];

/** True when the request is a platform's own background call. */
export function isBackgroundCall(lastUserRaw: string, extra: RegExp[] = []): boolean {
  if (USER_QUERY.test(lastUserRaw)) return false;
  return [...BUILTIN_SKIP, ...extra].some((re) => re.test(lastUserRaw));
}

/**
 * Appends the memory block at the end of the first system message (a new system message first when there is none).
 * The stable part of the prompt stays first (prefix caching); the block is never stored as a chat message.
 */
export function injectBlock(messages: ChatMessage[], block: string): ChatMessage[] {
  const i = messages.findIndex((m) => m.role === 'system' || m.role === 'developer');
  if (i < 0) return [{ role: 'system', content: block }, ...messages];
  const m = messages[i] as ChatMessage;
  const content = Array.isArray(m.content)
    ? [...m.content, { type: 'text', text: block }]
    : `${typeof m.content === 'string' && m.content ? `${m.content}\n\n` : ''}${block}`;
  return messages.map((x, j) => (j === i ? { ...m, content } : x));
}
