// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/** The assistant's answer, read from an OpenAI chat completion: streamed (SSE chunks) or whole (JSON). */

export interface Answer {
  /** The visible text of the first choice. */
  text: string;
  /** The model asked for tools: an agent loop goes on, this is not the turn's final answer. */
  toolCalls: boolean;
  /** The stream reached `[DONE]` or a finish reason (a cut stream is not captured). */
  complete: boolean;
}

interface Choice {
  index?: number;
  delta?: { content?: unknown; tool_calls?: unknown[] };
  message?: { content?: unknown; tool_calls?: unknown[] };
  finish_reason?: string | null;
}

/**
 * Accumulates an SSE stream of `chat.completion.chunk`s while the bytes are piped to the caller unchanged. Feed it the
 * raw chunks in order (any split: lines are reassembled).
 */
export class StreamAccumulator {
  private buffer = '';
  private readonly decoder = new TextDecoder();
  private readonly parts: string[] = [];
  private toolCalls = false;
  private done = false;

  push(chunk: Uint8Array): void {
    this.buffer += this.decoder.decode(chunk, { stream: true });
    let nl: number;
    while ((nl = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, nl).replace(/\r$/, '');
      this.buffer = this.buffer.slice(nl + 1);
      this.line(line);
    }
  }

  /** The answer after the stream ended. */
  finish(): Answer {
    if (this.buffer.trim()) this.line(this.buffer.replace(/\r$/, ''));
    this.buffer = '';
    return { text: this.parts.join(''), toolCalls: this.toolCalls, complete: this.done };
  }

  private line(line: string): void {
    if (!line.startsWith('data:')) return;
    const data = line.slice(5).trim();
    if (data === '[DONE]') {
      this.done = true;
      return;
    }
    let chunk: { choices?: Choice[] };
    try {
      chunk = JSON.parse(data) as { choices?: Choice[] };
    } catch {
      return;
    }
    for (const c of chunk.choices ?? []) {
      if ((c.index ?? 0) !== 0) continue;
      if (typeof c.delta?.content === 'string') this.parts.push(c.delta.content);
      if (c.delta?.tool_calls?.length) this.toolCalls = true;
      if (c.finish_reason) {
        this.done = true;
        if (c.finish_reason === 'tool_calls') this.toolCalls = true;
      }
    }
  }
}

/** The answer of a non-streamed completion. */
export function answerOfJson(body: unknown): Answer {
  const choice = (body as { choices?: Choice[] } | null)?.choices?.find((c) => (c.index ?? 0) === 0);
  const content = choice?.message?.content;
  const text = typeof content === 'string' ? content
    : Array.isArray(content) ? content.map((p) => (typeof (p as { text?: unknown })?.text === 'string' ? (p as { text: string }).text : '')).join('') : '';
  return {
    text,
    toolCalls: !!choice?.message?.tool_calls?.length || choice?.finish_reason === 'tool_calls',
    complete: !!choice,
  };
}
