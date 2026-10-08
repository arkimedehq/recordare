// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { describe, expect, it } from 'vitest';
import { StreamAccumulator, answerOfJson } from '../src/answer.js';
import { injectBlock, isBackgroundCall, personText } from '../src/messages.js';

describe('background calls', () => {
  it('skips Open WebUI task prompts and title generation', () => {
    expect(isBackgroundCall('### Task:\nGenerate a concise, 3-5 word title with an emoji summarizing the chat history.\n<chat_history>…')).toBe(true);
    expect(isBackgroundCall('### Task:\nSuggest 3-5 relevant follow-up questions')).toBe(true);
    expect(isBackgroundCall('Please generate a concise, 5-word-or-less title for the conversation')).toBe(true);
    expect(isBackgroundCall('my cat is called Biscotto')).toBe(false);
    expect(isBackgroundCall('custom job: summarize', [/^custom job:/i])).toBe(true);
  });

  it('keeps an Open WebUI RAG turn and reads the person\'s query from it', () => {
    const rag = '### Task:\nRespond to the user query using the provided context.\n<context>doc</context>\n<user_query>\nwhat about my cat?\n</user_query>';
    expect(isBackgroundCall(rag)).toBe(false);
    expect(personText(rag)).toBe('what about my cat?');
  });

  it('drops a memory block left in the text', () => {
    expect(personText('<memory-context source="recordare">x</memory-context>\nhello')).toBe('hello');
  });
});

describe('injection', () => {
  const block = '<memory-context>facts</memory-context>';
  it('appends to the first system message', () => {
    const out = injectBlock([{ role: 'system', content: 'Be kind.' }, { role: 'user', content: 'hi' }], block);
    expect(out[0]?.content).toBe(`Be kind.\n\n${block}`);
  });
  it('adds a system message when there is none', () => {
    const out = injectBlock([{ role: 'user', content: 'hi' }], block);
    expect(out).toEqual([{ role: 'system', content: block }, { role: 'user', content: 'hi' }]);
  });
  it('content arrays get a text part', () => {
    const out = injectBlock([{ role: 'system', content: [{ type: 'text', text: 'A' }] }], block);
    expect(out[0]?.content).toEqual([{ type: 'text', text: 'A' }, { type: 'text', text: block }]);
  });
});

describe('answers', () => {
  const enc = new TextEncoder();
  it('accumulates a stream split anywhere', () => {
    const sse = 'data: {"choices":[{"index":0,"delta":{"role":"assistant","content":"Hel"}}]}\n\n'
      + 'data: {"choices":[{"index":0,"delta":{"content":"lo è"}}]}\r\n\r\n'
      + 'data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n';
    const bytes = enc.encode(sse);
    const acc = new StreamAccumulator();
    for (let i = 0; i < bytes.length; i += 7) acc.push(bytes.subarray(i, i + 7)); // splits UTF-8 and lines
    expect(acc.finish()).toEqual({ text: 'Hello è', toolCalls: false, complete: true });
  });

  it('flags tool calls and cut streams', () => {
    const acc = new StreamAccumulator();
    acc.push(enc.encode('data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0}]}}]}\n\n'));
    expect(acc.finish()).toEqual({ text: '', toolCalls: true, complete: false });
  });

  it('reads a whole completion', () => {
    expect(answerOfJson({ choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }] }))
      .toEqual({ text: 'ok', toolCalls: false, complete: true });
  });
});
