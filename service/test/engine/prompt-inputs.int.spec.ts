// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Prompt inputs are part of a measured version (evaluation rule 9): the personal prompts stay byte-identical to the ones
 * measured (`extract.v13`, `facts.v2`), and the entity prompt and user message of a fixed scenario are pinned (8.5,
 * `extract.v13+entity.v4`) — a change to any of them is a new version, measured before it ships.
 */
import { type INestApplication } from '@nestjs/common';
import { type Server } from 'node:http';
import { createHash } from 'node:crypto';
import { EXTRACTION_RUNNER, type ExtractionRunner } from '../../src/queue/queue.port';
import { EXTRACTION_SYSTEM } from '../../src/engine/extraction.prompt';
import { FACTS_SYSTEM } from '../../src/engine/facts.prompt';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, startFakeLlm, testEnv } from '../helpers/app';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

describe('prompt inputs of the measured versions', () => {
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

  it('personal prompts are the measured extract.v13 and facts.v2', () => {
    expect(sha(EXTRACTION_SYSTEM)).toBe('579c3ed76efe7691884c658a959a98300915d787cebb9806353ffe7a2aed0c17');
    expect(sha(FACTS_SYSTEM)).toBe('309707b0c33d7fb2b05cce9fe88d434185180cf5c195135070e6f37509924d7c');
  });

  it('entity memories: the shared agent in the first person, people by name, someone until named (8.5)', async () => {
    const id = (await call(url, 'POST', '/api/v1/admin/owners', { token: ADMIN_KEY, body: { displayName: 'Casa', mode: 'entity' } })).body.personId;
    await call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY, body: { kind: 'account', personId: id, clientId, externalId: 'Casa' } });
    await run({ externalId: 'u1' }, [
      { externalId: 'u1-1', role: 'user', content: 'Sono Andrea: ho comprato una Panda. Sabato 13 vado a Roma.', sentAt: '2026-06-07T10:00:00+02:00' },
    ], {
      episodes: [{ content: 'Andrea andrà a Roma sabato 13 giugno 2026.', subject: 'Andrea', kind: 'plan', occurred_at: '2026-06-13', evidence: [1] },
        { content: 'Andrea ha comprato una Panda.', subject: 'Andrea', kind: 'state_change', occurred_at: '2026-06-07', evidence: [1] }],
      facts: [{ key: 'car', value: 'Fiat Panda', verdict: 'new', subject: 'Andrea', evidence: [1] },
        { key: 'spare_keys_location', value: 'cassetto blu', verdict: 'new', subject: null, evidence: [1] }],
      notes: [{ subject: 'Andrea', category: 'preference', content: 'Andrea prende il caffè amaro.', evidence: [1] }],
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
    expect(sha(second.system)).toBe('a2f41a75effebc3419ddf458c1570352dd7fbcd7784ef953b90e6a66b7537516');
    expect(second.user).toBe([
      "ME: Casa — gender masculine",
      "",
      "MEMORY LANGUAGE: it",
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
      "PEOPLE I KNOW:",
      "C1: Andrea",
      "C2: Marta",
      "",
      "OPEN QUESTIONS:",
      "(none)",
      "",
      "OPEN PLANS:",
      "P1: Andrea andrà a Roma sabato 13 giugno 2026. (planned sabato 2026-06-13)",
      "",
      "CURRENT FACTS:",
      "F1: [Andrea] car = Fiat Panda (since 2026-06-07)",
      "F2: [me] spare_keys_location = cassetto blu (since 2026-06-07)",
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
      "[1] lunedì 2026-06-08 09:00 Marta [C2]: Ciao, ho preso una Clio.",
      "[2] lunedì 2026-06-08 09:01 other:Ospite: Io domani parto.",
      "[3] lunedì 2026-06-08 09:02 someone: Chi ha preso la Panda?",
      "[4] lunedì 2026-06-08 09:03 me (assistant): Andrea.",
      "[5] lunedì 2026-06-08 09:04 tool:web_search: Meteo: sole.",
      "[6] lunedì 2026-06-08 09:05 me (own): Manuale della caldaia: reset con il tasto rosso.",
    ].join('\n'));
  });
});
