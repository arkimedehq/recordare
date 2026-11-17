// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Procedures kept whole (WORK_PLAN 8.16 F2a, D57): read in a page → learned, pending, with its site; the same page again
 * confirms nothing, a run done does and credits the site; the household's way of a step shown above it; a failed run
 * marks its step; the turns of one task make one run per conversation, a run left halfway is stopped; a person's correction becomes their way and costs the page trust; taught by the household → kept at
 * once; a pending version never replaces a confirmed one; carried whole by the memory context and search_knowledge.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { type INestApplication } from '@nestjs/common';
import { type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { procedureLines } from '../../src/procedures/procedures.service';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, testEnv } from '../helpers/app';

describe('procedures kept whole (8.16 F2a)', () => {
  let app: INestApplication;
  let url: string;
  let emb: Server;
  let db: DataSource;
  let key: string;
  let clientId: string;
  let home: string;
  let n = 0;
  const NOW = '2026-06-07T10:00:00+02:00';
  const as = (extra: Record<string, string> = {}) => ({ token: key, headers: { 'x-recordare-user': 'casa', 'x-recordare-now': NOW, ...extra } });
  const bed = ['Togli le lenzuola usate', 'Metti il coprimaterasso', 'Stendi il lenzuolo di sotto', 'Metti il copriletto', 'Sistema il cuscino'];

  beforeAll(async () => {
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    testEnv({ EMBEDDING_BASE_URL: fake.url, IDLE_DELAY_SECONDS: '3600', CONSOLIDATION_SCHEDULE: 'false', ALLOW_CLOCK_OVERRIDE: 'true' });
    await resetSchema();
    ({ app, url } = await startApp());
    db = app.get(DataSource);
    clientId = (await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'Robot', kind: 'platform' } })).body.id;
    key = (await call(url, 'POST', `/api/v1/admin/clients/${clientId}/keys`, { token: ADMIN_KEY, body: { scopes: ['ingest', 'read', 'write', 'mcp'] } })).body.key;
    home = (await call(url, 'POST', '/api/v1/admin/memories', { token: ADMIN_KEY, body: { displayName: 'Casa', mode: 'entity' } })).body.personId;
    await call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY, body: { kind: 'account', personId: home, clientId, externalId: 'casa' } });
  });
  afterAll(async () => { await app?.close(); emb?.close(); });

  /** A conversation with one turn: the account's speaker (role user), or a named guest. */
  async function say(conversation: string, content: string, guest?: string): Promise<void> {
    const res = await call(url, 'POST', '/api/v1/ingest/messages', { ...as(), body: {
      conversation: { externalId: conversation, ...(guest ? { participants: [{ ref: 'g', role: 'other', displayName: guest }] } : {}) },
      messages: [{ externalId: `m${++n}`, sentAt: '2026-06-07T09:59:00+02:00', ...(guest ? { role: 'other', authorRef: 'g' } : { role: 'user' }), content }],
    } });
    expect(res.status).toBeLessThan(300);
  }
  const site = async () => (await db.query(`SELECT confirmed, corrected FROM informants WHERE memory_id = $1 AND key = 'casa-esempio.it'`, [home]))[0];

  it('keeps a procedure read in a page pending with its site; a run done confirms it; the household\'s way, a failure and a correction show in it', async () => {
    await say('c1', 'Cerca come si rifà il letto.');
    const learned = await call(url, 'POST', '/api/v1/procedures', { ...as(), body: {
      title: 'Rifare il letto', steps: bed, from: 'page', uri: 'https://www.casa-esempio.it/letto', conversation: { externalId: 'c1' } } });
    expect(learned.body).toMatchObject({ pending: true, status: 'new' });
    const id = learned.body.id as string;
    expect((await db.query(`SELECT origin::text FROM procedures WHERE id = $1`, [id]))[0]).toEqual({ origin: 'learned' });

    // The same page again: the same informant — no confirmation.
    await say('c2', 'Ricontrolla come si rifà il letto.');
    const again = await call(url, 'POST', '/api/v1/procedures', { ...as(), body: {
      title: 'rifare il letto', steps: bed, from: 'page', uri: 'https://casa-esempio.it/letto', conversation: { externalId: 'c2' } } });
    expect(again.body).toEqual({ id, pending: true, status: 'same' });

    // The household's way of step 4, from the account's speaker: kept at once.
    await say('c3', 'Da noi il cuscino va sopra il copriletto.');
    const here = await call(url, 'POST', `/api/v1/procedures/${id}/variants`, { ...as(), body: { step: 4, text: 'Il cuscino va sopra il copriletto', conversation: { externalId: 'c3' } } });
    expect(here.body.pending).toBe(false);

    // One step checked and done: that step's news, not the task's — what was read stays unconfirmed.
    expect((await call(url, 'POST', `/api/v1/procedures/${id}/runs`, { ...as(), body: { outcome: 'done', step: 2 } })).body.pending).toBe(true);
    expect(await site()).toEqual({ confirmed: 0, corrected: 0 });

    // The robot ran it whole: done confirms it and credits the site.
    const whole = await call(url, 'POST', `/api/v1/procedures/${id}/runs`, { ...as(), body: { outcome: 'done' } });
    expect(whole.body.pending).toBe(false);
    expect(await site()).toEqual({ confirmed: 1, corrected: 0 });
    // The same outcome told again (the agent and the host's code, a retry): the same run, counted once.
    expect((await call(url, 'POST', `/api/v1/procedures/${id}/runs`, { ...as(), body: { outcome: 'done' } })).body).toEqual({ id: whole.body.id, pending: false });

    // A failure at step 3, then a guest nobody identified corrects step 2: their way waits; the site pays for it.
    await call(url, 'POST', `/api/v1/procedures/${id}/runs`, { ...as(), body: { outcome: 'failed', step: 3, note: 'Il lenzuolo era troppo corto' } });
    await say('c4', 'Prima il coprimaterasso va girato.', 'Ospite');
    await call(url, 'POST', `/api/v1/procedures/${id}/runs`, { ...as(), body: { outcome: 'corrected', step: 2, note: 'Gira il coprimaterasso prima di metterlo', conversation: { externalId: 'c4' } } });
    expect(await site()).toEqual({ confirmed: 1, corrected: 1 });

    const view = (await call(url, 'GET', `/api/v1/procedures/${id}`, as())).body;
    expect(view.learned).toMatchObject({ how: 'read', from: 'casa-esempio.it', confirmed: true });
    expect(view.steps.map((s: { text: string }) => s.text)).toEqual(bed);
    expect(view.steps[3].here).toEqual([expect.objectContaining({ text: 'Il cuscino va sopra il copriletto', by: 'the household', confirmed: true })]);
    expect(view.steps[2].failed).toEqual({ at: '2026-06-07', note: 'Il lenzuolo era troppo corto' });
    expect(view.steps[1].here).toEqual([expect.objectContaining({ by: 'someone', confirmed: false })]); // a guest nobody identified
    expect(view.runs).toMatchObject({ done: 1, ongoing: 1, failed: 1, corrected: 1 }); // the step done alone: still going

    // The memory context carries it whole, the household's way above the generic step.
    const block = (await call(url, 'POST', '/api/v1/context', { ...as({ 'x-recordare-conversation': 'c4' }), body: { query: 'Rifare il letto', card: false } })).body.block as string;
    expect(block).toContain(`procedure "Rifare il letto" [id: ${id}]`);
    // Where the agent decides: carrying it out ends with the report — unless the agent has no memory tools.
    expect(block).toContain('end your turn with report_procedure_run, this id and the outcome: ongoing while it goes on');
    const bare = (await call(url, 'POST', '/api/v1/context', { ...as({ 'x-recordare-conversation': 'c4' }), body: { query: 'Rifare il letto', card: false, tools: false } })).body.block as string;
    expect(bare).toContain(`procedure "Rifare il letto" [id: ${id}]`);
    expect(bare).not.toContain('report_procedure_run');
    expect(block).toContain('4. here (the household): Il cuscino va sopra il copriletto');
    expect(block).toContain('4. (generic) Metti il copriletto');
    expect(block).toContain('failed here on 2026-06-07: Il lenzuolo era troppo corto');
    expect(block.indexOf('1. Togli')).toBeLessThan(block.indexOf('5. Sistema'));
  });

  it('cuts a long procedure between steps within its budget, its id always on the head', () => {
    const view = {
      id: '00000000-0000-4000-8000-000000000001', title: 'Montare la libreria', when: null, here: [],
      steps: Array.from({ length: 30 }, (_, k) => ({ n: k + 1, text: `Passo numero ${k + 1}: avvita il pannello con cura`, here: [] })),
      learned: { how: 'read' as const, from: 'mobili-esempio.it', at: '2026-06-07', confirmed: false },
      runs: { done: 0, failed: 0, corrected: 0 },
    } as unknown as Parameters<typeof procedureLines>[0];
    for (const budget of [500, 800, 1_500]) {
      const lines = procedureLines(view, budget);
      expect(lines[0]).toContain('[id: 00000000-0000-4000-8000-000000000001]');
      expect(lines.join('\n').length).toBeLessThanOrEqual(budget);
      expect(lines.at(-1)).toMatch(/more steps: search_knowledge "Montare la libreria"$/);
      expect(lines[1]).toContain('report_procedure_run');
    }
    // Without the memory tools: no line asks for a tool.
    const bare = procedureLines(view, 500, false);
    expect(bare.join('\n')).not.toMatch(/report_procedure_run|search_knowledge/);
    expect(bare.at(-1)).toMatch(/more steps$/);
  });

  it('joins the turns of one task into one run per conversation; a run left halfway is stopped, not failed', async () => {
    await say('d1', 'Facciamo una partita a dama.');
    const id = (await call(url, 'POST', '/api/v1/procedures', { ...as(), body: {
      title: 'Giocare a dama', steps: ['Disponi le pedine', 'Muovi in diagonale', 'Mangia quando puoi', 'Fai dama in fondo'], from: 'person', conversation: { externalId: 'd1' } } })).body.id as string;
    const report = (body: Record<string, unknown>, conversation = 'd1', at = NOW) =>
      call(url, 'POST', `/api/v1/procedures/${id}/runs`, { ...as({ 'x-recordare-now': at }), body: { ...body, conversation: { externalId: conversation } } });

    // Turn by turn, the agent reports the step reached: one run, at the furthest step.
    const first = (await report({ outcome: 'done', step: 1 })).body.id;
    expect((await report({ outcome: 'done', step: 2 }, 'd1', '2026-06-07T10:05:00+02:00')).body.id).toBe(first);
    expect((await report({ outcome: 'done', step: 1 }, 'd1', '2026-06-07T10:06:00+02:00')).body.id).toBe(first);
    // The person gives up: the same run ends stopped at step 2 — no step marked failed.
    expect((await report({ outcome: 'stopped', step: 2, note: 'La persona ha smesso di giocare' }, 'd1', '2026-06-07T10:07:00+02:00')).body.id).toBe(first);
    expect((await db.query(`SELECT outcome, step, note FROM procedure_runs WHERE id = $1`, [first]))[0])
      .toEqual({ outcome: 'stopped', step: 2, note: 'La persona ha smesso di giocare' });

    // A run ended: the next report is a new game. Another conversation is another run too.
    const second = (await report({ outcome: 'done', step: 1 }, 'd1', '2026-06-07T10:20:00+02:00')).body.id;
    expect(second).not.toBe(first);
    await say('d2', 'Un\'altra partita a dama.');
    const other = (await report({ outcome: 'done', step: 1 }, 'd2', '2026-06-07T10:21:00+02:00')).body.id;
    expect(other).not.toBe(second);
    // The run of d1 ends whole later in the game: the same run; past the pause (3 h) a step done starts a new one.
    expect((await report({ outcome: 'done' }, 'd1', '2026-06-07T11:00:00+02:00')).body.id).toBe(second);
    expect((await report({ outcome: 'done', step: 3 }, 'd2', '2026-06-07T15:00:00+02:00')).body.id).not.toBe(other);

    const view = (await call(url, 'GET', `/api/v1/procedures/${id}`, as())).body;
    expect(view.runs).toMatchObject({ done: 1, ongoing: 2, failed: 0, stopped: 1, corrected: 0 });
    expect(view.steps.every((s: { failed?: unknown }) => !s.failed)).toBe(true);
    const block = (await call(url, 'POST', '/api/v1/context', { ...as({ 'x-recordare-conversation': 'd1' }), body: { query: 'Giocare a dama', card: false } })).body.block as string;
    expect(block).toContain('runs: 1 done, 0 failed, 1 stopped, 2 ongoing');
  });

  it('keeps a procedure in progress in its conversation: its line in the next turns until a report ends it; asked for in search_knowledge', async () => {
    await say('g1', 'Giochiamo a filetto?');
    const id = (await call(url, 'POST', '/api/v1/procedures', { ...as(), body: {
      title: 'Giocare a filetto', steps: ['Disegna la griglia tre per tre', 'Scegli croce o cerchio', 'Metti un segno a turno', 'Vince chi allinea tre segni'],
      from: 'person', conversation: { externalId: 'g1' } } })).body.id as string;
    const block = async (query: string, conversation = 'g1', at = NOW) => (await call(url, 'POST', '/api/v1/context',
      { ...as({ 'x-recordare-conversation': conversation, 'x-recordare-now': at }), body: { query, card: false } })).body.block as string | null ?? '';
    const progress = `procedure in progress "Giocare a filetto" [id: ${id}]`;

    // The opening turn recalls it whole; the next turns, about a move, carry its line with the report asked for.
    expect(await block('Giocare a filetto')).toContain(`procedure "Giocare a filetto" [id: ${id}]`);
    await say('g1', 'Metto la croce al centro.');
    const move = await block('Metto la croce al centro.');
    expect(move).toContain(`${progress} (not reported yet) — if you are carrying it out`);
    expect(move).toContain('end your turn with report_procedure_run');
    // Not in another conversation, nor past the pause.
    await say('g2', 'Che tempo fa domani?');
    expect(await block('Che tempo fa domani?', 'g2')).not.toContain(progress);
    expect(await block('Metto la croce al centro.', 'g1', '2026-06-07T13:30:00+02:00')).not.toContain(progress);

    // Reported halfway: still in progress, at its step; stopped: gone, even when the message still recalls it.
    const run = (body: Record<string, unknown>) => call(url, 'POST', `/api/v1/procedures/${id}/runs`, { ...as(), body: { ...body, conversation: { externalId: 'g1' } } });
    await run({ outcome: 'done', step: 3 });
    expect(await block('Metto il cerchio in alto.')).toContain(`${progress} (last reported: ongoing at step 3)`);
    await run({ outcome: 'stopped', step: 3, note: 'Partita lasciata a metà' });
    expect(await block('Basta col filetto.')).not.toContain(progress);
    expect(await block('Che ore sono?')).not.toContain(progress);
    // Without the memory tools no line asks for a tool.
    await say('g3', 'Giochiamo a filetto?');
    await call(url, 'POST', '/api/v1/context', { ...as({ 'x-recordare-conversation': 'g3' }), body: { query: 'Giocare a filetto', card: false, tools: false } });
    expect((await call(url, 'POST', '/api/v1/context', { ...as({ 'x-recordare-conversation': 'g3' }), body: { query: 'Metto la croce.', card: false, tools: false } })).body.block ?? '')
      .not.toContain(progress);

    // Looked up with search_knowledge: the report asked for right after the id, within what a host keeps of a long result.
    await say('g4', 'Facciamo una partita a filetto.');
    const transport = new StreamableHTTPClientTransport(new URL(`${url}/mcp`), { requestInit: { headers: {
      authorization: `Bearer ${key}`, 'x-recordare-user': 'casa', 'x-recordare-conversation': 'g4', 'x-recordare-now': NOW } } });
    const client = new Client({ name: 'test', version: '1' });
    await client.connect(transport);
    const text = ((await client.callTool({ name: 'search_knowledge', arguments: { query: 'Giocare a filetto' } })).content as Array<{ text: string }>)[0]!.text;
    await client.close();
    expect(Object.keys(JSON.parse(text).procedures[0]).slice(0, 3)).toEqual(['id', 'title', 'report']);
    expect(text.slice(0, 3_000)).toContain(id);
    expect(text.slice(0, 3_000)).toContain('end your turn with report_procedure_run');
    expect(await block('Metto la croce in basso.', 'g4')).toContain(`${progress} (not reported yet)`);
    // That conversation ends with no report: one unreported; the ones only recalled by the context do not count.
    expect((await call(url, 'POST', '/api/v1/ingest/conversations/g4/end', as())).status).toBe(202);
    expect(await block('Metto la croce in basso.', 'g4')).not.toContain(progress);
    const view = (await call(url, 'GET', `/api/v1/procedures/${id}`, as())).body;
    expect(view.runs).toMatchObject({ done: 0, ongoing: 0, stopped: 1, unreported: 1 }); // the step reached, then stopped: one run
  });

  it('takes back a done told too soon: the same conversation goes on, then stops — one run, stopped, nothing confirmed', async () => {
    await say('k1', 'Cerca come si gioca a dama cinese.');
    const id = (await call(url, 'POST', '/api/v1/procedures', { ...as(), body: {
      title: 'Giocare a dama cinese', steps: ['Disponi le biglie nella tua punta', 'Muovi di una casa o salta', 'Porta tutte le biglie nella punta opposta'],
      from: 'page', uri: 'https://giochi-esempio.it/dama-cinese', conversation: { externalId: 'k1' } } })).body.id as string;
    const games = async () => (await db.query(`SELECT confirmed FROM informants WHERE memory_id = $1 AND key = 'giochi-esempio.it'`, [home]))[0];
    const report = (body: Record<string, unknown>, at: string) =>
      call(url, 'POST', `/api/v1/procedures/${id}/runs`, { ...as({ 'x-recordare-now': at }), body: { ...body, conversation: { externalId: 'k1' } } });
    // As seen live: the agent says done (no step) while the game goes on — that confirms, for now.
    const first = await report({ outcome: 'done', note: 'Partita in corso, tocca al bianco' }, '2026-06-07T10:01:00+02:00');
    expect(first.body.pending).toBe(false);
    expect(await games()).toEqual({ confirmed: 1 });
    // The same done again a minute later: the same run. Then it stops: that done was told too soon — taken back.
    expect((await report({ outcome: 'done', note: 'In corso' }, '2026-06-07T10:02:00+02:00')).body.id).toBe(first.body.id);
    const stop = await report({ outcome: 'stopped', note: 'La persona ha smesso' }, '2026-06-07T10:03:00+02:00');
    expect(stop.body).toEqual({ id: first.body.id, pending: true });
    expect(await games()).toEqual({ confirmed: 0 });
    const view = (await call(url, 'GET', `/api/v1/procedures/${id}`, as())).body;
    expect(view.runs).toMatchObject({ done: 0, ongoing: 0, stopped: 1 });
    expect(view.learned.confirmed).toBe(false);
    // ongoing turn by turn, then done: one run, done whole, which confirms.
    const go = await report({ outcome: 'ongoing', step: 1 }, '2026-06-07T11:00:00+02:00');
    expect(go.body.id).not.toBe(first.body.id);
    expect((await report({ outcome: 'ongoing', step: 2 }, '2026-06-07T11:05:00+02:00')).body.id).toBe(go.body.id);
    expect((await report({ outcome: 'done' }, '2026-06-07T11:10:00+02:00')).body).toEqual({ id: go.body.id, pending: false });
    expect(await games()).toEqual({ confirmed: 1 });
    // A new done after a done is another run, not a correction of the first.
    expect((await report({ outcome: 'done' }, '2026-06-07T11:40:00+02:00')).body.id).not.toBe(go.body.id);
  });

  it('keeps at once what the household teaches; a page\'s pending version does not replace it; search_knowledge returns it whole', async () => {
    await say('t1', 'Per accendere la lavastoviglie: chiudi lo sportello, premi Eco, poi Avvio.');
    const taught = await call(url, 'POST', '/api/v1/procedures', { ...as(), body: {
      title: 'Accendere la lavastoviglie', steps: ['Chiudi lo sportello', 'Premi Eco', 'Premi Avvio'], from: 'person', conversation: { externalId: 't1' } } });
    expect(taught.body).toMatchObject({ pending: false, status: 'new' });
    expect((await db.query(`SELECT origin::text FROM procedures WHERE id = $1`, [taught.body.id]))[0]).toEqual({ origin: 'holder_told' });

    const page = await call(url, 'POST', '/api/v1/procedures', { ...as(), body: {
      title: 'Accendere la lavastoviglie', steps: ['Premi Intensivo', 'Premi Avvio'], from: 'page', uri: 'https://elettrodomestici-esempio.it/x' } });
    expect(page.body).toMatchObject({ pending: true, status: 'version' });
    const current: Array<{ id: string; pending: boolean }> = await db.query(
      `SELECT id, pending FROM procedures WHERE memory_id = $1 AND title ILIKE 'accendere%' AND status = 'current' ORDER BY pending`, [home]);
    expect(current).toEqual([{ id: taught.body.id, pending: false }, { id: page.body.id, pending: true }]);

    const transport = new StreamableHTTPClientTransport(new URL(`${url}/mcp`), { requestInit: { headers: { authorization: `Bearer ${key}`, 'x-recordare-user': 'casa', 'x-recordare-conversation': 't1' } } });
    const client = new Client({ name: 'test', version: '1' });
    await client.connect(transport);
    expect((await client.listTools()).tools.map((t) => t.name)).toEqual(expect.arrayContaining(['learn_procedure', 'report_procedure_run']));
    const found = JSON.parse(((await client.callTool({ name: 'search_knowledge', arguments: { query: 'Accendere la lavastoviglie' } })).content as Array<{ text: string }>)[0]!.text);
    expect(found.procedures[0]).toMatchObject({ id: taught.body.id, learned: { how: 'taught', from: 'the household', confirmed: true } });
    expect(found.procedures[0].steps).toHaveLength(3);
    // Through the tool: the household's way of the whole task.
    const v = JSON.parse(((await client.callTool({ name: 'learn_procedure', arguments: { variant_of: taught.body.id, variant: 'Solo dopo le 21' } })).content as Array<{ text: string }>)[0]!.text);
    expect(v.pending).toBe(false);
    await client.close();

    expect((await call(url, 'DELETE', `/api/v1/procedures/${taught.body.id}`, as())).status).toBe(204);
    expect((await call(url, 'GET', `/api/v1/procedures/${taught.body.id}`, as())).status).toBe(404);
  });
});
