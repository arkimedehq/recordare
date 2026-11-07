// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Timing v2 (D55 F6, `docs/INITIATIVES_DELIVERY.md` §4): the moment's context. With `INITIATIVE_TIMING=v2` a flexible
 * initiative waits after a refusal (a pause), while a client says the person is busy, while people in the room are
 * talking (the opening waits for a pause — the arrival stays owed), and where the person has often not taken one in
 * company (learnt apart from alone). A time the person chose goes anyway.
 */
import { type INestApplication } from '@nestjs/common';
import { type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { InitiativeService } from '../../src/initiative/initiative.service';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, testEnv } from '../helpers/app';

const NOW = new Date('2026-10-12T10:00:00Z'); // 12:00 in Rome: outside the quiet hours
const HOUR = 3_600_000;
const T = (h: number) => new Date(NOW.getTime() + h * HOUR);

describe('timing v2 (D55 F6): the moment\'s context — a pause after a refusal, busy, a conversation, company', () => {
  let app: INestApplication;
  let url: string;
  let emb: Server;
  let db: DataSource;
  let clientId: string;
  let key: string;
  let home: string; // entity memory (a shared agent)
  let marco: string; // personal memory
  let eriona: string;
  const eri = { identity: { channel: 'voice', externalId: 'eriona-voiceprint' } };
  const leoId = { identity: { channel: 'homeassistant', externalId: 'person.leo' } };

  const presence = (user: string, h: number, body: object) =>
    call(url, 'POST', '/api/v1/presence', { token: key, headers: { 'x-recordare-user': user, 'x-recordare-now': T(h).toISOString() }, body });
  const status = async (id: string) => (await db.query(`SELECT status::text FROM initiatives WHERE id = $1`, [id]))[0].status as string;
  const reasons = async (id: string) => (await db.query(
    `SELECT features->>'reason' AS reason FROM initiative_decisions WHERE initiative_id = $1 ORDER BY at, id`, [id])).map((r: { reason: string }) => r.reason);
  /** A pending initiative due at hour h, kept a day (everything else pending in the memory set aside). */
  async function due(memoryId: string, content: string, h: number, opts: { for?: string; kind?: string; timed?: boolean } = {}): Promise<string> {
    await db.query(`UPDATE initiatives SET status = 'expired' WHERE memory_id = $1 AND status IN ('pending', 'offered')`, [memoryId]);
    await db.query(`INSERT INTO intents (memory_id, kind, content, for_person_id, due_at, expires_at, timed) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [memoryId, opts.kind ?? 'followup', content, opts.for ?? null, T(h), T(h + 24), opts.timed ?? false]);
    await app.get(InitiativeService).sweep(memoryId, T(h));
    return (await db.query(`SELECT id FROM initiatives WHERE text LIKE '%' || $1 || '%' ORDER BY created_at DESC LIMIT 1`, [content]))[0].id as string;
  }
  /** An earlier initiative of the person's, given at `offered` and closed with `status` at `at` (a reaction optional). */
  async function earlier(memoryId: string, forId: string | null, status: string, offered: number, at: number, opts: { reaction?: string; opened?: boolean; channel?: string } = {}): Promise<void> {
    await db.query(
      `INSERT INTO initiatives (memory_id, kind, text, reason, for_person_id, status, channel, due_at, expires_at, offered_at, opened_at, outcome_at, outcome_context)
       VALUES ($1, 'ask', 'earlier', 'earlier', $2, $3, $4, $5, $6, $5, $7, $8, $9)`,
      [memoryId, forId, status, opts.channel ?? 'voice', T(offered), T(offered + 24), opts.opened ? T(offered) : null, T(at),
        opts.reaction ? JSON.stringify({ reaction: opts.reaction }) : null]);
  }

  beforeAll(async () => {
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    testEnv({ EMBEDDING_BASE_URL: fake.url, CONSOLIDATION_SCHEDULE: 'false', INITIATIVE_WORDING: 'false', ALLOW_CLOCK_OVERRIDE: 'true',
      IDLE_DELAY_SECONDS: '3600', INITIATIVE_DAILY_LIMIT: '20', INITIATIVE_TIMING: 'v2', INITIATIVE_VOICE_PACE_MINUTES: '0' });
    await resetSchema();
    ({ app, url } = await startApp());
    db = app.get(DataSource);
    clientId = (await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'A', kind: 'platform' } })).body.id;
    key = (await call(url, 'POST', `/api/v1/admin/clients/${clientId}/keys`, { token: ADMIN_KEY, body: { scopes: ['ingest', 'read', 'write'] } })).body.key;
    home = (await call(url, 'POST', '/api/v1/admin/memories', { token: ADMIN_KEY, body: { displayName: 'Casa', mode: 'entity' } })).body.personId;
    marco = (await call(url, 'POST', '/api/v1/admin/memories', { token: ADMIN_KEY, body: { displayName: 'Marco' } })).body.personId;
    for (const [personId, externalId] of [[home, 'casa'], [marco, 'marco']]) {
      await call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY, body: { kind: 'account', personId, clientId, externalId } });
    }
    const res = await call(url, 'POST', '/api/v1/ingest/messages', { token: key, headers: { 'x-recordare-user': 'casa' },
      body: { conversation: { externalId: 'kitchen', participants: [
        { ref: 'eriona', role: 'other', displayName: 'Eriona', identity: eri.identity },
        { ref: 'leo', role: 'other', displayName: 'Leo', identity: leoId.identity }] },
      messages: [{ externalId: 'k1', role: 'other', authorRef: 'eriona', content: 'Ciao!', sentAt: '2026-10-12T08:00:00Z' },
        { externalId: 'k2', role: 'other', authorRef: 'leo', content: 'Ciao!', sentAt: '2026-10-12T08:00:10Z' }] } });
    expect(res.status).toBeLessThan(300);
    eriona = (await db.query(`SELECT id FROM persons WHERE memory_id = $1 AND display_name = 'Eriona'`, [home]))[0].id;
  });
  afterAll(async () => { await app?.close(); emb?.close(); });

  it('a pause after a refusal: nothing flexible for three hours after a decline (an hour after an ignore), in a room or a turn; a time they chose goes', async () => {
    const id = await due(marco, 'Hai sentito Luca?', 1);
    await earlier(marco, null, 'declined', 0, 0.5);
    expect((await presence('marco', 1, { channel: 'voice', place: 'kitchen' })).body.initiative).toBeNull();
    // In a turn too: the memory context does not carry it.
    const turn = await call(url, 'POST', '/api/v1/context', { token: key, headers: { 'x-recordare-user': 'marco', 'x-recordare-now': T(1.2).toISOString() },
      body: { query: 'ciao, come va?', card: false } });
    expect(turn.status).toBe(200);
    expect(await status(id)).toBe('pending');
    expect(await reasons(id)).toEqual(['cooldown', 'cooldown']);
    // A reminder he asked for at this time is his: given.
    const timed = await due(marco, 'prendere la medicina', 1.3, { kind: 'request', timed: true });
    expect((await presence('marco', 1.3, { channel: 'voice', place: 'hall' })).body.initiative).toMatchObject({ id: timed, status: 'offered' });
    // Past the pause, arriving in another room: given.
    const later = await due(marco, 'Hai chiamato il dentista?', 4);
    expect((await presence('marco', 4, { channel: 'voice', place: 'study' })).body.initiative).toMatchObject({ id: later, status: 'offered' });

    // A negative reaction counts as a decline; an ignore holds an hour — but not one settled long after it was given.
    const next = await due(marco, 'Hai prenotato il ristorante?', 25);
    await earlier(marco, null, 'said', 24.5, 24.6, { reaction: 'negative' });
    expect((await presence('marco', 25, { channel: 'voice', place: 'garden' })).body.initiative).toBeNull();
    const after = await due(marco, 'Hai pagato la bolletta?', 49);
    await earlier(marco, null, 'ignored', 48.7, 48.8);
    expect((await presence('marco', 49, { channel: 'voice', place: 'attic' })).body.initiative).toBeNull();
    const lapsed = await due(marco, 'Hai annaffiato le piante?', 52);
    await earlier(marco, null, 'ignored', 42, 51.9); // given ten hours ago, its window lapsed just now: not "just ignored"
    expect((await presence('marco', 52, { channel: 'voice', place: 'cellar' })).body.initiative).toMatchObject({ id: lapsed });
    expect([await reasons(next), await reasons(after)]).toEqual([['cooldown'], ['cooldown']]);
  });

  it('busy: nothing flexible on any channel while a client says so; the arrival stays owed until it ends', async () => {
    const id = await due(marco, 'Hai ritirato il pacco?', 72);
    // A client knows he is on a call (at home: recorded, nothing offered).
    expect((await presence('marco', 72, { channel: 'home', busy: true, ttlSeconds: 3600 })).body.initiative).toBeNull();
    expect((await presence('marco', 72.1, { channel: 'voice', place: 'kitchen' })).body.initiative).toBeNull();
    expect(await reasons(id)).toEqual(['busy']);
    // The call ends: the next impulse in the kitchen is still the arrival — given.
    await presence('marco', 72.2, { channel: 'home', busy: false });
    expect((await presence('marco', 72.25, { channel: 'voice', place: 'kitchen' })).body.initiative).toMatchObject({ id, status: 'offered' });

    // The clock too: on a channel that always reaches him, held while he is busy, pushed once he is not.
    await call(url, 'PATCH', `/api/v1/admin/clients/${clientId}`, { token: ADMIN_KEY, body: { channels: [{ kind: 'chat', reach: 'always' }] } });
    await presence('marco', 100, { channel: 'home', busy: true, ttlSeconds: 3600 });
    const pushed = await due(marco, 'Hai sentito la nonna?', 100.1);
    expect(await status(pushed)).toBe('pending');
    expect(await reasons(pushed)).toEqual(['busy']);
    await presence('marco', 100.2, { channel: 'home', busy: false });
    await app.get(InitiativeService).sweep(marco, T(100.3));
    expect(await status(pushed)).toBe('offered');
    await call(url, 'PATCH', `/api/v1/admin/clients/${clientId}`, { token: ADMIN_KEY, body: { channels: [] } });
  });

  it('a conversation in progress: the opening waits for a pause, and the arrival stays owed', async () => {
    const id = await due(home, 'Hai steso i panni?', 96, { for: eriona });
    // Leo is talking on the phone in the kitchen (the client hears speech); Eriona comes in within the gap.
    await presence('casa', 96, { channel: 'voice', place: 'kitchen', person: leoId, confidence: 0.9, talking: true });
    const busy = await presence('casa', 96.01, { channel: 'voice', place: 'kitchen', people: [{ ...eri, confidence: 0.9 }, { ...leoId, confidence: 0.9 }] });
    expect(busy.body).toMatchObject({ initiative: null, opening: null });
    expect(await reasons(id)).toEqual(['conversation']);
    // Three minutes later the camera still sees both, no talking said since: a pause — the arrival was owed, the opening is said now.
    const pause = await presence('casa', 96.06, { channel: 'camera', place: 'kitchen', people: [{ ...eri, confidence: 0.9 }, { ...leoId, confidence: 0.9 }] });
    expect(pause.body).toMatchObject({ initiative: { id, status: 'pending' }, opening: 'Eriona, ho una cosa per te: vuoi sentirla?' });

    // Several people named on a voice impulse describe the room, not a conversation: with `talking`, it is one.
    const other = await due(home, 'Hai chiuso la finestra?', 98, { for: eriona });
    const talking = await presence('casa', 98, { channel: 'camera', place: 'hall', talking: true, people: [{ ...eri, confidence: 0.9 }, { ...leoId, confidence: 0.9 }] });
    expect(talking.body).toMatchObject({ initiative: null, opening: null });
    expect(await reasons(other)).toEqual(['conversation']);
  });

  it('company learnt apart: where she has often not taken one with others, it waits until she is alone', async () => {
    // Afternoons with others (after an opening) she let three go; alone she takes them.
    for (const h of [120, 121, 122]) await earlier(home, eriona, 'ignored', h - 24, h - 23.9, { opened: true });
    for (const h of [123, 124]) await earlier(home, eriona, 'said', h - 24, h - 23.9);
    const id = await due(home, 'Hai comprato il pane?', 120, { for: eriona });
    const crowd = await presence('casa', 120, { channel: 'camera', place: 'living room', people: [{ ...eri, confidence: 0.9 }, { ...leoId, confidence: 0.9 }] });
    expect(crowd.body).toMatchObject({ initiative: null, opening: null });
    expect(await reasons(id)).toEqual(['learnt_company']);
    const alone = await presence('casa', 120.1, { channel: 'camera', place: 'study', person: eri, confidence: 0.9 });
    expect(alone.body).toMatchObject({ initiative: { id, status: 'offered' }, opening: null });
  });
});
