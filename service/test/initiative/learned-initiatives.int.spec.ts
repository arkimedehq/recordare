// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Initiatives from learned knowledge and the learning loop (WORK_PLAN 8.16 F3, D57): something read that touches a known
 * life and is still ahead goes to that person with its source and day — asked as unchecked while the memory is young or
 * the source untrusted, told once both hold —; news touching nobody, or already past, says nothing. Something read that
 * contradicts what the memory holds, a failed step of a procedure, knowledge of the place read and pending are asked of
 * the household, one at a time, in that order. A trusted person holding to what the memory had retires the page's version.
 */
import { type INestApplication } from '@nestjs/common';
import { type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { refuteProposals } from '../../src/engine/pending';
import { InitiativeService } from '../../src/initiative/initiative.service';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, testEnv } from '../helpers/app';

const NOW = new Date('2026-11-10T08:00:00Z');
const HOUR = 3_600_000;

describe('initiatives from learned knowledge (8.16 F3)', () => {
  let app: INestApplication;
  let url: string;
  let emb: Server;
  let db: DataSource;
  let key: string;
  let casa: string;
  let matteo: string;
  let sofia: string;
  let n = 0;
  const sweep = (at: Date) => app.get(InitiativeService).sweep(casa, at);
  async function ingest(messages: object[]): Promise<void> {
    const res = await call(url, 'POST', '/api/v1/ingest/messages', { token: key, headers: { 'x-recordare-user': 'casa' }, body: {
      conversation: { externalId: 'kitchen', participants: [{ ref: 'sofia', role: 'other', displayName: 'Sofia', identity: { channel: 'voice', externalId: 'sofia' } },
        { ref: 'matteo', role: 'other', displayName: 'Matteo', identity: { channel: 'voice', externalId: 'matteo' } }] },
      messages } });
    expect(res.status).toBeLessThan(300);
  }
  /** An episode read in a tool's output (origin learned), about Matteo or nobody, `days` ahead of NOW. */
  async function read(content: string, tool: string, page: string | null, days: number, about: string | null): Promise<string> {
    const ext = `t${++n}`;
    await ingest([{ externalId: ext, role: 'tool', toolName: tool, content: page ? `${content} — https://${page}/notizia` : content, sentAt: '2026-11-09T18:00:00+01:00' }]);
    const [e] = await db.query(
      `INSERT INTO episodes (memory_id, kind, content, origin, author_role, stance, audience, occurred_at, date_precision, subject_kind, subject_person_id)
       VALUES ($1, 'event', $2, 'learned', 'tool', 'stated', ARRAY[$1::uuid], $3, 'day', $4, $5) RETURNING id`,
      [casa, content, new Date(NOW.getTime() + days * 24 * HOUR), about ? 'contact' : 'self', about]);
    await db.query(`INSERT INTO episode_evidence (episode_id, message_id) SELECT $1, id FROM messages WHERE external_id = $2`, [e.id, ext]);
    return e.id as string;
  }
  async function note(content: string, opts: { pending: boolean; origin: string; supersedes?: string; site?: string; lasts?: string; recordedAt?: Date }): Promise<string> {
    const [r] = await db.query(
      `INSERT INTO notes (memory_id, category, content, tags, origin, author_role, stance, confidence, disclosure, audience, subject_kind, pending, supersedes, lasts, recorded_at)
       VALUES ($1, 'knowledge', $2, '{}', $3, 'holder', $4, 0.6, 'holder', ARRAY[$1::uuid], 'self', $5, $6, $7, $8) RETURNING id`,
      [casa, content, opts.origin, opts.pending ? 'inferred' : 'stated', opts.pending, opts.supersedes ?? null, opts.lasts ?? null, opts.recordedAt ?? NOW]);
    if (opts.site) {
      const [i] = await db.query(`INSERT INTO informants (memory_id, kind, key, class) VALUES ($1, 'site', $2, 'site')
        ON CONFLICT (memory_id, kind, key) DO UPDATE SET class = 'site' RETURNING id`, [casa, opts.site]);
      await db.query(`INSERT INTO item_informants (memory_id, note_id, informant_id, at) VALUES ($1, $2, $3, $4)`, [casa, r.id, i.id, NOW]);
    }
    return r.id as string;
  }
  const intents = async (kind: string) => db.query(
    `SELECT t.content, t.for_person_id, t.trusted, t.status::text, i.kind::text AS initiative, i.text FROM intents t LEFT JOIN initiatives i ON i.intent_id = t.id
     WHERE t.memory_id = $1 AND t.kind = $2 ORDER BY t.created_at`, [casa, kind]);
  /** The learning question given: answered, a day ago, so the next one may be asked. */
  async function answered(kind: string): Promise<void> {
    await db.query(`UPDATE intents SET status = 'done' WHERE memory_id = $1 AND kind = $2`, [casa, kind]);
    await db.query(`UPDATE initiatives SET status = 'asked', due_at = due_at - interval '1 day' WHERE memory_id = $1`, [casa]);
  }

  beforeAll(async () => {
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    testEnv({ EMBEDDING_BASE_URL: fake.url, CONSOLIDATION_SCHEDULE: 'false', INITIATIVE_WORDING: 'false', IDLE_DELAY_SECONDS: '3600', INITIATIVE_DAILY_LIMIT: '20',
      LEARNING_OWN_TOOLS: '^calendario', LEARNING_STAGE_YOUNG: '3', LEARNING_STAGE_GROWN: '1000' });
    await resetSchema();
    ({ app, url } = await startApp());
    db = app.get(DataSource);
    const clientId = (await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'Robot', kind: 'platform' } })).body.id;
    key = (await call(url, 'POST', `/api/v1/admin/clients/${clientId}/keys`, { token: ADMIN_KEY, body: { scopes: ['ingest', 'read'] } })).body.key;
    casa = (await call(url, 'POST', '/api/v1/admin/memories', { token: ADMIN_KEY, body: { displayName: 'Casa', mode: 'entity', locale: 'it-IT', timezone: 'Europe/Rome' } })).body.personId;
    await call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY, body: { kind: 'account', personId: casa, clientId, externalId: 'casa' } });
    // Sofia speaks as the household (the account's own turn) and talks to me most; Matteo talks to me too.
    await ingest([
      { externalId: 's1', role: 'user', authorRef: 'sofia', content: 'Buongiorno!', sentAt: '2026-11-09T08:00:00+01:00' },
      { externalId: 's2', role: 'user', authorRef: 'sofia', content: 'Oggi pulisco la cucina.', sentAt: '2026-11-09T08:02:00+01:00' },
      { externalId: 'm1', role: 'other', authorRef: 'matteo', content: 'Io domani prendo il bus per la scuola.', sentAt: '2026-11-09T08:01:00+01:00' },
    ]);
    matteo = (await db.query(`SELECT id FROM persons WHERE memory_id = $1 AND display_name = 'Matteo'`, [casa]))[0].id;
    sofia = (await db.query(`SELECT id FROM persons WHERE memory_id = $1 AND display_name = 'Sofia'`, [casa]))[0].id;
  });
  afterAll(async () => { await app?.close(); emb?.close(); });

  it('says what it read touching someone with its source and day — asked while young or untrusted; nothing for news touching nobody or past', async () => {
    await read('Domani sciopero dei bus urbani.', 'web_search', 'sciopero-esempio.it', 1, matteo);
    await read('Domani la palestra della scuola resta chiusa.', 'calendario_scuola', null, 1, matteo);
    await read('Nuovo record di caldo in Australia.', 'web_search', 'meteo-esempio.it', 1, null);
    await read('Ieri il bus 3 ha cambiato percorso.', 'web_search', 'bus-esempio.it', -2, matteo);
    await sweep(NOW);
    const young = await intents('learned');
    expect(young).toHaveLength(2);
    // An untrusted site: asked as unchecked, with the site and the day it was read.
    expect(young[0]).toMatchObject({ for_person_id: matteo, trusted: false, initiative: 'ask' });
    expect(young[0].text).toContain('sciopero-esempio.it');
    expect(young[0].text).toContain('Non l\'ho verificato');
    expect(young[0].text).toMatch(/9 novembre/);
    // The agent's own tool, trusted — but the memory is young: still a question.
    expect(young[1]).toMatchObject({ trusted: false, initiative: 'ask' });

    // Grown past its first stage (three things the household confirmed): the own tool's news is told.
    for (const c of ['Il cancello si apre col telecomando grigio.', 'La spazzatura si porta fuori il martedì.', 'Il gatto si chiama Neve.']) {
      await note(c, { pending: false, origin: 'holder_told' });
    }
    await read('Dopodomani la mensa della scuola è chiusa.', 'calendario_scuola', null, 2, matteo);
    await sweep(new Date(NOW.getTime() + HOUR));
    const grown = (await intents('learned'))[2];
    expect(grown).toMatchObject({ trusted: true, initiative: 'say' });
    expect(grown.text).toContain('uno dei miei strumenti');
    expect(grown.text).not.toContain('verificato');
  });

  it('asks the household, one at a time: a contradiction, then a failed step, then knowledge read to confirm', async () => {
    const had = await note('La farmacia chiude alle 19.', { pending: false, origin: 'holder_told' });
    await note('La farmacia chiude alle 19:30.', { pending: true, origin: 'learned', supersedes: had, site: 'farmacia-esempio.it' });
    await note('Il comune ritira gli ingombranti il primo lunedì del mese.', { pending: true, origin: 'learned', site: 'comune-esempio.it', lasts: 'changing',
      recordedAt: new Date(NOW.getTime() - 48 * HOUR) });
    await note('Oggi il mercato è spostato in piazza.', { pending: true, origin: 'learned', site: 'comune-esempio.it', lasts: 'perishable',
      recordedAt: new Date(NOW.getTime() - 48 * HOUR) });
    const [p] = await db.query(
      `INSERT INTO procedures (memory_id, title, steps, origin, pending, learned_at) VALUES ($1, 'Rifare il letto', $2::jsonb, 'learned', true, $3) RETURNING id`,
      [casa, JSON.stringify(['Togli le lenzuola', 'Metti il coprimaterasso', 'Stendi il lenzuolo']), NOW]);
    await db.query(`INSERT INTO procedure_runs (procedure_id, memory_id, outcome, step, note, at) VALUES ($1, $2, 'failed', 3, 'troppo corto', $3)`, [p.id, casa, NOW]);

    const t = new Date(NOW.getTime() + 2 * HOUR);
    await sweep(t);
    const [contradiction] = await intents('check');
    expect(contradiction).toMatchObject({ for_person_id: sofia, initiative: 'ask' });
    expect(contradiction.text).toContain('La farmacia chiude alle 19.');
    expect(contradiction.text).toContain('farmacia-esempio.it');
    expect(await intents('step')).toEqual([]); // one learning question at a time

    await answered('check');
    await sweep(new Date(t.getTime() + HOUR));
    const [step] = await intents('step');
    expect(step).toMatchObject({ for_person_id: sofia, initiative: 'ask' });
    expect(step.text).toContain('Rifare il letto');
    expect(step.text).toContain('Stendi il lenzuolo');

    await answered('step');
    await sweep(new Date(t.getTime() + 2 * HOUR));
    const checks = await intents('check');
    expect(checks).toHaveLength(2);
    expect(checks[1].content).toBe('Il comune ritira gli ingombranti il primo lunedì del mese.');
    expect(checks[1].text).toContain('comune-esempio.it');
    expect(checks.map((c: { content: string }) => c.content)).not.toContain('Oggi il mercato è spostato in piazza.'); // perishable: not asked
  });

  it('a trusted person holding to what the memory had retires the page\'s version and costs the page trust', async () => {
    const had = await note('Il bidone verde si svuota il giovedì.', { pending: false, origin: 'holder_told' });
    const read = await note('Il bidone verde si svuota il venerdì.', { pending: true, origin: 'learned', supersedes: had, site: 'rifiuti-esempio.it' });
    expect(await refuteProposals(db, 'notes', had, casa)).toBe(1);
    expect((await db.query(`SELECT status::text FROM notes WHERE id = $1`, [read]))[0]).toEqual({ status: 'corrected' });
    expect((await db.query(`SELECT corrected FROM informants WHERE memory_id = $1 AND key = 'rifiuti-esempio.it'`, [casa]))[0]).toEqual({ corrected: 1 });
    expect((await db.query(`SELECT status::text FROM notes WHERE id = $1`, [had]))[0]).toEqual({ status: 'current' });
  });
});
