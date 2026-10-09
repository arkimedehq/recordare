// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Memory identity (D50, WORK_PLAN 8.3): message attribution at ingest in both modes, the own marker, participant
 * identities scoped to one memory (never opening one), mode / gender, the subject of what the writer stores, and the
 * clarifications table (no behaviour yet).
 */
import { type INestApplication } from '@nestjs/common';
import { type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { Clarification } from '../../src/identity/identity.entities';
import { EXTRACTION_RUNNER, type ExtractionRunner } from '../../src/queue/queue.port';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, startFakeLlm, testEnv } from '../helpers/app';

describe('memory identity (D50)', () => {
  let app: INestApplication;
  let url: string;
  let db: DataSource;
  let llm: Awaited<ReturnType<typeof startFakeLlm>>;
  let emb: Server;
  let key: string;
  let clientId: string;
  let personal: string;
  let entity: string;

  beforeAll(async () => {
    llm = await startFakeLlm();
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    testEnv({ EMBEDDING_BASE_URL: fake.url, LLM_BASE_URL: llm.url, IDLE_DELAY_SECONDS: '3600' });
    await resetSchema();
    ({ app, url } = await startApp());
    db = app.get(DataSource);
    clientId = (await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'Platform', kind: 'platform' } })).body.id;
    key = (await call(url, 'POST', `/api/v1/admin/clients/${clientId}/keys`, { token: ADMIN_KEY, body: { scopes: ['ingest', 'read'] } })).body.key;
    personal = await memory('andrea', 'Andrea');
    entity = await memory('casa', 'Casa', 'entity');
  });
  afterAll(async () => { await app?.close(); llm?.server.close(); emb?.close(); });

  async function memory(user: string, name: string, mode?: 'entity'): Promise<string> {
    const id = (await call(url, 'POST', '/api/v1/admin/owners', { token: ADMIN_KEY, body: { displayName: name, ...(mode ? { mode } : {}) } })).body.personId;
    await call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY, body: { kind: 'account', personId: id, clientId, externalId: user } });
    return id;
  }
  const at = (n: number) => `2026-06-07T10:0${n}:00+02:00`;
  const ingest = (user: string, body: object) => call(url, 'POST', '/api/v1/ingest/messages', { token: key, headers: { 'x-recordare-user': user }, body });
  const authors = (conversation: string) => db.query(
    `SELECT m.external_id AS id, m.author_kind AS kind, m.author_person_id AS person, m.attribution_method AS method, m.attribution_confidence AS confidence
     FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.external_id = $1 ORDER BY m.external_id`, [conversation]);

  it('attributes every message of a personal memory: self, agent, tool, someone, contact, own', async () => {
    const res = await ingest('andrea', {
      conversation: { externalId: 'p1', participants: [
        { ref: 'assistant', role: 'assistant', displayName: 'Arkimede' },
        { ref: 'user:giulia', role: 'other', displayName: 'Giulia', identity: { externalUserId: 'giulia' } },
        { ref: 'me-again', role: 'other', displayName: 'Andrea', identity: { externalUserId: 'andrea' } },
        { ref: 'guest', role: 'other', displayName: 'Ospite' },
      ] },
      messages: [
        { externalId: 'm1', role: 'user', content: 'Domani vado a Torino.', sentAt: at(1) },
        { externalId: 'm2', role: 'assistant', authorRef: 'assistant', content: 'Buon viaggio!', sentAt: at(2) },
        { externalId: 'm3', role: 'tool', toolName: 'weather', authorRef: 'assistant', content: 'sole', sentAt: at(3) },
        { externalId: 'm4', role: 'other', authorRef: 'guest', content: 'Ciao!', sentAt: at(4) },
        { externalId: 'm5', role: 'other', authorRef: 'user:giulia', content: 'Vengo anche io.', sentAt: at(5) },
        { externalId: 'm6', role: 'other', authorRef: 'me-again', content: 'Sono sempre io.', sentAt: at(6) },
        { externalId: 'm7', role: 'user', own: true, content: 'Il codice del cancello è 1234.', sentAt: at(7) },
      ],
    });
    expect(res.status).toBe(200);
    const [giulia] = await db.query(`SELECT id, owner_scope FROM persons WHERE display_name = 'Giulia'`);
    expect(giulia.owner_scope).toBe(personal); // a contact of this memory, created on first sight
    expect(await authors('p1')).toEqual([
      { id: 'm1', kind: 'self', person: personal, method: 'account', confidence: 1 },
      { id: 'm2', kind: 'agent', person: null, method: 'client_assertion', confidence: 1 },
      { id: 'm3', kind: 'tool', person: null, method: 'client_assertion', confidence: 1 },
      { id: 'm4', kind: 'someone', person: null, method: 'none', confidence: null },
      { id: 'm5', kind: 'contact', person: giulia.id, method: 'client_assertion', confidence: 1 },
      { id: 'm6', kind: 'self', person: personal, method: 'account', confidence: 1 }, // the account's own user id: the self
      { id: 'm7', kind: 'own', person: null, method: 'client_assertion', confidence: 1 },
    ]);
    // The own marker belongs to user / other turns only.
    expect((await ingest('andrea', { conversation: { externalId: 'p2' },
      messages: [{ externalId: 'x', role: 'assistant', own: true, content: 'x', sentAt: at(1) }] })).status).toBe(400);
  });

  it('attributes the messages of an entity memory: someone unless identified, own when marked; new sources accepted', async () => {
    const res = await ingest('casa', {
      conversation: { externalId: 'e1', source: 'ambient', participants: [
        { ref: 'owner', role: 'owner', displayName: 'Casa' },
        { ref: 'user:andrea', role: 'other', displayName: 'Andrea', identity: { externalUserId: 'andrea' } },
      ] },
      messages: [
        { externalId: 'm1', role: 'user', content: 'Chi ha lasciato la luce accesa?', sentAt: at(1) },
        { externalId: 'm2', role: 'user', authorRef: 'owner', content: 'Io no.', sentAt: at(2) },
        { externalId: 'm3', role: 'other', authorRef: 'user:andrea', content: 'Sono stato io.', sentAt: at(3) },
        { externalId: 'm4', role: 'other', own: true, content: 'Temperatura in sala: 21 gradi.', sentAt: at(4) },
      ],
    });
    expect(res.status).toBe(200);
    // Andrea has a memory of his own, and in this one he is a contact: two unrelated rows.
    const [andrea] = await db.query(`SELECT id FROM persons WHERE owner_scope = $1 AND display_name = 'Andrea'`, [entity]);
    expect(andrea.id).not.toBe(personal);
    expect(await authors('e1')).toEqual([
      { id: 'm1', kind: 'someone', person: null, method: 'none', confidence: null },
      { id: 'm2', kind: 'someone', person: null, method: 'none', confidence: null },
      { id: 'm3', kind: 'contact', person: andrea.id, method: 'client_assertion', confidence: 1 },
      { id: 'm4', kind: 'own', person: null, method: 'client_assertion', confidence: 1 },
    ]);
    expect(await db.query(`SELECT source FROM conversations WHERE external_id = 'e1'`)).toEqual([{ source: 'ambient' }]);
    // Same client user id seen again: the same contact (participant identity scoped to this memory).
    await ingest('casa', { conversation: { externalId: 'e2', participants: [{ ref: 'a', role: 'other', displayName: 'Andrea', identity: { externalUserId: 'andrea' } }] },
      messages: [{ externalId: 'n1', role: 'other', authorRef: 'a', content: 'Ancora io.', sentAt: at(5) }] });
    expect((await authors('e2'))[0]).toMatchObject({ kind: 'contact', person: andrea.id });
    expect(await db.query(`SELECT count(*)::int AS n FROM persons WHERE owner_scope = $1`, [entity])).toEqual([{ n: 1 }]);
  });

  it('labels speakers: "me" for the self (personal) and the agent\'s own turns, contacts by name with their C-number, "someone" for whoever talks to an entity', async () => {
    const run = async (user: string, conversation: string, messages: object[], participants: object[] = []) => {
      const res = await ingest(user, { conversation: { externalId: conversation, participants }, messages });
      llm.queue.push({});
      await app.get<ExtractionRunner>(EXTRACTION_RUNNER).runForConversation(res.body.conversationId as string);
      return (llm.requests as unknown as Array<{ messages: Array<{ content: string }> }>).at(-1)?.messages[1]?.content ?? '';
    };
    const personalPrompt = await run('andrea', 'l1', [
      { externalId: 'a', role: 'user', content: 'Oggi corsa al parco.', sentAt: at(1) },
      { externalId: 'b', role: 'other', authorRef: 'g', content: 'Brava!', sentAt: at(2) },
    ], [{ ref: 'g', role: 'other', displayName: 'Giulia', identity: { externalUserId: 'giulia' } }]);
    expect(personalPrompt).toContain(' me: Oggi corsa al parco.');
    expect(personalPrompt).toMatch(/ Giulia \[C\d+\]: Brava!/);
    expect(personalPrompt).toMatch(/PEOPLE I KNOW:\nC\d+: Giulia/);
    // An identified contact sent as `user` with its authorRef (connectors after 8.4) is that contact, not "me".
    const asUser = await run('andrea', 'l1b', [
      { externalId: 'a', role: 'user', authorRef: 'g', content: 'Sono arrivata.', sentAt: at(3) },
    ], [{ ref: 'g', role: 'other', displayName: 'Giulia', identity: { externalUserId: 'giulia' } }]);
    expect(asUser).toMatch(/ Giulia \[C\d+\]: Sono arrivata\./);
    const entityPrompt = await run('casa', 'l2', [
      { externalId: 'a', role: 'user', authorRef: 'owner', content: 'Ho comprato il pane.', sentAt: at(1) },
    ], [{ ref: 'owner', role: 'owner' }]);
    expect(entityPrompt).toContain(' someone: Ho comprato il pane.');
    expect(entityPrompt).toMatch(/^ME: Casa — gender masculine/);
  });

  it('opens a memory only through an account identity; a participant identity names a contact of one memory', async () => {
    const contactId = (await db.query(`SELECT id FROM persons WHERE owner_scope = $1 LIMIT 1`, [entity]))[0].id as string;
    const link = (body: object) => call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY, body });
    // A participant identity: the client's id 'zoe' names Andrea inside the entity memory.
    expect((await link({ kind: 'participant', ownerScope: entity, personId: contactId, clientId, externalId: 'zoe' })).status).toBe(201);
    // …but never opens a memory.
    expect((await call(url, 'GET', '/api/v1/me', { token: key, headers: { 'x-recordare-user': 'zoe' } })).status).toBe(404);
    // An account must be a memory; a participant must belong to the memory it is scoped to.
    expect(await link({ kind: 'account', personId: contactId, clientId, externalId: 'zoe2' })).toMatchObject({ status: 400, body: { code: 'cannot_link' } });
    expect(await link({ kind: 'participant', ownerScope: personal, personId: contactId, clientId, externalId: 'zoe3' }))
      .toMatchObject({ status: 400, body: { code: 'cannot_link' } });
    expect((await link({ kind: 'participant', ownerScope: personal, personId: personal, channel: 'telegram', externalId: '42', verified: true })).status).toBe(201);
    expect((await link({ kind: 'participant', ownerScope: entity, personId: contactId, externalId: 'x' })).status).toBe(400); // client id or channel
    expect((await link({ kind: 'participant', ownerScope: entity, personId: contactId, clientId, channel: 'tg', externalId: 'x' })).status).toBe(400);
    // The memory's own channel id identifies its self.
    await ingest('andrea', { conversation: { externalId: 'tg', participants: [{ ref: 't', role: 'other', identity: { channel: 'telegram', externalId: '42' } }] },
      messages: [{ externalId: 't1', role: 'other', authorRef: 't', content: 'Dal telefono.', sentAt: at(1) }] });
    expect((await authors('tg'))[0]).toMatchObject({ kind: 'self', person: personal });

    const listed = (await call(url, 'GET', '/api/v1/admin/persons', { token: ADMIN_KEY })).body as Array<{ id: string; contacts: number; identities: Array<{ kind: string }> }>;
    const casa = listed.find((p) => p.id === entity);
    expect(casa).toMatchObject({ mode: 'entity', gender: 'masculine', contacts: 1 });
    expect(casa?.identities.map((i) => i.kind).sort()).toEqual(['account', 'participant', 'participant']);
  });

  it('stores whose each memory is: the self in a personal memory; a contact, someone or the agent itself in an entity memory (8.5)', async () => {
    const extract = async (user: string, conversation: string, content: string, out: object) => {
      const res = await ingest(user, { conversation: { externalId: conversation }, messages: [{ externalId: `${conversation}-1`, role: 'user', content, sentAt: at(1) }] });
      llm.queue.push(out);
      await app.get<ExtractionRunner>(EXTRACTION_RUNNER).runForConversation(res.body.conversationId as string);
    };
    await extract('andrea', 's1', 'Ieri cena da Marta, ho una Golf e amo il jazz.', {
      episodes: [{ content: 'Andrea ha cenato da Marta.', people: ['Marta'], evidence: [1] }],
      facts: [{ key: 'car', value: 'VW Golf', verdict: 'new', evidence: [1] }],
      notes: [{ category: 'preference', content: 'Ad Andrea piace il jazz.', verdict: 'new', evidence: [1] }],
    });
    const subjects = (owner: string) => db.query(
      `SELECT 'episode' AS t, subject_kind, subject_person_id FROM episodes WHERE owner_id = $1
       UNION ALL SELECT 'fact', subject_kind, subject_person_id FROM facts WHERE owner_id = $1
       UNION ALL SELECT 'note', subject_kind, subject_person_id FROM notes WHERE owner_id = $1 ORDER BY 1, 2`, [owner]);
    expect(await subjects(personal)).toEqual([
      { t: 'episode', subject_kind: 'self', subject_person_id: null },
      { t: 'fact', subject_kind: 'self', subject_person_id: null },
      { t: 'note', subject_kind: 'self', subject_person_id: null },
    ]);

    const [andrea] = await db.query(`SELECT id FROM persons WHERE owner_scope = $1 AND display_name = 'Andrea'`, [entity]);
    await extract('casa', 's2', 'Sono Andrea: oggi ho visto Luca, ho una Panda e le chiavi sono nel cassetto. Qualcuno ha rotto un bicchiere.', {
      episodes: [{ content: 'Andrea ha visto Luca.', subject: 'Andrea', people: ['Luca'], evidence: [1] },
        { content: 'Andrea è passato in casa.', subject: 'Andrea (papà)', evidence: [1] },
        { content: 'Qualcuno in casa ha rotto un bicchiere.', evidence: [1] }],
      facts: [{ key: 'car', value: 'Fiat Panda', verdict: 'new', subject: 'Andrea', evidence: [1] },
        { key: 'spare_keys_location', value: 'cassetto', verdict: 'new', subject: null, evidence: [1] }],
      notes: [{ subject: 'me', category: 'knowledge', content: 'Le chiavi di scorta le tengo nel cassetto.', verdict: 'new', evidence: [1] },
        { category: 'preference', content: 'Ama il jazz.', verdict: 'new', evidence: [1] }],
    });
    const rows: Array<{ content: string }> = await db.query(
      `SELECT content, subject_kind, subject_person_id FROM episodes WHERE owner_id = $1`, [entity]);
    expect(rows.sort((x, y) => x.content.length - y.content.length)).toEqual([
      { content: 'Andrea ha visto Luca.', subject_kind: 'contact', subject_person_id: andrea.id },
      { content: 'Andrea è passato in casa.', subject_kind: 'contact', subject_person_id: andrea.id },
      // No subject in an entity memory: someone's — the people talking to the agent are never "me".
      { content: 'Qualcuno in casa ha rotto un bicchiere.', subject_kind: 'someone', subject_person_id: null },
    ]);
    const [luca] = await db.query(`SELECT id FROM persons WHERE owner_scope = $1 AND display_name = 'Luca'`, [entity]);
    expect(await db.query(`SELECT alias, person_id FROM episode_people ep JOIN episodes e ON e.id = ep.episode_id
      WHERE e.owner_id = $1 ORDER BY alias`, [entity])).toEqual([{ alias: 'Luca', person_id: luca.id }]);
    expect(await db.query(`SELECT key, subject_kind, subject_person_id FROM facts WHERE owner_id = $1 ORDER BY key`, [entity])).toEqual([
      { key: 'car', subject_kind: 'contact', subject_person_id: andrea.id },
      { key: 'spare_keys_location', subject_kind: 'self', subject_person_id: null }, // the agent's own (its place)
    ]);
    // The agent's own note is kept; someone's note is not (whose it is is unknown).
    expect(await db.query(`SELECT subject_kind FROM notes WHERE owner_id = $1`, [entity])).toEqual([{ subject_kind: 'self' }]);
  });

  it('creates a memory with its mode and gender, and changes them through the admin API and PATCH /me', async () => {
    const created = await call(url, 'POST', '/api/v1/admin/owners', { token: ADMIN_KEY, body: { displayName: 'Robot', mode: 'entity', gender: 'neutral' } });
    expect(created.body).toMatchObject({ mode: 'entity', gender: 'neutral' });
    expect((await call(url, 'POST', '/api/v1/admin/owners', { token: ADMIN_KEY, body: { displayName: 'X', gender: 'plural' } })).status).toBe(400);
    const me = () => call(url, 'GET', '/api/v1/me', { token: key, headers: { 'x-recordare-user': 'andrea' } });
    expect((await me()).body).toMatchObject({ ownerId: personal, mode: 'personal', gender: 'masculine' });
    expect((await call(url, 'PATCH', '/api/v1/me', { token: key, headers: { 'x-recordare-user': 'andrea' }, body: { gender: 'feminine' } })).status).toBe(204);
    expect((await call(url, 'PATCH', '/api/v1/me', { token: key, headers: { 'x-recordare-user': 'andrea' }, body: { mode: 'entity' } })).status).toBe(409);
    expect((await me()).body).toMatchObject({ mode: 'personal', gender: 'feminine' });
    expect((await me()).body).not.toHaveProperty('kind');
  });

  it('keeps clarifications (no behaviour yet): written, read, resolved, gone with the memory they concern', async () => {
    const [episode] = await db.query(`SELECT id FROM episodes WHERE owner_id = $1 LIMIT 1`, [entity]);
    const candidates = (await db.query(`SELECT id FROM persons WHERE owner_scope = $1`, [entity])).map((r: { id: string }) => r.id);
    const repo = db.getRepository(Clarification);
    const saved = await repo.save({ ownerId: entity, question: 'Quale Andrea?', candidates, episodeId: episode.id });
    expect(await repo.findOneByOrFail({ id: saved.id })).toMatchObject({ status: 'open', candidates, episodeId: episode.id, resolvedAt: null });
    await repo.update(saved.id, { status: 'resolved', resolution: 'il papà', resolvedPersonId: candidates[0], resolvedAt: new Date() });
    expect(await repo.findOneByOrFail({ id: saved.id })).toMatchObject({ status: 'resolved', resolution: 'il papà', resolvedPersonId: candidates[0] });
    // One item at most; an open question has no resolution time.
    await expect(db.query(`INSERT INTO clarifications (owner_id, question, episode_id, note_id) SELECT $1, 'x', $2, id FROM notes LIMIT 1`, [entity, episode.id]))
      .rejects.toThrow();
    await expect(db.query(`INSERT INTO clarifications (owner_id, question, resolved_at) VALUES ($1, 'x', now())`, [entity])).rejects.toThrow();
    await db.query(`DELETE FROM episodes WHERE id = $1`, [episode.id]);
    expect(await repo.findOneBy({ id: saved.id })).toBeNull();
  });

  it('refuses a human that is neither a memory nor a contact of one', async () => {
    await expect(db.query(`INSERT INTO persons (display_name) VALUES ('nessuno')`)).rejects.toThrow(/owner_scope is required/);
  });
});
