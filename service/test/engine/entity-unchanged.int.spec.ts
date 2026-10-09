// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Entity memories keep their prompt inputs byte-identical until WORK_PLAN 8.5 (personal first person, 8.4, must not
 * move them): the system prompt and the user message of a fixed entity scenario were captured on the code before 8.4.
 */
import { type INestApplication } from '@nestjs/common';
import { type Server } from 'node:http';
import { createHash } from 'node:crypto';
import { EXTRACTION_RUNNER, type ExtractionRunner } from '../../src/queue/queue.port';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, startFakeLlm, testEnv } from '../helpers/app';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

describe('entity memory prompt inputs are unchanged by 8.4', () => {
  let app: INestApplication;
  let url: string;
  let llm: Awaited<ReturnType<typeof startFakeLlm>>;
  let emb: Server;
  let key: string;
  let clientId: string;

  beforeAll(async () => {
    llm = await startFakeLlm();
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    testEnv({ EMBEDDING_BASE_URL: fake.url, LLM_BASE_URL: llm.url, IDLE_DELAY_SECONDS: '3600' });
    await resetSchema();
    ({ app, url } = await startApp());
    const client = await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'A', kind: 'platform' } });
    clientId = client.body.id;
    key = (await call(url, 'POST', `/api/v1/admin/clients/${clientId}/keys`, { token: ADMIN_KEY, body: { scopes: ['ingest', 'read'] } })).body.key;
  });
  afterAll(async () => { await app?.close(); llm?.server.close(); emb?.close(); });

  async function run(conversation: unknown, messages: unknown[], out: object): Promise<{ system: string; user: string }> {
    const res = await call(url, 'POST', '/api/v1/ingest/messages', {
      token: key, headers: { 'x-recordare-user': 'Casa' }, body: { conversation, messages },
    });
    llm.queue.push(out);
    await app.get<ExtractionRunner>(EXTRACTION_RUNNER).runForConversation(res.body.conversationId as string);
    const req = (llm.requests as unknown as Array<{ messages: Array<{ content: string }> }>).at(-1);
    return { system: req?.messages[0]?.content ?? '', user: req?.messages[1]?.content ?? '' };
  }

  it('system prompt and user message match the pre-8.4 capture', async () => {
    const id = (await call(url, 'POST', '/api/v1/admin/owners', { token: ADMIN_KEY, body: { displayName: 'Casa', mode: 'entity' } })).body.personId;
    await call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY, body: { kind: 'account', personId: id, clientId, externalId: 'Casa' } });
    await run({ externalId: 'u1' }, [
      { externalId: 'u1-1', role: 'user', content: 'Sono Andrea: ho comprato una Panda. Sabato 13 vado a Roma.', sentAt: '2026-06-07T10:00:00+02:00' },
    ], {
      episodes: [{ content: 'Andrea andrà a Roma sabato 13 giugno 2026.', kind: 'plan', occurred_at: '2026-06-13', people: ['Andrea'], evidence: [1] },
        { content: 'Andrea ha comprato una Panda.', kind: 'state_change', occurred_at: '2026-06-07', people: ['Andrea'], evidence: [1] }],
      facts: [{ key: 'car', value: 'Fiat Panda', verdict: 'new', subject: 'Andrea', evidence: [1] },
        { key: 'spare_keys_location', value: 'cassetto blu', verdict: 'new', subject: null, evidence: [1] }],
      notes: [{ category: 'preference', content: 'Andrea prende il caffè amaro.', evidence: [1] }],
    });
    const second = await run({
      externalId: 'u2', participants: [
        { ref: 'marta', role: 'other', displayName: 'Marta', identity: { externalUserId: 'marta-1' } },
        { ref: 'ospite', role: 'other', displayName: 'Ospite' },
      ],
    }, [
      { externalId: 'u2-1', role: 'other', authorRef: 'marta', content: 'Ciao, ho preso una Clio.', sentAt: '2026-06-08T09:00:00+02:00' },
      { externalId: 'u2-2', role: 'other', authorRef: 'ospite', content: 'Io domani parto.', sentAt: '2026-06-08T09:01:00+02:00' },
      { externalId: 'u2-3', role: 'user', content: 'Chi ha preso la Panda?', sentAt: '2026-06-08T09:02:00+02:00' },
      { externalId: 'u2-4', role: 'assistant', content: 'Andrea.', sentAt: '2026-06-08T09:03:00+02:00' },
      { externalId: 'u2-5', role: 'tool', toolName: 'web_search', content: 'Meteo: sole.', sentAt: '2026-06-08T09:04:00+02:00' },
      { externalId: 'u2-6', role: 'user', own: true, content: 'Manuale della caldaia: reset con il tasto rosso.', sentAt: '2026-06-08T09:05:00+02:00' },
    ], {});
    expect(sha(second.system)).toBe('7a3ab82219bb011b335c64e38164733cd541406d7cbecf625d36558553851b40');
    expect(second.user).toBe([
      "OWNER LANGUAGE: it",
      "",
      "CALENDAR (around 2026-06-08):",
      "lunedì 2026-05-25",
      "martedì 2026-05-26",
      "mercoledì 2026-05-27",
      "giovedì 2026-05-28",
      "venerdì 2026-05-29",
      "sabato 2026-05-30",
      "domenica 2026-05-31",
      "lunedì 2026-06-01",
      "martedì 2026-06-02",
      "mercoledì 2026-06-03",
      "giovedì 2026-06-04",
      "venerdì 2026-06-05",
      "sabato 2026-06-06",
      "domenica 2026-06-07",
      "lunedì 2026-06-08  ← message day",
      "martedì 2026-06-09",
      "mercoledì 2026-06-10",
      "giovedì 2026-06-11",
      "venerdì 2026-06-12",
      "sabato 2026-06-13",
      "domenica 2026-06-14",
      "lunedì 2026-06-15",
      "martedì 2026-06-16",
      "mercoledì 2026-06-17",
      "giovedì 2026-06-18",
      "venerdì 2026-06-19",
      "sabato 2026-06-20",
      "domenica 2026-06-21",
      "lunedì 2026-06-22",
      "martedì 2026-06-23",
      "mercoledì 2026-06-24",
      "giovedì 2026-06-25",
      "venerdì 2026-06-26",
      "sabato 2026-06-27",
      "domenica 2026-06-28",
      "lunedì 2026-06-29",
      "",
      "OPEN PLANS:",
      "P1: Andrea andrà a Roma sabato 13 giugno 2026. (planned sabato 2026-06-13)",
      "",
      "CURRENT FACTS:",
      "F1: [Andrea] car = Fiat Panda (since 2026-06-07)",
      "F2: [-] spare_keys_location = cassetto blu (since 2026-06-07)",
      "",
      "KNOWN SLOTS: address, car, children, employer, job_title, languages, partner, pets, spare_keys_location",
      "",
      "CURRENT NOTES:",
      "N1: [preference] Andrea prende il caffè amaro.",
      "",
      "KNOWN EPISODES (recent, and older ones related to these messages):",
      "E1: Andrea ha comprato una Panda. (domenica 2026-06-07)",
      "",
      "CONVERSATION WINDOW:",
      "[1] lunedì 2026-06-08 09:00 other:Marta: Ciao, ho preso una Clio.",
      "[2] lunedì 2026-06-08 09:01 other:Ospite: Io domani parto.",
      "[3] lunedì 2026-06-08 09:02 person: Chi ha preso la Panda?",
      "[4] lunedì 2026-06-08 09:03 assistant: Andrea.",
      "[5] lunedì 2026-06-08 09:04 tool:web_search: Meteo: sole.",
      "[6] lunedì 2026-06-08 09:05 person: Manuale della caldaia: reset con il tasto rosso.",
    ].join('\n'));
  });
});
