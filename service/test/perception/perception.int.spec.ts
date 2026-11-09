// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Perceptions (WORK_PLAN 8.12e, `API.md` §4c): what the agent's senses noticed, told in words by the client, is remembered
 * as seen — one episode of origin `perceived`, no model, no extraction — with who was recognised; the same thing noticed
 * again a moment later is one; it fades after its keep time, and what a person said about it, or a pattern the memory
 * drew from it, stays.
 */
import { type INestApplication } from '@nestjs/common';
import { type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { EpisodeSearchService } from '../../src/recall/episode-search.service';
import { fadePerceptions } from '../../src/perception/perception.service';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, testEnv } from '../helpers/app';

const NOW = new Date('2026-10-12T10:00:00Z');
const DAY = 86_400_000;

describe('perceptions (8.12e): seen, not told; once; fading', () => {
  let app: INestApplication;
  let url: string;
  let emb: Server;
  let db: DataSource;
  let clientId: string;
  let key: string;
  let home: string;
  let livia: string;
  const as = (at: Date = NOW) => ({ token: key, headers: { 'x-recordare-user': 'casa', 'x-recordare-now': at.toISOString() } });
  const perceive = (body: object, at: Date = NOW) => call(url, 'POST', '/api/v1/perceptions', { ...as(at), body });
  const face = { identity: { channel: 'face', externalId: 'livia-face' }, confidence: 0.9 };

  beforeAll(async () => {
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    testEnv({ EMBEDDING_BASE_URL: fake.url, CONSOLIDATION_SCHEDULE: 'false', ALLOW_CLOCK_OVERRIDE: 'true', IDLE_DELAY_SECONDS: '3600' });
    await resetSchema();
    ({ app, url } = await startApp());
    db = app.get(DataSource);
    clientId = (await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'A', kind: 'platform' } })).body.id;
    key = (await call(url, 'POST', `/api/v1/admin/clients/${clientId}/keys`, { token: ADMIN_KEY, body: { scopes: ['ingest', 'read', 'write'] } })).body.key;
    home = (await call(url, 'POST', '/api/v1/admin/memories', { token: ADMIN_KEY, body: { displayName: 'Casa', mode: 'entity' } })).body.personId;
    await call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY, body: { kind: 'account', personId: home, clientId, externalId: 'casa' } });
    // Livia talks to the shared agent; her face is bound as an address of hers.
    const ing = await call(url, 'POST', '/api/v1/ingest/messages', { token: key, headers: { 'x-recordare-user': 'casa' }, body: {
      conversation: { externalId: 'e-chat', participants: [{ ref: 'livia', role: 'other', displayName: 'Livia', identity: { channel: 'voice', externalId: 'livia-voice' } }] },
      messages: [{ externalId: 'e0', role: 'other', authorRef: 'livia', content: 'Ciao!', sentAt: '2026-10-11T08:00:00Z' }] } });
    expect(ing.status).toBeLessThan(300);
    livia = (await db.query(`SELECT id FROM persons WHERE memory_id = $1 AND display_name = 'Livia'`, [home]))[0].id;
    await call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY,
      body: { kind: 'participant', memoryId: home, personId: livia, channel: 'face', externalId: 'livia-face', verified: true } });
  });
  afterAll(async () => { await app?.close(); emb?.close(); });

  it('remembers what was seen as its own episode — perceived, no model, the person recognised — and answers a repeat as the same', async () => {
    const res = await perceive({ text: 'Livia è uscita con il cane', sensor: 'camera', place: 'vialetto', people: [face] });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ duplicate: false, people: [{ personId: livia, name: 'Livia' }], expiresAt: new Date(NOW.getTime() + 14 * DAY).toISOString() });
    const [e] = await db.query(
      `SELECT origin::text, subject_kind::text, subject_person_id, place, date_precision::text, audience, tags, stance::text, confidence FROM episodes WHERE id = $1`, [res.body.episodeId]);
    expect(e).toMatchObject({ origin: 'perceived', subject_kind: 'contact', subject_person_id: livia, place: 'vialetto', date_precision: 'minute',
      tags: ['perception', 'camera'], stance: 'stated', confidence: 0.9 });
    expect([...e.audience].sort()).toEqual([home, livia].sort());
    // In the raw log as the agent's own, already marked extracted (no extraction will read it), by a run without a model.
    const [m] = await db.query(
      `SELECT m.author_kind::text, c.source::text, r.model, r.prompt_version, r.status::text FROM messages m JOIN conversations c ON c.id = m.conversation_id
       JOIN extraction_runs r ON r.id = m.extracted_run_id JOIN episode_evidence ev ON ev.message_id = m.id WHERE ev.episode_id = $1`, [res.body.episodeId]);
    expect(m).toEqual({ author_kind: 'own', source: 'perception', model: 'perception', prompt_version: 'perception.v1', status: 'done' });
    expect((await db.query(`SELECT count(*)::int AS n FROM llm_calls`).catch(() => [{ n: 0 }]))[0].n).toBe(0);

    // The camera fires again five minutes later: the same perception.
    const again = await perceive({ text: 'Livia è uscita con il cane.', sensor: 'camera', place: 'vialetto', people: [face] }, new Date(NOW.getTime() + 5 * 60_000));
    expect(again.body).toMatchObject({ duplicate: true, episodeId: res.body.episodeId });
    // Elsewhere, or by another sensor, it is another one.
    expect((await perceive({ text: 'Livia è uscita con il cane', sensor: 'camera', place: 'cancello', people: [face] })).body.duplicate).toBe(false);

    // Nobody recognised: the memory's own experience; unknown people only in its words.
    const stranger = await perceive({ text: 'Una persona che non conosco ha suonato il campanello', sensor: 'camera', place: 'ingresso',
      people: [{ identity: { channel: 'face', externalId: 'unknown-face' }, confidence: 0.8 }] });
    expect(stranger.body.people).toEqual([]);
    expect((await db.query(`SELECT subject_kind::text FROM episodes WHERE id = $1`, [stranger.body.episodeId]))[0].subject_kind).toBe('self');
  });

  it('is shown as seen: the diary has its sensor and when it fades; the recall marks it `seen`', async () => {
    const diary: Array<{ content: string; origin: string; perception?: { sensor: string; expiresAt: string | null } }> =
      (await call(url, 'GET', '/api/v1/episodes?limit=50', as())).body.items;
    const bell = diary.find((d) => d.content.includes('campanello'))!;
    expect(bell).toMatchObject({ origin: 'perceived', perception: { sensor: 'camera', expiresAt: new Date(NOW.getTime() + 14 * DAY).toISOString() } });
    const found = await app.get(EpisodeSearchService).search(home, clientId, { mode: 'list', from: '2026-10-12', to: '2026-10-12' }, NOW);
    const item = found.episodes.find((x) => x.content.includes('campanello'))!;
    expect(item).toMatchObject({ origin: 'perceived', seen: true });
  });

  it('keeps it as long as asked: the request\'s keepDays, the memory\'s setting, 0 = kept', async () => {
    const serious = await perceive({ text: 'Il sensore di fumo in cucina è scattato', sensor: 'sensor', place: 'cucina', keepDays: 365 });
    expect(serious.body.expiresAt).toBe(new Date(NOW.getTime() + 365 * DAY).toISOString());
    expect((await call(url, 'PATCH', `/api/v1/admin/memories/${home}`, { token: ADMIN_KEY, body: { perceptionKeepDays: 0 } })).status).toBe(200);
    expect((await perceive({ text: 'La porta del garage è aperta', sensor: 'sensor', place: 'garage' })).body.expiresAt).toBeNull();
    expect((await call(url, 'PATCH', `/api/v1/admin/memories/${home}`, { token: ADMIN_KEY, body: { perceptionKeepDays: 3 } })).status).toBe(200);
    expect((await perceive({ text: 'Il corriere ha lasciato un pacco', sensor: 'camera', place: 'ingresso' })).body.expiresAt)
      .toBe(new Date(NOW.getTime() + 3 * DAY).toISOString());
    expect((await call(url, 'PATCH', `/api/v1/admin/memories/${home}`, { token: ADMIN_KEY, body: { perceptionKeepDays: null } })).status).toBe(200);
  });

  it('fades: the perception goes, what a person said about it and a pattern drawn from it stay', async () => {
    const seen = await perceive({ text: 'Un furgone bianco parcheggiato davanti al cancello', sensor: 'camera', place: 'strada' }, new Date(NOW.getTime() + DAY));
    const perceived: string = seen.body.episodeId;
    // Livia tells what it was: her own words, her own episode.
    await call(url, 'POST', '/api/v1/ingest/messages', { token: key, headers: { 'x-recordare-user': 'casa' }, body: {
      conversation: { externalId: 'e-chat', participants: [{ ref: 'livia', role: 'other', displayName: 'Livia', identity: { channel: 'voice', externalId: 'livia-voice' } }] },
      messages: [{ externalId: 'e1', role: 'other', authorRef: 'livia', content: 'Il furgone bianco era del tecnico della caldaia.', sentAt: '2026-10-13T12:00:00Z' }] } });
    const [msg] = await db.query(`SELECT id FROM messages WHERE external_id = 'e1'`);
    const [told] = await db.query(
      `INSERT INTO episodes (memory_id, kind, content, occurred_at, date_precision, origin, author_role, stance, confidence, disclosure, audience, subject_kind, subject_person_id)
       VALUES ($1, 'event', 'Il tecnico della caldaia è passato con un furgone bianco', '2026-10-13T09:00:00Z', 'day', 'holder_told', 'other', 'stated', 1, 'holder', ARRAY[$1::uuid], 'contact', $2)
       RETURNING id`, [home, livia]);
    await db.query(`INSERT INTO episode_evidence (episode_id, message_id, evidence_kind) VALUES ($1, $2, 'message')`, [told.id, msg.id]);
    // A pattern the memory drew from the perception, and a plain note resting on it alone.
    const note = async (content: string, origin: string) => (await db.query(
      `INSERT INTO notes (memory_id, category, content, origin, author_role, stance, confidence, disclosure, audience, subject_kind)
       VALUES ($1, 'knowledge', $2, $3, 'holder', 'inferred', 0.6, 'holder', ARRAY[$1::uuid], 'self') RETURNING id`, [home, content, origin]))[0].id as string;
    const pattern = await note('Il furgone del tecnico passa ogni tanto', 'reflected');
    const plain = await note('Davanti al cancello c\'era un furgone', 'holder_lived');
    for (const n of [pattern, plain]) await db.query(`INSERT INTO note_evidence (note_id, episode_id) VALUES ($1, $2)`, [n, perceived]);

    // Not yet: nothing fades before its time.
    expect(await fadePerceptions(db, home, new Date(NOW.getTime() + 2 * DAY))).toBe(0);
    const faded = await fadePerceptions(db, home, new Date(NOW.getTime() + 16 * DAY));
    expect(faded).toBeGreaterThan(0);
    expect(await db.query(`SELECT id FROM episodes WHERE id = $1`, [perceived])).toEqual([]);
    expect(await db.query(`SELECT 1 FROM perceptions p JOIN messages m ON m.id = p.message_id WHERE p.episode_id IS NULL OR p.expires_at <= $1`,
      [new Date(NOW.getTime() + 16 * DAY)])).toEqual([]);
    expect(await db.query(`SELECT id FROM episodes WHERE id = $1`, [told.id])).toHaveLength(1);
    expect(await db.query(`SELECT id FROM notes WHERE id = $1`, [pattern])).toHaveLength(1);
    expect(await db.query(`SELECT id FROM notes WHERE id = $1`, [plain])).toEqual([]);
    // Kept ones stay: the serious one (a year) and the one kept forever.
    const left = (await db.query(`SELECT content FROM episodes WHERE memory_id = $1 AND origin = 'perceived' ORDER BY content`, [home])).map((r: { content: string }) => r.content);
    expect(left).toEqual(['Il sensore di fumo in cucina è scattato', 'La porta del garage è aperta']);
  });

  it('belongs to a client: the admin key is refused; an empty text is refused', async () => {
    expect((await call(url, 'POST', '/api/v1/perceptions', { token: ADMIN_KEY, headers: { 'x-recordare-user': 'casa' },
      body: { text: 'x', sensor: 'camera' } })).status).toBeGreaterThanOrEqual(400);
    expect((await perceive({ text: '  ', sensor: 'camera' })).status).toBe(400);
  });
});
