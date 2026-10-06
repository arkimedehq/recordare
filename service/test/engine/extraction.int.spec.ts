// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type INestApplication } from '@nestjs/common';
import { type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { EXTRACTION_RUNNER, type ExtractionRunner } from '../../src/queue/queue.port';
import { EXTRACTION_PROMPT_VERSION, EXTRACTION_SYSTEM } from '../../src/engine/extraction.prompt';
import { ADMIN_KEY, call, fakeVector, resetSchema, startApp, startFakeEmbeddings, startFakeLlm, testEnv } from '../helpers/app';

describe('extraction engine (fake LLM: code-side rules)', () => {
  let app: INestApplication;
  let url: string;
  let db: DataSource;
  let runner: ExtractionRunner;
  let llm: Awaited<ReturnType<typeof startFakeLlm>>;
  let emb: Server;
  let key: string;
  let ownerId: string;

  beforeAll(async () => {
    llm = await startFakeLlm();
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    testEnv({ EMBEDDING_BASE_URL: fake.url, LLM_BASE_URL: llm.url, IDLE_DELAY_SECONDS: '3600', LLM_EXTRACT_ECONOMY_MODEL: 'test-light' });
    await resetSchema();
    ({ app, url } = await startApp());
    db = app.get(DataSource);
    runner = app.get<ExtractionRunner>(EXTRACTION_RUNNER);
    const client = await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'A', kind: 'platform' } });
    key = (await call(url, 'POST', `/api/v1/admin/clients/${client.body.id}/keys`, { token: ADMIN_KEY, body: { scopes: ['ingest'] } })).body.key;
    ownerId = (await call(url, 'POST', '/api/v1/admin/owners', { token: ADMIN_KEY, body: { displayName: 'Luca', episodicEnabled: true } })).body.personId;
    await call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY, body: { kind: 'client_user', personId: ownerId, clientId: client.body.id, externalId: 'luca' } });
  });
  afterAll(async () => { await app?.close(); llm?.server.close(); emb?.close(); });

  async function ingest(conv: string, messages: Array<{ id: string; role: string; content: string; at: string; authorRef?: string }>, participants: unknown[] = []): Promise<string> {
    const res = await call(url, 'POST', '/api/v1/ingest/messages', {
      token: key, headers: { 'x-recordare-user': 'luca' },
      body: { conversation: { externalId: conv, participants }, messages: messages.map((m) => ({ externalId: m.id, role: m.role, content: m.content, sentAt: m.at, ...(m.authorRef ? { authorRef: m.authorRef } : {}) })) },
    });
    return res.body.conversationId as string;
  }

  it('writes episodes with evidence, people and provenance; drops items without valid evidence', async () => {
    const conv = await ingest('c1', [{ id: 'm1', role: 'user', content: 'Ieri sono andato a sciare a Cervinia con Marco, mio cognato.', at: '2026-01-18T19:30:00+01:00' }]);
    llm.queue.push({
      episodes: [
        { content: 'Luca è andato a sciare a Cervinia con Marco il 17 gennaio 2026.', kind: 'event', occurred_at: '2026-01-17', date_precision: 'day',
          time_expression: 'ieri', people: ['Marco (cognato)'], place: 'Cervinia', importance: 7, valence: 2, feelings: ['felice'], keywords: ['sci', 'Cervinia'], evidence: [1] },
        { content: 'Senza prove', evidence: [99] },
      ],
    });
    await runner.runForConversation(conv);
    expect(llm.requests.at(-1)?.messages[0]?.content).toBe(EXTRACTION_SYSTEM); // stable prefix
    const eps = await db.query(`SELECT id, content, date_precision, origin, author_role, stance, audience, time_expression FROM episodes`);
    expect(eps).toHaveLength(1);
    expect(eps[0]).toMatchObject({ date_precision: 'day', origin: 'owner_lived', author_role: 'owner', stance: 'stated', time_expression: 'ieri', audience: [ownerId] });
    expect(await db.query(`SELECT alias FROM episode_people`)).toEqual([{ alias: 'Marco (cognato)' }]);
    expect(await db.query(`SELECT count(*)::int AS n FROM episode_evidence`)).toEqual([{ n: 1 }]);
    expect(await db.query(`SELECT count(*)::int AS n FROM messages WHERE extracted_run_id IS NULL`)).toEqual([{ n: 0 }]);
    const [{ occurred_at }] = await db.query(`SELECT occurred_at FROM episodes`);
    expect(new Date(occurred_at).toISOString()).toBe('2026-01-16T23:00:00.000Z'); // local midnight Europe/Rome
    expect(await db.query(`SELECT status, model FROM extraction_runs`)).toEqual([{ status: 'done', model: 'pending' }]);
    expect(await db.query(`SELECT prompt_id, input_tokens FROM llm_calls`)).toEqual([{ prompt_id: EXTRACTION_PROMPT_VERSION, input_tokens: 100 }]);
  });

  it('runs the plan lifecycle in code: open → cancelled, with a plan_events log', async () => {
    const c2 = await ingest('c2', [{ id: 'p1', role: 'user', content: 'La settimana prossima vado a Roma martedì e mercoledì per lavoro.', at: '2026-01-27T18:45:00+01:00' }]);
    llm.queue.push({ episodes: [{ content: 'Luca andrà a Roma per lavoro il 3 e 4 febbraio 2026.', kind: 'plan', occurred_at: '2026-02-03', occurred_until: '2026-02-04', date_precision: 'day', evidence: [1] }] });
    await runner.runForConversation(c2);
    const c3 = await ingest('c3', [{ id: 'p2', role: 'user', content: 'Cambio di programma: Roma salta.', at: '2026-02-01T11:00:00+01:00' }]);
    llm.queue.push({ plan_patches: [{ plan: 'P1', patch: 'cancel', note: 'cliente ha rimandato', evidence: [1] }] });
    await runner.runForConversation(c3);
    expect(llm.requests.at(-1)?.messages[1]?.content).toContain('P1: Luca andrà a Roma');
    expect(await db.query(`SELECT plan_status FROM episodes WHERE kind = 'plan'`)).toEqual([{ plan_status: 'cancelled' }]);
    expect(await db.query(`SELECT patch, note FROM plan_events`)).toEqual([{ patch: 'cancel', note: 'cliente ha rimandato' }]);
  });

  it('ignores plan patches whose evidence speaks of something else, and repeats of a reschedule', async () => {
    const a = await ingest('pe1', [{ id: 'pe1', role: 'user', content: 'Giovedì vado al concerto a Bologna con Nicola.', at: '2026-04-06T19:00:00+02:00' }]);
    llm.queue.push({ episodes: [{ content: 'Concerto a Bologna con Nicola giovedì 9 aprile 2026.', kind: 'plan', occurred_at: '2026-04-09', people: ['Nicola'], place: 'Bologna', keywords: ['concerto'], evidence: [1] }] });
    await runner.runForConversation(a);
    const plans = async () => db.query(`SELECT content, plan_status FROM episodes WHERE kind = 'plan' AND content LIKE '%Bologna%' ORDER BY recorded_at`);
    const pOf = async () => {
      const open = await db.query(`SELECT content FROM episodes WHERE kind = 'plan' AND plan_status = 'open' ORDER BY recorded_at DESC`);
      return `P${open.findIndex((p: { content: string }) => p.content.includes('Bologna')) + 1}`;
    };
    // An unrelated message (the fake embeddings make it dissimilar; no shared name) cannot cancel the plan.
    const b = await ingest('pe2', [{ id: 'pe2', role: 'user', content: 'Primo giorno nel nuovo ufficio, tante procedure da leggere.', at: '2026-04-20T18:00:00+02:00' }]);
    await db.query(`UPDATE messages SET embedding = $1 WHERE external_id = 'pe2'`, [`[${[1, 0, 0, 0, 0, 0, 0, 0].join(',')}]`]);
    await db.query(`UPDATE episodes SET embedding = $1 WHERE content LIKE 'Concerto a Bologna%'`, [`[${[0, 1, 0, 0, 0, 0, 0, 0].join(',')}]`]);
    llm.queue.push({ plan_patches: [{ plan: await pOf(), patch: 'cancel', evidence: [1] }] });
    await runner.runForConversation(b);
    expect(await plans()).toEqual([{ content: 'Concerto a Bologna con Nicola giovedì 9 aprile 2026.', plan_status: 'open' }]);
    // A message naming the plan moves it; without a rewrite the new plan carries the new date in its text.
    const c = await ingest('pe3', [{ id: 'pe3', role: 'user', content: 'Il concerto di Bologna slitta a sabato 11.', at: '2026-04-07T09:00:00+02:00' }]);
    llm.queue.push({ plan_patches: [{ plan: await pOf(), patch: 'reschedule', new_date: '2026-04-11', evidence: [1] }] });
    await runner.runForConversation(c);
    expect(await plans()).toEqual([
      { content: 'Concerto a Bologna con Nicola giovedì 9 aprile 2026.', plan_status: 'rescheduled' },
      { content: 'Concerto a Bologna con Nicola giovedì 9 aprile 2026. (→ 2026-04-11)', plan_status: 'open' },
    ]);
    // The same move again is a repeat, not a new plan.
    const d = await ingest('pe4', [{ id: 'pe4', role: 'user', content: 'Confermo, Bologna sabato 11.', at: '2026-04-08T09:00:00+02:00' }]);
    llm.queue.push({ plan_patches: [{ plan: await pOf(), patch: 'reschedule', new_date: '2026-04-11', evidence: [1] }] });
    await runner.runForConversation(d);
    expect(await plans()).toHaveLength(2);
  });

  it('a confirmed plan always gets its event episode (created from the plan if missing)', async () => {
    const c = await ingest('cp1', [{ id: 'cp1', role: 'user', content: 'Sabato vado ad arrampicare con Irene.', at: '2026-10-08T20:00:00+02:00' }]);
    llm.queue.push({ episodes: [{ content: 'Arrampicata a BlocHaus con Irene sabato 10 ottobre 2026.', kind: 'plan', occurred_at: '2026-10-10', people: ['Irene'], evidence: [1] }] });
    await runner.runForConversation(c);
    const c2 = await ingest('cp2', [{ id: 'cp2', role: 'user', content: 'Sabato arrampicata fantastica!', at: '2026-10-11T10:00:00+02:00' }]);
    const plans = await db.query(`SELECT content FROM episodes WHERE kind = 'plan' AND plan_status = 'open' ORDER BY recorded_at DESC`);
    const idx = plans.findIndex((p: { content: string }) => p.content.startsWith('Arrampicata'));
    llm.queue.push({ plan_patches: [{ plan: `P${idx + 1}`, patch: 'confirm', evidence: [1] }] });
    await runner.runForConversation(c2);
    const [plan] = await db.query(`SELECT plan_status, confirmed_by FROM episodes WHERE kind = 'plan' AND content LIKE 'Arrampicata%'`);
    expect(plan.plan_status).toBe('confirmed');
    const [event] = await db.query(`SELECT kind, content FROM episodes WHERE id = $1`, [plan.confirmed_by]);
    expect(event).toEqual({ kind: 'event', content: 'Arrampicata a BlocHaus con Irene sabato 10 ottobre 2026.' });
    expect(await db.query(`SELECT alias FROM episode_people WHERE episode_id = $1`, [plan.confirmed_by])).toEqual([{ alias: 'Irene' }]);
  });

  it('links an unlinked correction through the near-duplicate check (one extra call only when candidates exist)', async () => {
    const a = await ingest('ort1', [{ id: 'o1', role: 'user', content: "Lunedì sono stata dall'ortopedico.", at: '2026-11-04T21:00:00+01:00' }]);
    llm.queue.push({ episodes: [{ content: "Visita dall'ortopedico lunedì 2 novembre 2026.", occurred_at: '2026-11-02', evidence: [1] }] });
    await runner.runForConversation(a);
    const callsBefore = llm.requests.length;
    const b = await ingest('ort2', [{ id: 'o2', role: 'user', content: "Correggo: dall'ortopedico non lunedì ma martedì 3.", at: '2026-11-08T11:30:00+01:00' }]);
    // The extractor forgets "corrects"; the fake embeddings of identical texts are identical → candidate pair.
    llm.queue.push({ episodes: [{ content: "Visita dall'ortopedico lunedì 2 novembre 2026.", occurred_at: '2026-11-03', evidence: [1] }] });
    llm.queue.push({ decisions: [{ pair: 1, relation: 'corrects' }] });
    await runner.runForConversation(b);
    expect(llm.requests.length - callsBefore).toBe(2);
    const rows = await db.query(`SELECT occurred_at::date::text AS d, invalidated_at IS NOT NULL AS inval, corrects IS NOT NULL AS corr
      FROM episodes WHERE content LIKE 'Visita dall%' ORDER BY recorded_at`);
    expect(rows).toEqual([{ d: '2026-11-01', inval: true, corr: false }, { d: '2026-11-02', inval: false, corr: true }]);
  });

  it('replaces single-value facts forward-only and keeps history', async () => {
    const c4 = await ingest('c4', [{ id: 'f1', role: 'user', content: 'Mi sono preso una Golf usata del 2019.', at: '2026-01-12T20:10:00+01:00' }]);
    llm.queue.push({ facts: [{ key: 'car', value: 'Golf usata del 2019', verdict: 'new', evidence: [1] }] });
    await runner.runForConversation(c4);
    const c5 = await ingest('c5', [{ id: 'f2', role: 'user', content: 'Ho venduto la Golf, ora ho una Tesla Model 3.', at: '2026-03-02T13:00:00+01:00' }]);
    llm.queue.push({ facts: [{ key: 'car', value: 'Tesla Model 3 in leasing', verdict: 'replace', target: 'F1', evidence: [1] }] });
    await runner.runForConversation(c5);
    // A late import of an older value must not overwrite the current one.
    const c6 = await ingest('c6', [{ id: 'f3', role: 'user', content: 'A dicembre avevo una Panda.', at: '2026-03-03T10:00:00+01:00' }]);
    llm.queue.push({ facts: [{ key: 'car', value: 'Panda', verdict: 'replace', target: 'F1', valid_from: '2025-12-01', evidence: [1] }] });
    await runner.runForConversation(c6);
    const facts = await db.query(`SELECT value, status FROM facts WHERE key = 'car' ORDER BY valid_from`);
    expect(facts).toEqual([
      { value: 'Panda', status: 'superseded' },
      { value: 'Golf usata del 2019', status: 'superseded' },
      { value: 'Tesla Model 3 in leasing', status: 'current' },
    ]);
  });

  it('treats "new" with a target on a single slot as a replacement, and ignores older "unknown" evidence', async () => {
    const c1 = await ingest('emp1', [{ id: 'e1', role: 'user', content: 'Lavoro da Acme.', at: '2026-05-01T10:00:00+02:00' }]);
    llm.queue.push({ facts: [{ key: 'employer', value: 'Acme', verdict: 'new', evidence: [1] }] });
    await runner.runForConversation(c1);
    const c2 = await ingest('emp2', [{ id: 'e2', role: 'user', content: 'Ora lavoro da Beta.', at: '2026-06-01T10:00:00+02:00' }]);
    const facts = await db.query(`SELECT key FROM facts WHERE status = 'current' ORDER BY recorded_at DESC`);
    const f = facts.findIndex((r: { key: string }) => r.key === 'employer') + 1;
    llm.queue.push({ facts: [{ key: 'employer', value: 'Beta', verdict: 'new', target: `F${f}`, evidence: [1] }] });
    await runner.runForConversation(c2);
    const c3 = await ingest('emp3', [{ id: 'e3', role: 'user', content: 'A marzo non sapevo dove avrei lavorato.', at: '2026-06-02T10:00:00+02:00' }]);
    const f2 = (await db.query(`SELECT key FROM facts WHERE status IN ('current','unknown_current') ORDER BY recorded_at DESC`))
      .findIndex((r: { key: string }) => r.key === 'employer') + 1;
    llm.queue.push({ facts: [{ key: 'employer', verdict: 'unknown', target: `F${f2}`, valid_from: '2026-03-01', evidence: [1] }] });
    await runner.runForConversation(c3);
    expect(await db.query(`SELECT value, status FROM facts WHERE key = 'employer' ORDER BY valid_from`)).toEqual([
      { value: 'Acme', status: 'superseded' }, { value: 'Beta', status: 'current' },
    ]);
    expect(await db.query(`SELECT count(*)::int AS n FROM extraction_runs WHERE status = 'failed'`)).toEqual([{ n: 0 }]);
  });

  it("extracts the owner's messages ingested with role other (group chats, imports)", async () => {
    const c = await ingest('grp', [{ id: 'g1', role: 'other', content: 'Sono io, Luca: domani vado a Torino.', at: '2026-06-03T10:00:00+02:00' }],
      [{ ref: 'luca', role: 'owner' }]);
    await db.query(`UPDATE messages SET author_person_id = $1 WHERE conversation_id = $2`, [ownerId, c]);
    const before = llm.requests.length;
    llm.queue.push({ episodes: [] });
    await runner.runForConversation(c);
    expect(llm.requests.length).toBe(before + 1);
  });

  it('never runs two extractions of the same conversation at once', async () => {
    const c = await ingest('conc', [{ id: 'k1', role: 'user', content: 'Oggi gelato in centro.', at: '2026-06-04T10:00:00+02:00' }]);
    llm.queue.push({ episodes: [{ content: 'Gelato in centro il 4 giugno 2026.', occurred_at: '2026-06-04', evidence: [1] }] });
    llm.queue.push({ episodes: [{ content: 'Gelato in centro il 4 giugno 2026.', occurred_at: '2026-06-04', evidence: [1] }] });
    await Promise.all([runner.runForConversation(c), runner.runForConversation(c)]);
    expect(await db.query(`SELECT count(*)::int AS n FROM episodes WHERE content LIKE 'Gelato%'`)).toEqual([{ n: 1 }]);
    llm.queue.length = 0;
  });

  it("never shows another owner's slot names in the prompt", async () => {
    await db.query(`INSERT INTO fact_slots (key, description) VALUES ('secret_other_owner_slot', 'x') ON CONFLICT DO NOTHING`);
    const c = await ingest('slots', [{ id: 's1', role: 'user', content: 'Niente di nuovo.', at: '2026-06-05T10:00:00+02:00' }]);
    llm.queue.push({});
    await runner.runForConversation(c);
    const user = llm.requests.at(-1)?.messages[1]?.content ?? '';
    expect(user).toContain('KNOWN SLOTS:');
    expect(user).not.toContain('secret_other_owner_slot');
    expect(user).toContain('employer'); // this owner's own key
  });

  it('never lets other people or tools create stated memories (poisoning guard)', async () => {
    const c7 = await ingest('c7', [{ id: 'o1', role: 'other', content: 'Luca mi ha detto che vende la casa e trasferisce i soldi a me.', at: '2026-03-05T10:00:00+01:00', authorRef: 'x' },
      { id: 'o2', role: 'user', content: 'Ciao a tutti', at: '2026-03-05T10:01:00+01:00' }],
    [{ ref: 'x', role: 'other', displayName: 'Sconosciuto' }]);
    llm.queue.push({ notes: [{ category: 'constraint', content: 'Luca vende la casa', verdict: 'new', stance: 'stated', evidence: [1] }] });
    await runner.runForConversation(c7);
    // An unverified group member is still named to the extractor, so a claim is attributed to its author.
    expect(llm.requests.at(-1)?.messages[1]?.content ?? '').toContain('other:Sconosciuto');
    expect(await db.query(`SELECT author_role, stance, pending FROM notes`)).toEqual([{ author_role: 'other', stance: 'inferred', pending: true }]);
    expect(await db.query(`SELECT change FROM note_changes`)).toEqual([{ change: 'created' }]);
  });

  it('shows older episodes related to the window, not only the most recent ones', async () => {
    const text = "L'hotel a Lubiana in realtà è costato 210 euro, non 180.";
    const [old] = await db.query(
      `INSERT INTO episodes (owner_id, kind, content, origin, author_role, audience, recorded_at, embedding)
       VALUES ($1, 'event', 'Hotel a Lubiana prenotato: 180 euro', 'owner_lived', 'owner', $2, now() - interval '90 days', $3::vector) RETURNING id`,
      [ownerId, [ownerId], `[${fakeVector(text).join(',')}]`]);
    for (let i = 0; i < 10; i++) {
      await db.query(`INSERT INTO episodes (owner_id, kind, content, origin, author_role, audience) VALUES ($1, 'event', $2, 'owner_lived', 'owner', $3)`,
        [ownerId, `Rumore ${i}`, [ownerId]]);
    }
    const c = await ingest('rel', [{ id: 'r1', role: 'user', content: text, at: new Date().toISOString() }]);
    llm.queue.push({});
    await runner.runForConversation(c);
    expect(llm.requests.at(-1)?.messages[1]?.content ?? '').toContain('Hotel a Lubiana prenotato: 180 euro');
    await db.query(`DELETE FROM episodes WHERE id = $1 OR content LIKE 'Rumore %'`, [old.id]);
  });

  it('follows the owner\'s quality profile: economy uses its own task model, full lets the model reason', async () => {
    const setProfile = (qualityProfile: string | null) =>
      call(url, 'PATCH', `/api/v1/admin/owners/${ownerId}`, { token: ADMIN_KEY, body: { qualityProfile } });
    const last = () => llm.requests.at(-1) as unknown as { model: string; max_tokens: number };

    await setProfile('economy');
    const e = await ingest('qp-e', [{ id: 'qe1', role: 'user', content: 'Oggi niente di speciale.', at: '2026-06-06T10:00:00+02:00' }]);
    llm.queue.push({});
    await runner.runForConversation(e);
    expect(last()).toMatchObject({ model: 'test-light', max_tokens: 6000 });

    await setProfile('full');
    const f = await ingest('qp-f', [{ id: 'qf1', role: 'user', content: 'Oggi ancora niente.', at: '2026-06-06T11:00:00+02:00' }]);
    llm.queue.push({});
    await runner.runForConversation(f);
    expect(last()).toMatchObject({ model: 'test-model', max_tokens: 24000 }); // reasoning: larger output budget

    await setProfile(null); // back to the installation default (balanced)
    const b = await ingest('qp-b', [{ id: 'qb1', role: 'user', content: 'Di nuovo niente.', at: '2026-06-06T12:00:00+02:00' }]);
    llm.queue.push({});
    await runner.runForConversation(b);
    expect(last()).toMatchObject({ model: 'test-model', max_tokens: 6000 });
  });

  it('makes no LLM call without a message from the owner (gate)', async () => {
    const before = llm.requests.length;
    const c8 = await ingest('c8', [{ id: 'a1', role: 'assistant', content: 'Promemoria automatico.', at: '2026-03-06T10:00:00+01:00' }]);
    await runner.runForConversation(c8);
    expect(llm.requests.length).toBe(before);
    expect(await db.query(`SELECT count(*)::int AS n FROM messages WHERE conversation_id = $1 AND extracted_run_id IS NULL`, [c8])).toEqual([{ n: 0 }]);
  });

  it('does not recreate forgotten content (tombstones)', async () => {
    const c9 = await ingest('c9', [{ id: 't1', role: 'user', content: 'Oggi ho fatto una cosa da dimenticare.', at: '2026-03-07T10:00:00+01:00' }]);
    const [msg] = await db.query(`SELECT id FROM messages WHERE conversation_id = $1`, [c9]);
    await db.query(`INSERT INTO forget_tombstones (owner_id, scope, message_ids) VALUES ($1, 'message', $2)`, [ownerId, [msg.id]]);
    llm.queue.push({ episodes: [{ content: 'Cosa da dimenticare', occurred_at: '2026-03-07', evidence: [1] }] });
    await runner.runForConversation(c9);
    expect(await db.query(`SELECT count(*)::int AS n FROM episodes WHERE content = 'Cosa da dimenticare'`)).toEqual([{ n: 0 }]);
  });
});
