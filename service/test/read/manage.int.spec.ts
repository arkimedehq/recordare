// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type INestApplication } from '@nestjs/common';
import { type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, testEnv } from '../helpers/app';

describe('read API, the rest of 4.7: manual entry, corrections, details, change feed, settings, usage, export', () => {
  let app: INestApplication;
  let url: string;
  let emb: Server;
  let key: string;
  let readOnly: string;
  let clientId: string;
  let db: DataSource;
  const as = (user: string, token = key) => ({ token, headers: { 'x-recordare-user': user } });
  /** The memory's personal token: `memory_settings` and `export` are never given to a client key (API.md, Scopes). */
  const personal = async (user: string, scopes: string[]) => {
    const memoryId: string = (await call(url, 'GET', '/api/v1/me', as(user))).body.memoryId;
    return (await call(url, 'POST', `/api/v1/admin/memories/${memoryId}/tokens`, { token: ADMIN_KEY, body: { clientId, scopes } })).body.token as string;
  };

  beforeAll(async () => {
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    testEnv({ EMBEDDING_BASE_URL: fake.url, IDLE_DELAY_SECONDS: '3600' });
    await resetSchema();
    ({ app, url } = await startApp());
    db = app.get(DataSource);
    const client = (await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'P', kind: 'platform', autoProvision: true } })).body;
    clientId = client.id;
    key = (await call(url, 'POST', `/api/v1/admin/clients/${client.id}/keys`, { token: ADMIN_KEY, body: { scopes: ['ingest', 'read', 'write'] } })).body.key;
    readOnly = (await call(url, 'POST', `/api/v1/admin/clients/${client.id}/keys`, { token: ADMIN_KEY, body: { scopes: ['read'] } })).body.key;
  });
  afterAll(async () => { await app?.close(); emb?.close(); });

  it('manual entry: an episode and a note written by the person are stated, with no message behind them', async () => {
    const ep = await call(url, 'POST', '/api/v1/episodes', { ...as('u1'), body: { content: 'Cena da Aldina', occurredAt: '2026-10-03' } });
    expect(ep.status).toBe(201);
    const note = await call(url, 'POST', '/api/v1/notes', { ...as('u1'), body: { content: 'Il caffè lo prendo amaro', category: 'preference' } });
    const [e] = await db.query(`SELECT origin::text, author_role::text, stance::text, importance,
      (SELECT count(*)::int FROM episode_evidence WHERE episode_id = episodes.id) AS evidence FROM episodes WHERE id = $1`, [ep.body.id]);
    expect(e).toEqual({ origin: 'holder_lived', author_role: 'holder', stance: 'stated', importance: 10, evidence: 0 });
    const n = await call(url, 'GET', `/api/v1/notes/${note.body.id}`, as('u1'));
    expect(n.body).toMatchObject({ content: 'Il caffè lo prendo amaro', category: 'preference', pending: false, inferred: false, status: 'current',
      evidence: [], episodeIds: [] });
    expect((await call(url, 'POST', '/api/v1/notes', { ...as('u1', readOnly), body: { content: 'x' } })).status).toBe(403);
  });

  it('corrects a fact and a note: history kept; details show it; 404 for what is not current', async () => {
    const memoryId: string = (await call(url, 'GET', '/api/v1/me', as('u1'))).body.memoryId;
    await db.query(`INSERT INTO fact_slots (key, description) VALUES ('city', 'city') ON CONFLICT DO NOTHING`);
    const [f] = await db.query(`INSERT INTO facts (memory_id, key, value, valid_from, origin, author_role, audience)
      VALUES ($1, 'city', 'Torino', '2026-01-01', 'holder_lived', 'holder', ARRAY[$1::uuid]) RETURNING id`, [memoryId]);
    const fixed = await call(url, 'POST', `/api/v1/facts/${f.id}/corrections`, { ...as('u1'), body: { value: 'Milano' } });
    expect(fixed.status).toBe(201);
    const detail = (await call(url, 'GET', `/api/v1/facts/${fixed.body.id}`, as('u1'))).body;
    expect(detail).toMatchObject({ key: 'city', value: 'Milano', status: 'current', corrects: f.id, validFrom: '2026-01-01', inferred: false });
    expect(detail.history.map((h: { value: string; status: string }) => [h.value, h.status])).toEqual([['Torino', 'corrected'], ['Milano', 'current']]);
    expect((await call(url, 'POST', `/api/v1/facts/${f.id}/corrections`, { ...as('u1'), body: { value: 'Roma' } })).status).toBe(404);
    expect((await call(url, 'GET', '/api/v1/facts', as('u1'))).body.map((x: { value: string }) => x.value)).toEqual(['Milano']);

    const [note] = (await call(url, 'GET', '/api/v1/notes', as('u1'))).body;
    const nfix = await call(url, 'POST', `/api/v1/notes/${note.id}/corrections`, { ...as('u1'), body: { content: 'Il caffè lo prendo amaro, senza zucchero' } });
    expect((await call(url, 'GET', `/api/v1/notes/${nfix.body.id}`, as('u1'))).body).toMatchObject({ corrects: note.id, category: 'preference', status: 'current' });
    expect((await call(url, 'GET', `/api/v1/notes/${note.id}`, as('u1'))).body.status).toBe('corrected');
    expect((await call(url, 'GET', `/api/v1/facts/${f.id}`, as('u2'))).status).toBe(404); // another memory's
  });

  it('the notes change feed: every change after `since`, with the note as it is now (null once forgotten)', async () => {
    const all = (await call(url, 'GET', '/api/v1/notes/changes', as('u1'))).body;
    expect(all.items.map((i: { change: string }) => i.change)).toEqual(['created', 'corrected']);
    expect(all.items[1].note).toMatchObject({ content: 'Il caffè lo prendo amaro, senza zucchero', status: 'current' });
    expect(all.items.map((i: { replaces: string | null }) => i.replaces)).toEqual([null, all.items[0].noteId]);
    await call(url, 'DELETE', `/api/v1/notes/${all.items[1].noteId}`, as('u1'));
    const next = (await call(url, 'GET', `/api/v1/notes/changes?since=${all.next}`, as('u1'))).body;
    expect(next.items).toEqual([expect.objectContaining({ change: 'forgotten', noteId: all.items[1].noteId, replaces: null, note: null })]);
    expect((await call(url, 'GET', `/api/v1/notes/changes?since=${next.next}`, as('u1'))).body).toEqual({ items: [], next: next.next, more: false });
  });

  it('settings: read with `read`, changed with `memory_settings`; invalid values are refused', async () => {
    expect((await call(url, 'GET', '/api/v1/settings', as('u1', readOnly))).body)
      .toEqual({ locale: 'it', timezone: 'Europe/Rome', qualityProfile: null, effectiveQualityProfile: 'balanced' });
    expect((await call(url, 'PATCH', '/api/v1/settings', { ...as('u1'), body: { locale: 'en' } })).status).toBe(403);
    const token = await personal('u1', ['read', 'memory_settings']);
    expect((await call(url, 'PATCH', '/api/v1/settings', { token, body: { timezone: 'Mars/Olympus' } })).status).toBe(400);
    const r = await call(url, 'PATCH', '/api/v1/settings', { token, body: { locale: 'en-gb', timezone: 'Europe/London', qualityProfile: 'full' } });
    expect(r.body).toEqual({ locale: 'en-GB', timezone: 'Europe/London', qualityProfile: 'full', effectiveQualityProfile: 'full' });
    await call(url, 'PATCH', '/api/v1/settings', { token, body: { locale: 'it', timezone: 'Europe/Rome', qualityProfile: null } });
  });

  it('usage: calls and tokens of the period, by prompt and by day', async () => {
    const memoryId: string = (await call(url, 'GET', '/api/v1/me', as('u1'))).body.memoryId;
    await db.query(`INSERT INTO llm_calls (memory_id, prompt_id, provider, model, input_tokens, cached_input_tokens, output_tokens, status, created_at) VALUES
      ($1, 'extract.v15', 'p', 'm', 1000, 400, 100, 'ok', '2026-10-05T10:00:00Z'),
      ($1, 'extract.v15', 'p', 'm', 500, 0, 50, 'error', '2026-10-06T10:00:00Z'),
      ($1, 'digest.day.v2', 'p', 'm', 200, 0, 20, 'ok', '2026-10-06T23:30:00Z'),
      ($1, 'digest.day.v2', 'p', 'm', 999, 0, 99, 'ok', '2026-09-01T10:00:00Z')`, [memoryId]);
    const u = (await call(url, 'GET', '/api/v1/usage?from=2026-10-01&to=2026-10-07', as('u1'))).body;
    expect(u).toMatchObject({ from: '2026-10-01', to: '2026-10-07', calls: 3, inputTokens: 1700, cachedInputTokens: 400, outputTokens: 170, failed: 1 });
    expect(u.byPrompt.map((p: { prompt: string; calls: number }) => [p.prompt, p.calls])).toEqual([['digest.day.v2', 1], ['extract.v15', 2]]);
    // 23:30 UTC on the 6th is the 7th in Rome.
    expect(u.byDay.map((d: { day: string; calls: number }) => [d.day, d.calls])).toEqual([['2026-10-05', 1], ['2026-10-06', 1], ['2026-10-07', 1]]);
    expect((await call(url, 'GET', '/api/v1/usage?from=2026-10-07&to=2026-10-01', as('u1'))).status).toBe(400);
  });

  it('export: built in the background, then downloaded as one JSON archive without vectors or hidden messages', async () => {
    await call(url, 'POST', '/api/v1/ingest/messages', { ...as('u3'), body: { conversation: { externalId: 'chat' }, messages: [
      { externalId: 'a', role: 'user', content: 'Ho visto Giulia', sentAt: '2026-08-10T10:00:00+02:00' },
      { externalId: 'b', role: 'user', content: 'Domani mare', sentAt: '2026-10-01T10:00:00+02:00' }] } });
    await call(url, 'POST', '/api/v1/episodes', { ...as('u3'), body: { content: 'Mare a Rimini', occurredAt: '2026-10-02' } });
    await call(url, 'POST', '/api/v1/forget', { ...as('u3'), body: { from: '2026-08', to: '2026-08', keepRaw: true } });
    expect((await call(url, 'POST', '/api/v1/exports', as('u3'))).status).toBe(403);
    const token = await personal('u3', ['export']);
    const started = await call(url, 'POST', '/api/v1/exports', { token });
    expect(started).toMatchObject({ status: 202, body: { status: 'running' } });
    let status = started.body;
    for (let i = 0; i < 50 && status.status === 'running'; i++) {
      await new Promise((r) => setTimeout(r, 100));
      status = (await call(url, 'GET', `/api/v1/exports/${started.body.id}`, { token })).body;
    }
    expect(status).toMatchObject({ status: 'done', bytes: expect.any(Number) });
    const archive = await call(url, 'GET', `/api/v1/exports/${started.body.id}/archive`, { token });
    expect(archive.status).toBe(200);
    expect(archive.body).toMatchObject({ format: 'recordare-export/1', memory: { display_name: 'u3' } });
    expect(archive.body.messages.map((m: { content: string }) => m.content)).toEqual(['Domani mare']); // August is hidden
    expect(archive.body.episodes.map((e: { content: string }) => e.content)).toEqual(['Mare a Rimini']);
    expect(archive.body.episodes[0]).not.toHaveProperty('embedding');
    const other = await personal('u1', ['export']);
    expect((await call(url, 'GET', `/api/v1/exports/${started.body.id}`, { token: other })).status).toBe(404); // not u1's
  });
});
