// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * A tiny mock of the OpenAI Responses API (streaming) for smoke-testing the Codex connector without a paid model:
 * every `POST …/responses` gets the same assistant answer as SSE. Each request body is appended as one JSON line to
 * the log file, so a test can check what reached the model (e.g. the injected `<memory-context>` block).
 * Usage: node mock-responses.mjs [port=8799] [log=./mock-requests.jsonl] [answer]
 * Codex: -c model_provider="mock" -c model_providers.mock.name="mock"
 *        -c model_providers.mock.base_url="http://127.0.0.1:8799/v1" -c model_providers.mock.wire_api="responses"
 */
import { createServer } from 'node:http';
import { appendFileSync } from 'node:fs';

const port = Number(process.argv[2] || 8799);
const log = process.argv[3] || './mock-requests.jsonl';
const answer = process.argv[4] || 'Noted: your sister is called Giulia and she lives in Turin.';

let n = 0;
createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    if (req.method !== 'POST' || !req.url.endsWith('/responses')) {
      res.writeHead(404).end();
      return;
    }
    appendFileSync(log, body.replace(/\n/g, ' ') + '\n');
    const id = `resp_mock_${++n}`;
    const item = { type: 'message', role: 'assistant', id: `msg_mock_${n}`, status: 'completed',
      content: [{ type: 'output_text', text: answer, annotations: [] }] };
    const events = [
      { type: 'response.created', response: { id } },
      { type: 'response.output_item.added', output_index: 0, item: { ...item, status: 'in_progress', content: [] } },
      { type: 'response.output_text.delta', output_index: 0, content_index: 0, item_id: item.id, delta: answer },
      { type: 'response.output_item.done', output_index: 0, item },
      { type: 'response.completed', response: { id, output: [item],
        usage: { input_tokens: 10, input_tokens_details: { cached_tokens: 0 }, output_tokens: 10,
          output_tokens_details: { reasoning_tokens: 0 }, total_tokens: 20 } } },
    ];
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    for (const e of events) res.write(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`);
    res.end();
  });
}).listen(port, '127.0.0.1', () => console.log(`mock Responses API on http://127.0.0.1:${port}/v1`));
