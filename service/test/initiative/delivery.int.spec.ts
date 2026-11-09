// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * D55 delivery (`docs/INITIATIVES_DELIVERY.md` F1): Recordare decides who, when and where. A presence impulse or a turn of
 * the right person gets the one initiative due now (offered once); an entity memory gives one only to a person recognised
 * surely enough — or to whoever talks in the conversation it came from — and with nobody identified asks who it is; an
 * offered initiative closes by what happens next; clients declare their channels, webhooks take the events they want.
 */
import { type INestApplication } from '@nestjs/common';
import { createServer, type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { InitiativeService, pickChannel } from '../../src/initiative/initiative.service';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, testEnv } from '../helpers/app';

const NOW = new Date('2026-10-12T10:00:00Z'); // 12:00 in Rome: outside the quiet hours
const HOUR = 3_600_000;

describe('initiative delivery (D55): presence impulses, the in-turn channel, identity thresholds, channels, events', () => {
  let app: INestApplication;
  let url: string;
  let emb: Server;
  let receiver: Server;
  let db: DataSource;
  let clientId: string;
  let key: string;
  let home: string; // entity memory (a shared agent)
  let marco: string; // personal memory
  let eriona: string;
  const received: Array<{ hook: string; body: { type: string; data: { id: string; status: string } } }> = [];
  const at = { 'x-recordare-now': NOW.toISOString() };
  const as = (user: string, extra: Record<string, string> = {}) => ({ token: key, headers: { 'x-recordare-user': user, ...at, ...extra } });

  async function ingest(user: string, conversation: string, messages: object[], participants: object[] = []): Promise<void> {
    const res = await call(url, 'POST', '/api/v1/ingest/messages', { token: key, headers: { 'x-recordare-user': user },
      body: { conversation: { externalId: conversation, participants }, messages } });
    expect(res.status).toBeLessThan(300);
  }
  const messageId = async (externalId: string): Promise<string> => (await db.query(`SELECT id FROM messages WHERE external_id = $1`, [externalId]))[0].id;
  /** A request intent due an hour ago (the extraction's INTENTS make these), fired by the sweep. */
  async function request(memoryId: string, content: string, opts: { for?: string; message?: string; timed?: boolean; kind?: string } = {}): Promise<string> {
    await db.query(
      `INSERT INTO intents (memory_id, kind, content, for_person_id, message_id, due_at, expires_at, timed) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [memoryId, opts.kind ?? 'request', content, opts.for ?? null, opts.message ? await messageId(opts.message) : null,
        new Date(NOW.getTime() - HOUR), new Date(NOW.getTime() + 20 * HOUR), opts.timed ?? false]);
    await app.get(InitiativeService).sweep(memoryId, NOW);
    const [row] = await db.query(`SELECT id FROM initiatives WHERE text LIKE '%' || $1 || '%' ORDER BY created_at DESC LIMIT 1`, [content]);
    return row.id as string;
  }
  const feed = async (user: string) => (await call(url, 'GET', '/api/v1/initiatives', as(user))).body.items as Array<{ id: string; timing: string; channel: string | null }>;
  const row = async (id: string) => (await db.query(
    `SELECT status::text, channel, offered_conversation_id, outcome_channel, outcome_context, timing, identity_required FROM initiatives WHERE id = $1`, [id]))[0];
  const presence = (user: string, body: object) => call(url, 'POST', '/api/v1/presence', { ...as(user), body });
  const context = (user: string, conversation: string, body: object = {}) =>
    call(url, 'POST', '/api/v1/context', { ...as(user, { 'x-recordare-conversation': conversation }), body: { query: 'ciao, come va?', card: false, ...body } });

  beforeAll(async () => {
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    receiver = createServer((req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => { received.push({ hook: req.url ?? '', body: JSON.parse(body) }); res.statusCode = 204; res.end(); });
    });
    await new Promise<void>((r) => receiver.listen(0, '127.0.0.1', r));
    const { port } = receiver.address() as { port: number };
    testEnv({ EMBEDDING_BASE_URL: fake.url, WEBHOOK_ALLOW_PRIVATE: 'true', CONSOLIDATION_SCHEDULE: 'false', INITIATIVE_WORDING: 'false',
      ALLOW_CLOCK_OVERRIDE: 'true', IDLE_DELAY_SECONDS: '3600', INITIATIVE_DAILY_LIMIT: '20' });
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
    // Eriona writes to the shared agent on a channel: a contact of the entity memory with a verified identity.
    await ingest('casa', 'eriona-chat', [{ externalId: 'e1', role: 'other', authorRef: 'eriona', content: 'Ho messo i panni a lavare, ricordami di stenderli.', sentAt: '2026-10-12T08:00:00Z' }],
      [{ ref: 'eriona', role: 'other', displayName: 'Eriona', identity: { channel: 'voice', externalId: 'eriona-voiceprint' } }]);
    eriona = (await db.query(`SELECT id FROM persons WHERE memory_id = $1 AND display_name = 'Eriona'`, [home]))[0].id;
    await call(url, 'POST', `/api/v1/admin/clients/${clientId}/webhooks`, { token: ADMIN_KEY, body: { url: `http://127.0.0.1:${port}/all` } });
    const only = await call(url, 'POST', `/api/v1/admin/clients/${clientId}/webhooks`,
      { token: ADMIN_KEY, body: { url: `http://127.0.0.1:${port}/created`, events: ['initiative.created'] } });
    expect(only.body.events).toEqual(['initiative.created']);
  });
  afterAll(async () => { await app?.close(); emb?.close(); receiver?.close(); });

  it('an impulse of the right person, recognised surely enough, gets the initiative now — once; nobody identified: whom to ask', async () => {
    const id = await request(home, 'stendere i panni', { for: eriona, message: 'e1' });
    expect(await row(id)).toMatchObject({ status: 'pending', timing: 'flexible', identity_required: 'medium', channel: null });

    // Someone the agent cannot name: nothing is told, but it may ask whether this is Eriona.
    const unknown = await presence('casa', { channel: 'voice', person: { identity: { channel: 'voice', externalId: 'stranger' } } });
    expect(unknown.status).toBe(200);
    expect(unknown.body).toEqual({ person: null, people: [], initiative: null, askWho: { personId: eriona, name: 'Eriona' }, opening: null });
    // Eriona, but the voiceprint is unsure: below the medium threshold, nothing yet.
    const unsure = await presence('casa', { channel: 'voice', confidence: 0.5, person: { identity: { channel: 'voice', externalId: 'eriona-voiceprint' } } });
    expect(unsure.body).toMatchObject({ person: { personId: eriona, name: 'Eriona' }, initiative: null });
    const sure = await presence('casa', { channel: 'voice', confidence: 0.9, person: { identity: { channel: 'voice', externalId: 'eriona-voiceprint' } }, place: 'kitchen' });
    expect(sure.body.initiative).toMatchObject({ id, status: 'offered', channel: 'voice', timing: 'flexible', identity: { required: 'medium' },
      // How to reach her (§5c): her verified identities; what it accepts, in order (a request: messaging allowed).
      for: { name: 'Eriona', addresses: [{ channel: 'voice', id: 'eriona-voiceprint' }], addressOn: { voice: 'eriona-voiceprint' } }, channels: ['voice', 'messaging', 'chat'] });
    expect(sure.body).toMatchObject({ person: { personId: eriona }, people: [{ personId: eriona, name: 'Eriona' }], opening: null });
    expect(sure.body.initiative.text).toContain('stendere i panni');
    expect(sure.body.initiative.source).toEqual({ conversation: 'eriona-chat', messageIds: ['e1'] });
    // Given once.
    const again = await presence('casa', { channel: 'voice', confidence: 0.9, person: { identity: { channel: 'voice', externalId: 'eriona-voiceprint' } } });
    expect(again.body.initiative).toBeNull();
    const [stored] = await db.query(`SELECT channel, confidence, person_id FROM presences WHERE memory_id = $1 AND place = 'kitchen'`, [home]);
    expect(stored).toMatchObject({ channel: 'voice', person_id: eriona });
    expect(stored.confidence).toBeCloseTo(0.9);
    // The clients hear of it (initiative.updated, offered) — not the endpoint that takes created events only.
    for (let i = 0; i < 50 && !received.some((r) => r.body.data.id === id && r.body.data.status === 'offered'); i++) await new Promise((r) => setTimeout(r, 100));
    expect(received.filter((r) => r.body.data.id === id).map((r) => `${r.hook} ${r.body.type} ${r.body.data.status}`).sort())
      .toEqual(['/all initiative.created pending', '/all initiative.updated offered', '/created initiative.created pending']);
  });

  it('what came from a private message needs a sure recognition (high)', async () => {
    await ingest('casa', 'eriona-chat', [{ externalId: 'e2', role: 'other', authorRef: 'eriona', content: 'Ricordami la visita dal ginecologo.', sentAt: '2026-10-12T08:05:00Z', private: true }],
      [{ ref: 'eriona', role: 'other', displayName: 'Eriona', identity: { channel: 'voice', externalId: 'eriona-voiceprint' } }]);
    const id = await request(home, 'visita dal ginecologo', { for: eriona, message: 'e2' });
    expect(await row(id)).toMatchObject({ identity_required: 'high' });
    const medium = await presence('casa', { channel: 'voice', confidence: 0.7, person: { identity: { channel: 'voice', externalId: 'eriona-voiceprint' } } });
    expect(medium.body.initiative).toBeNull();
    // An hour later (a new arrival, past the voice pace of the first test's offer): a sure recognition gets it.
    const later = { 'x-recordare-now': new Date(NOW.getTime() + HOUR).toISOString() };
    const high = await call(url, 'POST', '/api/v1/presence', { ...as('casa', later),
      body: { channel: 'camera', confidence: 0.95, person: { identity: { channel: 'voice', externalId: 'eriona-voiceprint' } } } });
    expect(high.body.initiative).toMatchObject({ id, status: 'offered', channel: 'voice', identity: { required: 'high' } });
  });

  it('in the turn, nobody identified while something waits for someone: ask who it is, naming no one', async () => {
    await request(home, 'portare fuori il cane', { for: eriona });
    await ingest('casa', 'anon-chat', [{ externalId: 'a1', role: 'other', content: 'Che tempo fa domani?', sentAt: '2026-10-12T07:00:00Z' }]);
    const block = (await context('casa', 'anon-chat')).body.block as string;
    expect(block).toContain('- if natural, ask who you are talking with');
    expect(block).not.toContain('Eriona');
  });

  it('in the turn: the holder\'s initiative enters the memory context once, then closes when the reminder was given', async () => {
    await ingest('marco', 'm-chat', [{ externalId: 'm1', role: 'user', content: 'Ricordami di chiamare il commercialista.', sentAt: '2026-10-12T07:00:00Z' }]);
    const id = await request(marco, 'chiamare il commercialista', { message: 'm1' });
    const first = await context('marco', 'm-chat');
    expect(first.body.block).toContain('- something I meant to tell you (my own initiative; say it if natural, once):');
    expect(first.body.block).toContain('chiamare il commercialista');
    expect(first.body.items).toBe(1);
    const offered = await row(id);
    expect(offered).toMatchObject({ status: 'offered', channel: 'turn' });
    expect(offered.offered_conversation_id).toBe((await db.query(`SELECT id FROM conversations WHERE external_id = 'm-chat'`))[0].id);
    expect((await context('marco', 'm-chat')).body.block).toBeNull(); // once
    // Logged like the clock's decisions (F2a): the person was there, the moment taken.
    expect(await db.query(`SELECT trigger, p, delivered FROM initiative_decisions WHERE initiative_id = $1`, [id])).toEqual([{ trigger: 'turn', p: 1, delivered: true }]);
    // The conversation's extraction saw the reminder given (INTENTS done): the next sweep closes it as said.
    await db.query(`UPDATE intents SET status = 'done' WHERE id = (SELECT intent_id FROM initiatives WHERE id = $1)`, [id]);
    await app.get(InitiativeService).sweep(marco, NOW);
    expect(await row(id)).toMatchObject({ status: 'said', outcome_channel: 'turn' });
  });

  it('an entity memory: whoever talks in the conversation it came from gets it; someone unknown elsewhere does not', async () => {
    await ingest('casa', 'kitchen-panel', [{ externalId: 'k1', role: 'user', content: 'Ricordami di comprare il latte.', sentAt: '2026-10-12T07:30:00Z' }]);
    await ingest('casa', 'other-chat', [{ externalId: 'o1', role: 'user', content: 'Che tempo fa?', sentAt: '2026-10-12T09:59:00Z' }]);
    const id = await request(home, 'comprare il latte', { message: 'k1' });
    expect((await context('casa', 'other-chat')).body.block ?? '').not.toContain('comprare il latte');
    expect((await context('casa', 'kitchen-panel')).body.block).toContain('comprare il latte');
    expect(await row(id)).toMatchObject({ status: 'offered', channel: 'turn' });
  });

  it('in the turn, what is owed comes before an older ask (dev_timing g5)', async () => {
    await db.query(
      `INSERT INTO episodes (memory_id, kind, content, origin, author_role, stance, audience, occurred_at, date_precision, plan_status)
       VALUES ($1, 'plan', 'Cena da Paola', 'holder_lived', 'holder', 'stated', ARRAY[$1::uuid], $2, 'day', 'open')`, [marco, new Date(NOW.getTime() - 4 * 24 * HOUR)]);
    await app.get(InitiativeService).sweep(marco, NOW); // the ask about the dinner, due earlier
    await request(marco, 'comprare il regalo per Anna');
    const block = (await context('marco', 'm-chat')).body.block as string;
    expect(block).toContain('comprare il regalo per Anna');
    expect(block).not.toContain('Cena da Paola');
    await db.query(`UPDATE initiatives SET status = 'expired' WHERE memory_id = $1 AND status IN ('pending', 'offered')`, [marco]); // leave the next tests alone
  });

  it('a look-up goes to the agent in the turn only when the host says it has tools', async () => {
    await db.query(`INSERT INTO intents (memory_id, kind, content, due_at, expires_at) VALUES ($1, 'lookup', 'Leo ha scuola il sabato?', $2, $3)`,
      [marco, new Date(NOW.getTime() - HOUR), new Date(NOW.getTime() + 20 * HOUR)]);
    await app.get(InitiativeService).sweep(marco, NOW);
    expect((await context('marco', 'm-chat')).body.block ?? '').not.toContain('Leo ha scuola');
    const withTools = await context('marco', 'm-chat', { initiatives: { lookups: true } });
    expect(withTools.body.block).toContain('- something I wanted to find out with my tools, if you can');
    expect(withTools.body.block).toContain('Leo ha scuola il sabato?');
  });

  it('closes what moved on: withdrawn → declined, done before it was given → done; an offered reminder lapses as expired, an ask as ignored', async () => {
    const withdrawn = await request(marco, 'portare la giacca in lavanderia');
    const already = await request(marco, 'pagare la bolletta');
    await db.query(`UPDATE intents SET status = 'cancelled' WHERE id = (SELECT intent_id FROM initiatives WHERE id = $1)`, [withdrawn]);
    await db.query(`UPDATE intents SET status = 'done' WHERE id = (SELECT intent_id FROM initiatives WHERE id = $1)`, [already]);
    await app.get(InitiativeService).sweep(marco, NOW);
    expect((await row(withdrawn)).status).toBe('declined');
    expect((await row(already)).status).toBe('done');

    const lapsing = await request(marco, 'spegnere il forno');
    expect((await context('marco', 'm-chat')).body.block).toContain('spegnere il forno');
    await app.get(InitiativeService).sweep(marco, new Date(NOW.getTime() + 21 * HOUR));
    expect((await row(lapsing)).status).toBe('expired');
  });

  it('the outcome carries its context: the channel and how it was taken, the delay since it was due', async () => {
    const id = await request(home, 'innaffiare il basilico', { for: eriona });
    const res = await call(url, 'POST', `/api/v1/initiatives/${id}/outcome`, { ...as('casa'), body: { status: 'said', at: new Date(NOW.getTime() + HOUR).toISOString(), channel: 'voice', reaction: 'positive' } });
    expect(res.status).toBe(201);
    const r = await row(id);
    expect(r).toMatchObject({ status: 'said', outcome_channel: 'voice' });
    expect(r.outcome_context).toEqual({ reaction: 'positive', latencyMs: HOUR }); // due from the sweep (NOW), said an hour later
  });

  it('declared channels: a timed initiative goes where it is noticed now, a flexible one where it can wait', async () => {
    const patch = await call(url, 'PATCH', `/api/v1/admin/clients/${clientId}`, { token: ADMIN_KEY,
      body: { channels: [{ kind: 'chat', reach: 'always' }, { kind: 'messaging', reach: 'always' }, { kind: 'voice', reach: 'presence' }] } });
    expect(patch.status).toBe(204);
    const bad = await call(url, 'PATCH', `/api/v1/admin/clients/${clientId}`, { token: ADMIN_KEY, body: { channels: [{ kind: 'chat', reach: 'always' }, { kind: 'chat', reach: 'presence' }] } });
    expect(bad.status).toBe(400);
    const timed = await request(marco, 'prendere la medicina', { timed: true });
    const flexible = await request(marco, 'Hai sentito Luca?', { kind: 'followup' });
    const owed = await request(marco, 'sentire Luca');
    expect(await row(timed)).toMatchObject({ timing: 'timed', channel: 'messaging' });
    // Messaging interrupts: only what was asked or promised goes there (§5b); an ask waits in the chat.
    expect(await row(flexible)).toMatchObject({ timing: 'flexible', channel: 'chat' });
    expect(await row(owed)).toMatchObject({ timing: 'flexible', channel: 'messaging' });
    expect((await db.query(`SELECT channels FROM initiatives WHERE id = $1`, [flexible]))[0].channels).toEqual(['voice', 'chat']);
    expect((await call(url, 'PATCH', `/api/v1/admin/clients/${clientId}`, { token: ADMIN_KEY, body: { rawLogScope: 'all' } })).status).toBe(204);
    const listed = (await call(url, 'GET', '/api/v1/admin/clients', { token: ADMIN_KEY })).body.find((c: { id: string }) => c.id === clientId);
    expect(listed.channels).toHaveLength(3);
    expect(listed.rawLogScope).toBe('all');
    // The console shows each client's webhooks — never their secret.
    expect(listed.webhooks.map((w: { url: string; events: string[] | null }) => [w.url.replace(/:\d+/, ':P'), w.events]))
      .toEqual([['http://127.0.0.1:P/all', null], ['http://127.0.0.1:P/created', ['initiative.created']]]);
    expect(JSON.stringify(listed.webhooks)).not.toContain('whsec_');
    expect(pickChannel([{ kind: 'voice', reach: 'presence' }], ['voice', 'messaging', 'chat'])).toBeNull();
    expect((await feed('marco')).find((i) => i.id === timed)).toMatchObject({ timing: 'timed', channel: 'messaging' });
  });

  it('the presence of someone who left ends it; no person in a personal memory is its holder', async () => {
    const left = await presence('casa', { channel: 'camera', left: true, person: { identity: { channel: 'voice', externalId: 'eriona-voiceprint' } } });
    expect(left.body).toEqual({ person: { personId: eriona, name: 'Eriona' }, people: [{ personId: eriona, name: 'Eriona' }], initiative: null, askWho: null, opening: null });
    const [open] = await db.query(`SELECT count(*)::int AS n FROM presences WHERE person_id = $1 AND expires_at > $2`, [eriona, NOW]);
    expect(open.n).toBe(0);
    const holder = await presence('marco', { channel: 'panel' });
    expect(holder.body.person).toEqual({ personId: marco, name: 'Marco' });
  });

  describe('presence and voice (§5c): places, arrivals, the pace, the quiet hours, the opening, the clock', () => {
    const T = (h: number) => new Date(NOW.getTime() + h * HOUR);
    const voice = (user: string, h: number, body: object) => call(url, 'POST', '/api/v1/presence', { ...as(user, { 'x-recordare-now': T(h).toISOString() }), body });
    const eri = { identity: { channel: 'voice', externalId: 'eriona-voiceprint' } };
    let leo: string;
    /** A pending initiative for a person, due at hour h, kept a day. */
    async function due(memoryId: string, content: string, h: number, opts: { for?: string; kind?: string; timed?: boolean } = {}): Promise<string> {
      await db.query(`UPDATE initiatives SET status = 'expired' WHERE memory_id = $1 AND status IN ('pending', 'offered')`, [memoryId]);
      await db.query(`INSERT INTO intents (memory_id, kind, content, for_person_id, due_at, expires_at, timed) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [memoryId, opts.kind ?? 'followup', content, opts.for ?? null, T(h), T(h + 24), opts.timed ?? false]);
      await app.get(InitiativeService).sweep(memoryId, T(h));
      return (await db.query(`SELECT id FROM initiatives WHERE text LIKE '%' || $1 || '%' ORDER BY created_at DESC LIMIT 1`, [content]))[0].id as string;
    }

    beforeAll(async () => {
      await ingest('casa', 'leo-chat', [{ externalId: 'l1', role: 'other', authorRef: 'leo', content: 'Ciao!', sentAt: '2026-10-12T08:00:00Z' }],
        [{ ref: 'leo', role: 'other', displayName: 'Leo', identity: { channel: 'homeassistant', externalId: 'person.leo' } }]);
      leo = (await db.query(`SELECT id FROM persons WHERE memory_id = $1 AND display_name = 'Leo'`, [home]))[0].id;
    });

    it('with others in the room only the opening is said; the initiative waits, and the pace holds the next one', async () => {
      const id = await due(home, 'Hai steso i panni?', 30, { for: eriona });
      const crowd = await voice('casa', 30, { channel: 'camera', place: 'kitchen', people: [{ ...eri, confidence: 0.9 }, { identity: { channel: 'homeassistant', externalId: 'person.leo' }, confidence: 0.9 }] });
      expect(crowd.body).toMatchObject({ person: { personId: eriona }, initiative: { id, status: 'pending' }, opening: 'Eriona, ho una cosa per te: vuoi sentirla?' });
      expect(crowd.body.people.map((p: { name: string }) => p.name)).toEqual(['Eriona', 'Leo']);
      expect(await row(id)).toMatchObject({ status: 'pending' });
      // Someone unknown counts as another person too.
      await db.query(`UPDATE initiatives SET opened_at = NULL WHERE id = $1`, [id]);
      const someone = await voice('casa', 31, { channel: 'voice', place: 'hall', people: [{ ...eri, confidence: 0.9 }], someone: 1 });
      expect(someone.body.opening).toContain('Eriona');
      // Alone ten minutes later, in another room: an arrival, but within the pace of the opening — nothing.
      const soon = await voice('casa', 31.2, { channel: 'voice', place: 'bathroom', person: eri, confidence: 0.9 });
      expect(soon.body.initiative).toBeNull();
      // Past the pace, alone, arriving in the living room: given.
      const alone = await voice('casa', 32, { channel: 'voice', place: 'living room', person: eri, confidence: 0.9 });
      expect(alone.body).toMatchObject({ initiative: { id, status: 'offered', channel: 'voice' }, opening: null });
    });

    it('a refresh is not an arrival; at home is not enough to speak; the quiet hours hold all but a timed request', async () => {
      await call(url, 'PATCH', `/api/v1/admin/clients/${clientId}`, { token: ADMIN_KEY, body: { channels: [] } }); // nothing the clock could push on
      const id = await due(home, 'Hai ritirato il pacco?', 40, { for: leo });
      const leoId = { identity: { channel: 'homeassistant', externalId: 'person.leo' } };
      expect((await voice('casa', 40, { channel: 'home', person: leoId })).body.initiative).toBeNull();
      expect(await db.query(`SELECT channel FROM presences WHERE person_id = $1 AND channel = 'home'`, [leo])).toHaveLength(1);
      // In the kitchen already (a presence still live): the next impulse is a refresh.
      await db.query(`INSERT INTO presences (memory_id, person_id, channel, confidence, place, seen_at, expires_at) VALUES ($1, $2, 'camera', 0.9, 'kitchen', $3, $4)`,
        [home, leo, T(39.9), T(40.5)]);
      expect((await voice('casa', 40, { channel: 'camera', place: 'kitchen', person: leoId })).body.initiative).toBeNull();
      expect(await row(id)).toMatchObject({ status: 'pending' });
      // At night (Rome 23:00) an arrival gets nothing spontaneous …
      const night = 61; // 2026-10-14 23:00 Rome
      const nightId = await due(home, 'Hai chiamato la nonna?', night, { for: leo });
      expect((await voice('casa', night, { channel: 'voice', place: 'bedroom', person: leoId })).body.initiative).toBeNull();
      // … but a timed request he made is his: given.
      const timed = await due(home, 'chiudere il gas', night + 0.1, { for: leo, kind: 'request', timed: true });
      expect((await voice('casa', night + 0.2, { channel: 'voice', place: 'hall', person: leoId })).body.initiative).toMatchObject({ id: timed, status: 'offered' });
      expect(await row(nightId)).toMatchObject({ status: 'expired' }); // the timed one's set-up expired it: nothing else was given
    });

    it('the clock: a timed request whose person is live in a room goes by voice; in an entity memory, by messaging only to an address of theirs', async () => {
      await call(url, 'PATCH', `/api/v1/admin/clients/${clientId}`, { token: ADMIN_KEY,
        body: { channels: [{ kind: 'chat', reach: 'always' }, { kind: 'messaging', reach: 'always' }, { kind: 'voice', reach: 'presence' }] } });
      const leoId = { identity: { channel: 'homeassistant', externalId: 'person.leo' } };
      const timed = await due(home, 'prendere le chiavi', 80, { for: leo, kind: 'request', timed: true });
      // Not live anywhere, and his Home Assistant person recognises him but is no address for a message: it waits.
      await app.get(InitiativeService).sweep(home, T(80));
      expect(await row(timed)).toMatchObject({ status: 'pending' });
      // With a Telegram chat on his card: pushed by messaging, to that address.
      expect((await call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY,
        body: { kind: 'participant', memoryId: home, personId: leo, channel: 'telegram', externalId: '4242003', verified: true } })).status).toBe(201);
      await app.get(InitiativeService).sweep(home, T(80));
      expect(await row(timed)).toMatchObject({ status: 'offered', channel: 'messaging' });
      // Live in the kitchen: by voice.
      await voice('casa', 81.9, { channel: 'camera', place: 'kitchen', person: leoId, ttlSeconds: 600 });
      const next = await due(home, 'spegnere il forno', 82, { for: leo, kind: 'request', timed: true });
      expect(await row(next)).toMatchObject({ status: 'offered', channel: 'voice' });
      // A flexible ask is never pushed by messaging, address or not: it waits for a presence or a turn.
      const ask = await due(home, 'Hai finito il libro?', 84, { for: leo });
      await app.get(InitiativeService).sweep(home, T(84));
      expect(await row(ask)).toMatchObject({ status: 'pending' });
      await call(url, 'PATCH', `/api/v1/admin/clients/${clientId}`, { token: ADMIN_KEY, body: { channels: [] } });
    });
  });
});

