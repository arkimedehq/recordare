// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Learning by asking (D55 F2b step 4, `docs/INITIATIVES_DELIVERY.md` §6): a question the memory holds goes to whoever
 * could answer — the agent's tools for the world, the person it is about when they talk to me, else whoever told me most
 * about them; nobody identified to ask, nothing asked; one question at a time for each person; a question about someone
 * asked to another person needs a sure recognition.
 */
import { type INestApplication } from '@nestjs/common';
import { type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { InitiativeService } from '../../src/initiative/initiative.service';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, testEnv } from '../helpers/app';

const NOW = new Date('2026-10-12T10:00:00Z');

describe('learning by asking: whom a question goes to', () => {
  let app: INestApplication;
  let url: string;
  let emb: Server;
  let db: DataSource;
  let key: string;
  let sara: string;
  let casa: string;
  const person = async (memoryId: string, name: string) => (await db.query(`SELECT id FROM persons WHERE memory_id = $1 AND display_name = $2`, [memoryId, name]))[0].id as string;
  async function ingest(user: string, conversation: string, messages: object[], participants: object[] = []): Promise<void> {
    await call(url, 'POST', '/api/v1/ingest/messages', { token: key, headers: { 'x-recordare-user': user }, body: { conversation: { externalId: conversation, participants }, messages } });
  }
  /** An episode about `subject`, told by the message `externalId`. */
  async function told(memoryId: string, subject: string, content: string, externalId: string): Promise<void> {
    const [e] = await db.query(
      `INSERT INTO episodes (memory_id, kind, content, origin, author_role, stance, audience, occurred_at, date_precision, subject_kind, subject_person_id)
       VALUES ($1, 'event', $2, 'holder_told', 'holder', 'stated', ARRAY[$1::uuid], '2026-10-05', 'day', 'contact', $3) RETURNING id`, [memoryId, content, subject]);
    await db.query(`INSERT INTO episode_evidence (episode_id, message_id) SELECT $1, id FROM messages WHERE external_id = $2`, [e.id, externalId]);
  }
  async function question(memoryId: string, content: string, subject: string | null): Promise<void> {
    await db.query(
      `INSERT INTO notes (memory_id, category, content, tags, origin, author_role, stance, confidence, disclosure, audience, subject_kind, subject_person_id)
       VALUES ($1, 'question', $2, '{thought}', 'reflected', 'holder', 'inferred', 0.6, 'holder', ARRAY[$1::uuid], $3, $4)`,
      [memoryId, content, subject ? 'contact' : 'self', subject]);
  }
  const intentOf = async (content: string) => (await db.query(
    `SELECT t.kind::text, t.for_person_id, i.kind::text AS initiative, i.identity_required, i.reason FROM intents t LEFT JOIN initiatives i ON i.intent_id = t.id WHERE t.content = $1`, [content]))[0];

  beforeAll(async () => {
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    testEnv({ EMBEDDING_BASE_URL: fake.url, CONSOLIDATION_SCHEDULE: 'false', INITIATIVE_WORDING: 'false', IDLE_DELAY_SECONDS: '3600', INITIATIVE_DAILY_LIMIT: '20' });
    await resetSchema();
    ({ app, url } = await startApp());
    db = app.get(DataSource);
    const clientId = (await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'A', kind: 'platform' } })).body.id;
    key = (await call(url, 'POST', `/api/v1/admin/clients/${clientId}/keys`, { token: ADMIN_KEY, body: { scopes: ['ingest', 'read'] } })).body.key;
    sara = (await call(url, 'POST', '/api/v1/admin/memories', { token: ADMIN_KEY, body: { displayName: 'Sara' } })).body.personId;
    casa = (await call(url, 'POST', '/api/v1/admin/memories', { token: ADMIN_KEY, body: { displayName: 'Casa Neri', mode: 'entity' } })).body.personId;
    for (const [personId, externalId] of [[sara, 'sara'], [casa, 'casa']]) {
      await call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY, body: { kind: 'account', personId, clientId, externalId } });
    }
    // Sara tells me about her brother Luca, who never writes to me.
    await ingest('sara', 's-chat', [{ externalId: 's1', role: 'user', content: 'Mio fratello Luca ha fatto il colloquio a Torino.', sentAt: '2026-10-05T10:00:00+02:00' }]);
    await db.query(`INSERT INTO persons (memory_id, display_name) VALUES ($1, 'Luca')`, [sara]);
    // In the shared home Paolo (identified) tells me about his daughter Giada; Marta talks to me herself; someone unknown mentions Ugo.
    const who = [{ ref: 'paolo', role: 'other', displayName: 'Paolo', identity: { channel: 'voice', externalId: 'paolo' } },
      { ref: 'marta', role: 'other', displayName: 'Marta', identity: { channel: 'voice', externalId: 'marta' } }];
    await ingest('casa', 'kitchen', [
      { externalId: 'p1', role: 'other', authorRef: 'paolo', content: 'Giada ha fatto la gara di nuoto sabato.', sentAt: '2026-10-05T18:00:00+02:00' },
      { externalId: 'm1', role: 'other', authorRef: 'marta', content: 'Ho cominciato una dieta nuova.', sentAt: '2026-10-06T18:00:00+02:00' },
      { externalId: 'x1', role: 'user', content: 'Ugo ha cambiato macchina.', sentAt: '2026-10-07T18:00:00+02:00' },
    ], who);
    await db.query(`INSERT INTO persons (memory_id, display_name) VALUES ($1, 'Giada'), ($1, 'Ugo')`, [casa]);
    await told(sara, await person(sara, 'Luca'), 'Luca ha fatto il colloquio a Torino', 's1');
    await told(casa, await person(casa, 'Giada'), 'Giada ha fatto la gara di nuoto', 'p1');
    await told(casa, await person(casa, 'Marta'), 'Marta ha cominciato una dieta', 'm1');
    await told(casa, await person(casa, 'Ugo'), 'Ugo ha cambiato macchina', 'x1');
  });
  afterAll(async () => { await app?.close(); emb?.close(); });

  it('the world to the tools, a person to who could know, nobody identified to nobody — one question at a time each', async () => {
    await question(sara, 'Com\'è andato il colloquio di Luca a Torino?', await person(sara, 'Luca'));
    await question(sara, 'Il negozio di bici di via Roma ha chiuso?', null);
    await question(casa, 'Com\'è andata la gara di nuoto di Giada?', await person(casa, 'Giada'));
    await question(casa, 'Giada ha vinto una medaglia?', await person(casa, 'Giada'));
    await question(casa, 'Come va la dieta di Marta?', await person(casa, 'Marta'));
    await question(casa, 'Che macchina ha preso Ugo?', await person(casa, 'Ugo'));
    for (const m of [sara, casa]) await app.get(InitiativeService).sweep(m, NOW);

    // Personal memory: Luca never talks to me, Sara told me — asked to the holder, a sure enough question.
    expect(await intentOf('Com\'è andato il colloquio di Luca a Torino?')).toMatchObject({ kind: 'own', for_person_id: null, initiative: 'ask', identity_required: 'medium',
      reason: 'a question I hold, for someone who could know' });
    // The world: the agent's tools, as before.
    expect(await intentOf('Il negozio di bici di via Roma ha chiuso?')).toMatchObject({ kind: 'lookup', initiative: 'lookup' });
    // Entity memory: about Giada, asked to Paolo (who told me) — it tells Paolo what I know of her: a sure recognition.
    const paolo = await person(casa, 'Paolo');
    expect(await intentOf('Com\'è andata la gara di nuoto di Giada?')).toMatchObject({ kind: 'own', for_person_id: paolo, identity_required: 'high' });
    // …and the second question for Paolo waits for the first (one at a time).
    expect(await intentOf('Giada ha vinto una medaglia?')).toBeUndefined();
    // Marta talks to me: asked to her, about her.
    expect(await intentOf('Come va la dieta di Marta?')).toMatchObject({ kind: 'own', for_person_id: await person(casa, 'Marta'), identity_required: 'medium' });
    // Only someone unidentified spoke of Ugo: nobody to ask.
    expect(await intentOf('Che macchina ha preso Ugo?')).toBeUndefined();

    // The first answered, the next one for Paolo is armed.
    await db.query(`UPDATE intents SET status = 'done' WHERE content = 'Com''è andata la gara di nuoto di Giada?'`);
    await app.get(InitiativeService).sweep(casa, NOW);
    expect(await intentOf('Giada ha vinto una medaglia?')).toMatchObject({ kind: 'own', for_person_id: paolo });
  });
});
