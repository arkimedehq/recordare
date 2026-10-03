#!/usr/bin/env node
/* global process */
// Fake `claude -p --output-format json`: echoes the queued result from FAKE_CLAUDE_RESULTS (JSON array, consumed via a counter file).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const results = JSON.parse(process.env.FAKE_CLAUDE_RESULTS ?? '[]');
const counter = process.env.FAKE_CLAUDE_COUNTER;
const n = existsSync(counter) ? Number(readFileSync(counter, 'utf8')) : 0;
writeFileSync(counter, String(n + 1));
const args = process.argv.slice(2);
let stdin = '';
process.stdin.on('data', (c) => { stdin += c; });
process.stdin.on('end', () => {
  writeFileSync(`${counter}.args.${n}`, JSON.stringify({ args, stdin }));
  process.stdout.write(JSON.stringify({ result: results[n] ?? '{}', is_error: false, usage: { input_tokens: 5, cache_read_input_tokens: 100, output_tokens: 7 } }));
});
