// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Learning from outside (WORK_PLAN 8.16 F1, D57): an entity memory keeps lasting knowledge it reads or is told, with who
 * brought it and how far to trust it — decided in code, never by the wording. Read in a page: kept, labelled, pending; the
 * same page again is no confirmation, a household member saying it is; perishable knowledge fades; a household member
 * teaching about the place is kept at once, an unknown speaker is not; trust moves with outcomes. A personal memory and a
 * memory switched off keep today's prompt and rules.
 */
import { type INestApplication } from '@nestjs/common';
import { type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { EXTRACTION_RUNNER, type ExtractionRunner } from '../../src/queue/queue.port';
import { MemorySearchService } from '../../src/recall/memory-search.service';
import { fadeLearned } from '../../src/engine/learning';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, startFakeLlm, testEnv } from '../helpers/app';

type Msg = { role: 'user' | 'assistant' | 'tool' | 'other'; content: string; toolName?: string; authorRef?: string };

describe('learning from outside (8.16 F1)', () => {
  let app: INestApplication;
  let url: string;
  let llm: Awaited<ReturnType<typeof startFakeLlm>>;
  let emb: Server;
  let db: DataSource;
  let key: string;
  let clientId: string;
  let n = 0;
  /** When set, the fake model answers from the request (e.g. a note's N-number, read from the prompt). */
  let answer: ((user: string) => object) | null = null;

  beforeAll(async () => {
    llm = await startFakeLlm((req) => answer?.((req as unknown as { messages: Array<{ content: string }> }).messages[1]!.content) ?? {});
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    testEnv({ EMBEDDING_BASE_URL: fake.url, LLM_BASE_URL: llm.url, IDLE_DELAY_SECONDS: '3600', CONSOLIDATION_SCHEDULE: 'false', LEARNING_OWN_TOOLS: '^calendar' });
    await resetSchema();
    ({ app, url } = await startApp());
    db = app.get(DataSource);
    clientId = (await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'A', kind: 'platform' } })).body.id;
    key = (await call(url, 'POST', `/api/v1/admin/clients/${clientId}/keys`, { token: ADMIN_KEY, body: { scopes: ['ingest', 'read'] } })).body.key;
  });
  afterAll(async () => { await app?.close(); llm?.server.close(); emb?.close(); });

  async function memory(name: string, mode?: 'entity'): Promise<string> {
    const id = (await call(url, 'POST', '/api/v1/admin/memories', { token: ADMIN_KEY, body: { displayName: name, ...(mode ? { mode } : {}) } })).body.personId;
    await call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY, body: { kind: 'account', personId: id, clientId, externalId: name } });
    return id;
  }

  /** One conversation window, extracted with the model's answer `out`; returns the system prompt the model was given. */
  async function extract(user: string, conversation: string, msgs: Msg[], out: object | ((user: string) => object), at = '2026-06-07T10:00:00+02:00',
    participants?: object[]): Promise<string> {
    const t0 = new Date(at).getTime();
    const res = await call(url, 'POST', '/api/v1/ingest/messages', {
      token: key, headers: { 'x-recordare-user': user },
      body: { conversation: { externalId: conversation, ...(participants ? { participants } : {}) },
        messages: msgs.map((m, i) => ({ externalId: `${conversation}-${++n}`, sentAt: new Date(t0 + i * 1000).toISOString(), ...m })) },
    });
    expect(res.status).toBeLessThan(300);
    if (typeof out === 'function') answer = out as (user: string) => object;
    else llm.queue.push(out);
    await app.get<ExtractionRunner>(EXTRACTION_RUNNER).runForConversation(res.body.conversationId as string);
    answer = null;
    return (llm.requests as unknown as Array<{ messages: Array<{ content: string }> }>).at(-1)!.messages[0]!.content;
  }

  const search = (home: string, query: string) => app.get(MemorySearchService).search(home, { query }, new Date('2026-06-08T10:00:00Z'));
  const pharmacy = { subject: 'me', category: 'knowledge', content: 'La farmacia comunale di via Roma chiude alle 20 il sabato.', keywords: ['farmacia'],
    lasts: 'changing', until: null };
  const page = (text: string): Msg => ({ role: 'tool', toolName: 'web_search', content: `https://www.farmacie-esempio.it/orari\n${text}` });

  it('keeps what it read as learned and pending, with its source; the same page again does not confirm it, the household does', async () => {
    const home = await memory('Casa', 'entity');
    const system = await extract('Casa', 'w1', [
      { role: 'user', content: 'A che ora chiude la farmacia comunale sabato?' },
      page('Farmacia comunale via Roma: sabato 8:30–20:00'),
      { role: 'assistant', content: 'Sabato chiude alle 20.' },
    ], { notes: [{ ...pharmacy, evidence: [2] }] });
    expect(system).toContain('LEARNING (what I am told or read that lasts)');
    expect(await db.query(`SELECT DISTINCT prompt_version FROM extraction_runs WHERE memory_id = $1`, [home]))
      .toEqual([{ prompt_version: 'extract.v24+entity.v12+learn.v1' }]);

    const [note] = await db.query(`SELECT id, origin::text, pending, stance::text, confidence, lasts, recheck_at, expires_at FROM notes WHERE memory_id = $1`, [home]);
    expect(note).toMatchObject({ origin: 'learned', pending: true, stance: 'inferred', confidence: 0.5, lasts: 'changing', expires_at: null });
    expect(new Date(note.recheck_at).getTime() - new Date('2026-06-07T08:00:01Z').getTime()).toBe(180 * 86_400_000);
    expect(await db.query(`SELECT kind, key, class FROM informants WHERE memory_id = $1`, [home]))
      .toEqual([{ kind: 'site', key: 'farmacie-esempio.it', class: 'site' }]);

    // Recall shows it, said with its source and not confirmed — unlike other pending items.
    const found = await search(home, 'farmacia comunale chiude');
    expect(found.notes.find((x) => x.id === note.id)).toMatchObject({ pending: true, learned: { from: 'farmacie-esempio.it', at: '2026-06-07', confirmed: false } });

    // The same page read again, in another conversation: one source, no confirmation.
    await extract('Casa', 'w2', [{ role: 'user', content: 'Ricontrolla la farmacia' }, page('Farmacia comunale via Roma: sabato 8:30–20:00')],
      { notes: [{ ...pharmacy, verdict: 'keep', target: 'N1', evidence: [2] }] });
    expect((await db.query(`SELECT pending, support_count FROM notes WHERE id = $1`, [note.id]))[0]).toEqual({ pending: true, support_count: 1 });

    // Someone of the household says it: an independent, trusted origin — confirmed, and the site was right.
    await extract('Casa', 'w3', [{ role: 'user', content: 'Sì, la farmacia comunale il sabato chiude alle 20, ci sono passato.' }],
      { notes: [{ ...pharmacy, verdict: 'keep', target: 'N1', evidence: [1] }] });
    expect((await db.query(`SELECT pending, stance::text FROM notes WHERE id = $1`, [note.id]))[0]).toEqual({ pending: false, stance: 'stated' });
    expect((await db.query(`SELECT confirmed, corrected FROM informants WHERE memory_id = $1 AND kind = 'site'`, [home]))[0]).toEqual({ confirmed: 1, corrected: 0 });
  });

  it('lets perishable news fade on its own day; an own tool is trusted to teach; a correction costs its source trust', async () => {
    const home = await memory('Cucina', 'entity');
    await extract('Cucina', 'n1', [
      { role: 'user', content: 'Domani c\'è sciopero dei bus?' },
      { role: 'tool', toolName: 'web_search', content: 'https://notizie-esempio.it/sciopero Sciopero linea 3 lunedì 8 giugno' },
    ], { notes: [{ subject: 'me', category: 'knowledge', content: 'Lunedì 8 giugno 2026 sciopero della linea 3 dei bus.', lasts: 'perishable', until: '2026-06-08', evidence: [2] }] });
    const [news] = await db.query(`SELECT id, expires_at FROM notes WHERE memory_id = $1`, [home]);
    // The end of 8 June in Rome.
    expect(new Date(news.expires_at).toISOString()).toBe('2026-06-08T22:00:00.000Z');
    expect(await fadeLearned(db, home, new Date('2026-06-08T21:00:00Z'))).toBe(0);
    expect(await fadeLearned(db, home, new Date('2026-06-09T06:00:00Z'))).toBe(1);
    expect(await db.query(`SELECT id FROM notes WHERE id = $1`, [news.id])).toEqual([]);

    // The agent's own calendar (LEARNING_OWN_TOOLS) is trusted to teach: kept at once.
    await extract('Cucina', 'n2', [
      { role: 'user', content: 'Quando passa il tecnico della caldaia?' },
      { role: 'tool', toolName: 'calendar_list', content: 'Tecnico caldaia: ogni anno a ottobre' },
    ], { notes: [{ subject: 'me', category: 'knowledge', content: 'Il tecnico della caldaia passa ogni anno a ottobre.', lasts: 'lasting', evidence: [2] }] });
    expect((await db.query(`SELECT origin::text, pending FROM notes WHERE memory_id = $1 AND content LIKE 'Il tecnico%'`, [home]))[0])
      .toEqual({ origin: 'learned', pending: false });

    // A page says the market is on Thursday; the household corrects it: the page loses trust.
    await extract('Cucina', 'n3', [
      { role: 'user', content: 'Che giorno c\'è il mercato in piazza?' },
      { role: 'tool', toolName: 'web_search', content: 'https://mercati-esempio.it Mercato settimanale: giovedì' },
    ], { notes: [{ subject: 'me', category: 'knowledge', content: 'Il mercato in piazza è il giovedì.', lasts: 'changing', evidence: [2] }] });
    await extract('Cucina', 'n4', [{ role: 'user', content: 'No, il mercato in piazza è il mercoledì, da anni.' }],
      (prompt) => ({ notes: [{ subject: 'me', category: 'knowledge', content: 'Il mercato in piazza è il mercoledì.', lasts: 'changing', verdict: 'corrects',
        target: /(N\d+)[^\n]*giovedì/.exec(prompt)?.[1], evidence: [1] }] }));
    expect(await db.query(`SELECT content, status::text, pending FROM notes WHERE memory_id = $1 AND content LIKE 'Il mercato%' ORDER BY recorded_at`, [home]))
      .toEqual([{ content: 'Il mercato in piazza è il giovedì.', status: 'corrected', pending: true },
        { content: 'Il mercato in piazza è il mercoledì.', status: 'current', pending: false }]);
    expect((await db.query(`SELECT corrected FROM informants WHERE memory_id = $1 AND key = 'mercati-esempio.it'`, [home]))[0]).toEqual({ corrected: 1 });
  });

  it('keeps at once what a household member teaches about the place; what someone unknown says waits', async () => {
    const home = await memory('Villa', 'entity');
    const participants = [{ ref: 'livia', role: 'other', displayName: 'Livia', identity: { channel: 'voice', externalId: 'livia-voice' } }];
    await extract('Villa', 'h0', [{ role: 'other', authorRef: 'livia', content: 'Ciao!' }], {}, '2026-06-06T10:00:00+02:00', participants);
    const livia = (await db.query(`SELECT id FROM persons WHERE memory_id = $1 AND display_name = 'Livia'`, [home]))[0].id;
    await call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY,
      body: { kind: 'participant', memoryId: home, personId: livia, channel: 'face', externalId: 'livia-face', verified: true } });

    await extract('Villa', 'h1', [{ role: 'other', authorRef: 'livia', content: 'Il contatore dell\'acqua è sotto il lavello.' }],
      { facts: [{ key: 'water_meter_location', value: 'sotto il lavello', verdict: 'new', subject: 'me', evidence: [1] }] }, undefined, participants);
    expect((await db.query(`SELECT pending, origin::text FROM facts WHERE memory_id = $1 AND key = 'water_meter_location'`, [home]))[0])
      .toEqual({ pending: false, origin: 'holder_lived' });
    expect((await db.query(`SELECT class FROM informants WHERE memory_id = $1 AND person_id = $2`, [home, livia]))[0]).toEqual({ class: 'household' });

    // A voice nobody recognised in the room says where the fuse box is: it waits.
    await extract('Villa', 'h2', [{ role: 'other', authorRef: 'x', content: 'Il quadro elettrico è in garage.' }],
      { facts: [{ key: 'fuse_box_location', value: 'in garage', verdict: 'new', subject: 'me', evidence: [1] }] }, undefined,
      [{ ref: 'x', role: 'other', displayName: 'Ospite' }]);
    expect((await db.query(`SELECT pending FROM facts WHERE memory_id = $1 AND key = 'fuse_box_location'`, [home]))[0]).toEqual({ pending: true });
  });

  it('remembers an event read in a page and relayed by its reply as learned, not as its own words', async () => {
    const home = await memory('Borgo', 'entity');
    await extract('Borgo', 'w-strike', [
      { role: 'user', content: 'Domani c\'è lo sciopero dei treni?' },
      { role: 'tool', toolName: 'web_search', content: 'https://notizie-esempio.it/sciopero\nSciopero nazionale dei treni l\'8 giugno 2026 dalle 9 alle 17.' },
      { role: 'assistant', content: 'Sì, domani 8 giugno sciopero dei treni dalle 9 alle 17.' },
    ], { episodes: [{ content: 'Ho saputo che l\'8 giugno 2026 c\'è uno sciopero nazionale dei treni dalle 9 alle 17.', kind: 'event',
      occurred_at: '2026-06-08', date_precision: 'day', evidence: [3] }] });
    expect(await db.query(`SELECT origin::text FROM episodes WHERE memory_id = $1`, [home])).toEqual([{ origin: 'learned' }]);
  });

  it('keeps today\'s prompt and rules for a personal memory and for an entity memory switched off', async () => {
    const own = await memory('Giulia');
    const system = await extract('Giulia', 'p1', [{ role: 'user', content: 'Cerca gli orari della farmacia' }, page('sabato 8:30–20:00')],
      { notes: [{ ...pharmacy, evidence: [2] }] });
    expect(system).not.toContain('LEARNING');
    expect((await db.query(`SELECT origin::text, lasts FROM notes WHERE memory_id = $1`, [own]))[0]).toEqual({ origin: 'holder_lived', lasts: null });
    expect(await db.query(`SELECT id FROM informants WHERE memory_id = $1`, [own])).toEqual([]);

    const off = await memory('Garage', 'entity');
    expect((await call(url, 'PATCH', `/api/v1/admin/memories/${off}`, { token: ADMIN_KEY, body: { learnFromOutside: false } })).status).toBe(200);
    const sys2 = await extract('Garage', 'g1', [{ role: 'user', content: 'Cerca gli orari della farmacia' }, page('sabato 8:30–20:00')],
      { notes: [{ ...pharmacy, evidence: [2] }] });
    expect(sys2).not.toContain('LEARNING');
    expect(await db.query(`SELECT DISTINCT prompt_version FROM extraction_runs WHERE memory_id = $1`, [off])).toEqual([{ prompt_version: 'extract.v24+entity.v12' }]);
    expect(await db.query(`SELECT id FROM informants WHERE memory_id = $1`, [off])).toEqual([]);
  });
});
