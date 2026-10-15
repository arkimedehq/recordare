// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Cost budget (WORK_PLAN 4.4c): what the engine sends to the LLM for a reference day of one person, per quality profile —
 * calls and input tokens per idle window (extraction) and per night (consolidation), projected to a month. The fake LLM
 * answers with plausible outputs, so the inputs grow the way a real memory's do (contacts, plans, facts, notes, known
 * episodes); output tokens depend on the model and are not budgeted. Tokens are estimated (UTF-8 bytes / 4): the gate
 * compares a change with the recorded budget, it does not price a provider.
 *
 * A change that raises a number beyond `budget.json` fails. When the rise is intended, record the new numbers in the
 * same commit: `COST_BUDGET_UPDATE=1 npx vitest run test/cost` (measured + 5 %).
 */
import { type INestApplication } from '@nestjs/common';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Server } from 'node:http';
import { EXTRACTION_RUNNER, type ExtractionRunner } from '../../src/queue/queue.port';
import { EXTRACTION_SYSTEM } from '../../src/engine/extraction.prompt';
import { QUALITY_PROFILES, type QualityProfileName } from '../../src/engine/quality-profile';
import { DAY_DIGEST_SYSTEM, MONTH_DIGEST_SYSTEM } from '../../src/engine/consolidation.prompt';
import { PATTERNS_SYSTEM } from '../../src/engine/patterns.prompt';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, startFakeLlm, testEnv } from '../helpers/app';

interface Measure {
  /** Extraction calls and estimated input tokens for the reference day (every idle window of it). */
  extractionCalls: number;
  extractionInputPerMessage: number;
  /** The night after it: digests, patterns, duplicate checks. */
  nightlyCalls: number;
  nightlyInput: number;
  /** 30 reference days. */
  monthlyInput: number;
}
type Budget = Record<QualityProfileName, Measure>;

const BUDGET_FILE = join(__dirname, 'budget.json');
const tokens = (text: string): number => Math.ceil(Buffer.byteLength(text, 'utf8') / 4);
const inputOf = (req: { messages: Array<{ content: string }> }): number => req.messages.reduce((n, m) => n + tokens(m.content), 0);

const PEOPLE = ['Marco (cognato)', 'Giulia (sorella)', 'Irene (collega)', 'Paolo (amico)', 'Sara (vicina)', 'Luca (cugino)', 'Anna (madre)', 'Davide (capo)'];
const PLACES = ['a Bologna', 'al parco', 'in palestra', 'a Milano', 'al mercato', 'in studio', 'a Cervinia', 'al ristorante Koi'];
const DOINGS = ['ho fatto una lunga corsa', 'abbiamo cenato insieme', 'ho chiuso il preventivo per il cliente', 'abbiamo parlato del trasloco',
  'ho comprato le scarpe nuove', 'abbiamo provato la ricetta del risotto', 'ho sistemato la caldaia', 'abbiamo visto la partita'];

/** A plausible chat line of ~130 characters (deterministic). */
function line(i: number, role: 'user' | 'assistant'): string {
  const who = PEOPLE[i % PEOPLE.length]!.split(' ')[0];
  if (role === 'assistant') return `Capito. Vuoi che ti ricordi qualcosa su ${who} o su quello che è successo ${PLACES[(i + 3) % PLACES.length]}? Posso anche segnare un promemoria per domani.`;
  return `Oggi con ${who} ${DOINGS[i % DOINGS.length]} ${PLACES[i % PLACES.length]}, e la prossima settimana ci torniamo per finire il lavoro (${i}).`;
}

/** Plausible extraction output: an episode every two messages (some plans), people, a fact and a note per window. */
function extraction(user: string, seq: number): unknown {
  const lines = [...user.matchAll(/^\[(\d+)\] .*?(\d{4}-\d{2}-\d{2}) \d{2}:\d{2} [^:]+: (.*)$/gm)];
  const episodes = lines.filter((_, i) => i % 2 === 0).map((m, i) => {
    const plan = i % 4 === 3;
    const day = m[2]!;
    return {
      content: `${plan ? 'Tornerò' : 'Sono stato'} ${PLACES[(seq + i) % PLACES.length]} con ${PEOPLE[(seq + i) % PEOPLE.length]!.split(' ')[0]}: ${m[3]!.slice(0, 60)} [${seq}.${i}]`,
      kind: plan ? 'plan' : 'event', occurred_at: plan ? `${day.slice(0, 8)}${String(Math.min(28, Number(day.slice(8)) + 7)).padStart(2, '0')}` : day,
      date_precision: 'day', people: [PEOPLE[(seq + i) % PEOPLE.length]], place: PLACES[(seq + i) % PLACES.length]!.split(' ').at(-1), importance: 5,
      keywords: [PLACES[(seq + i) % PLACES.length]!.split(' ').at(-1)], evidence: [Number(m[1])],
    };
  });
  const first = Number(lines[0]?.[1] ?? 1);
  return {
    episodes,
    facts: [{ key: `progetto_${seq}`, value: `fase ${seq}`, verdict: 'new', subject: 'me', evidence: [first] }],
    notes: [{ subject: 'me', category: 'preference', content: `Mi piace stare ${PLACES[seq % PLACES.length]} il sabato mattina (${seq})`, evidence: [first] }],
  };
}

describe('cost budget per idle window and per night (WORK_PLAN 4.4c)', () => {
  let app: INestApplication;
  let url: string;
  let emb: Server;
  let llm: Awaited<ReturnType<typeof startFakeLlm>>;
  let key: string;
  let clientId: string;
  let windows = 0;

  beforeAll(async () => {
    llm = await startFakeLlm((req) => {
      const system = req.messages[0]?.content ?? '';
      if (system === EXTRACTION_SYSTEM) return extraction(req.messages[1]?.content ?? '', ++windows);
      if (system === DAY_DIGEST_SYSTEM || system === MONTH_DIGEST_SYSTEM) return { summary: 'Una giornata di lavoro, una corsa al parco e una cena con Marco.' };
      if (system === PATTERNS_SYSTEM) return { patterns: [] };
      return {};
    });
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    testEnv({ EMBEDDING_BASE_URL: fake.url, LLM_BASE_URL: llm.url, IDLE_DELAY_SECONDS: '3600', ALLOW_CLOCK_OVERRIDE: 'true' });
    await resetSchema();
    ({ app, url } = await startApp());
    const client = await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'A', kind: 'platform' } });
    clientId = client.body.id;
    key = (await call(url, 'POST', `/api/v1/admin/clients/${clientId}/keys`, { token: ADMIN_KEY, body: { scopes: ['ingest'] } })).body.key;
  }, 60_000);
  afterAll(async () => { await app?.close(); llm?.server.close(); emb?.close(); });

  async function day(user: string, date: string, sizes: number[]): Promise<void> {
    for (const [c, size] of sizes.entries()) {
      const messages = Array.from({ length: size }, (_, i) => {
        const role = i % 2 === 0 ? 'user' : 'assistant';
        const at = new Date(`${date}T08:00:00+01:00`).getTime() + (c * 4 * 60 + i * 2) * 60_000;
        return { externalId: `${date}-${c}-${i}`, role, content: line(i + c * 7, role), sentAt: new Date(at).toISOString() };
      });
      const res = await call(url, 'POST', '/api/v1/ingest/messages', { token: key, headers: { 'x-recordare-user': user },
        body: { conversation: { externalId: `${date}-${c}` }, messages } });
      await app.get<ExtractionRunner>(EXTRACTION_RUNNER).runForConversation(res.body.conversationId as string);
    }
  }
  const night = (memoryId: string, next: string) =>
    call(url, 'POST', `/api/v1/admin/memories/${memoryId}/consolidate`, { token: ADMIN_KEY, headers: { 'x-recordare-now': `${next}T04:00:00+01:00` } });

  it('stays within the recorded budget for every quality profile', async () => {
    const measured = {} as Budget;
    for (const profile of QUALITY_PROFILES) {
      const user = `u-${profile}`;
      const memoryId = (await call(url, 'POST', '/api/v1/admin/memories', { token: ADMIN_KEY, body: { displayName: 'Luca', qualityProfile: profile } })).body.personId;
      await call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY, body: { kind: 'account', personId: memoryId, clientId, externalId: user } });
      // Two weeks of history: the extractor's context (contacts, plans, facts, notes, episodes) fills up to its caps.
      for (let d = 1; d <= 14; d++) {
        const date = `2026-03-${String(d).padStart(2, '0')}`;
        await day(user, date, [16]);
        await night(memoryId, `2026-03-${String(d + 1).padStart(2, '0')}`);
      }
      // The reference day: a short chat, a normal one and a long one (100 messages); then its night.
      const start = llm.requests.length;
      await day(user, '2026-03-16', [10, 20, 70]);
      const extractionReqs = llm.requests.slice(start);
      const nightStart = llm.requests.length;
      expect((await night(memoryId, '2026-03-17')).status).toBe(201);
      const nightReqs = llm.requests.slice(nightStart);
      const extractionInput = extractionReqs.reduce((n, r) => n + inputOf(r), 0);
      const nightlyInput = nightReqs.reduce((n, r) => n + inputOf(r), 0);
      measured[profile] = {
        extractionCalls: extractionReqs.length, extractionInputPerMessage: Math.round(extractionInput / 100),
        nightlyCalls: nightReqs.length, nightlyInput, monthlyInput: 30 * (extractionInput + nightlyInput),
      };
    }
    console.info(`cost budget (estimated input tokens, reference day of 100 messages):\n${JSON.stringify(measured, null, 2)}`);

    if (process.env['COST_BUDGET_UPDATE']) {
      const withHeadroom = Object.fromEntries(Object.entries(measured).map(([p, m]) => [p, Object.fromEntries(
        Object.entries(m).map(([k, v]) => [k, k.endsWith('Calls') ? v : Math.ceil(v * 1.05)]))]));
      writeFileSync(BUDGET_FILE, `${JSON.stringify(withHeadroom, null, 2)}\n`);
      return;
    }
    const budget = JSON.parse(readFileSync(BUDGET_FILE, 'utf8')) as Budget;
    const over = QUALITY_PROFILES.flatMap((p) => (Object.keys(measured[p]) as Array<keyof Measure>)
      .filter((k) => measured[p][k] > budget[p][k]).map((k) => `${p}.${k}: ${measured[p][k]} > budget ${budget[p][k]}`));
    expect(over, 'over the cost budget: if intended, record it with COST_BUDGET_UPDATE=1 (test/cost/budget.json)').toEqual([]);
  }, 300_000);
});
