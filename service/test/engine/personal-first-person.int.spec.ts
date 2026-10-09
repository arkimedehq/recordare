// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Personal first person (WORK_PLAN 8.4, D50): subjects linked to contacts (created when only mentioned, merged only when
 * clear), undecided subjects with a clarification, answered by a later window or expired, identified participants bound
 * to a known contact only by full name ("same person?" otherwise, merged on "yes"), the clarification offered by
 * the memory context, recall by subject (an identified speaker gets their own items first), a person's own news as
 * theirs and others' claims kept apart, the gate, gender in the prompt.
 */
import { type INestApplication } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { type Server } from 'node:http';
import { DataSource } from 'typeorm';
import { mergeContacts } from '../../src/engine/contacts';
import { EXTRACTION_RUNNER, type ExtractionRunner } from '../../src/queue/queue.port';
import { ADMIN_KEY, call, resetSchema, startApp, startFakeEmbeddings, startFakeLlm, testEnv } from '../helpers/app';

type Msg = { id: string; role?: string; content: string; at: string; authorRef?: string };

describe('personal first person (WORK_PLAN 8.4)', () => {
  let app: INestApplication;
  let url: string;
  let db: DataSource;
  let llm: Awaited<ReturnType<typeof startFakeLlm>>;
  let emb: Server;
  let key: string;
  let token: string;
  let me: string;
  const giulia = { ref: 'g', role: 'other', displayName: 'Giulia', identity: { externalUserId: 'giulia-1' } };

  beforeAll(async () => {
    llm = await startFakeLlm();
    const fake = await startFakeEmbeddings();
    emb = fake.server;
    testEnv({ EMBEDDING_BASE_URL: fake.url, LLM_BASE_URL: llm.url, IDLE_DELAY_SECONDS: '3600', ALLOW_CLOCK_OVERRIDE: 'true' });
    await resetSchema();
    ({ app, url } = await startApp());
    db = app.get(DataSource);
    const client = await call(url, 'POST', '/api/v1/admin/clients', { token: ADMIN_KEY, body: { name: 'A', kind: 'platform' } });
    key = (await call(url, 'POST', `/api/v1/admin/clients/${client.body.id}/keys`, { token: ADMIN_KEY, body: { scopes: ['ingest', 'read', 'mcp'] } })).body.key;
    me = (await call(url, 'POST', '/api/v1/admin/owners', { token: ADMIN_KEY, body: { displayName: 'Andrea' } })).body.personId;
    await call(url, 'POST', '/api/v1/admin/identities', { token: ADMIN_KEY, body: { kind: 'account', personId: me, clientId: client.body.id, externalId: 'andrea' } });
    token = (await call(url, 'POST', `/api/v1/admin/owners/${me}/tokens`, { token: ADMIN_KEY, body: { clientId: client.body.id, scopes: ['mcp'] } })).body.token;
  });
  afterAll(async () => { await app?.close(); llm?.server.close(); emb?.close(); });

  async function ingest(conv: string, messages: Msg[], participants: unknown[] = []): Promise<string> {
    const res = await call(url, 'POST', '/api/v1/ingest/messages', {
      token: key, headers: { 'x-recordare-user': 'andrea' },
      body: { conversation: { externalId: conv, participants }, messages: messages.map((m) => ({ externalId: m.id, role: m.role ?? 'user', content: m.content,
        sentAt: m.at, ...(m.authorRef ? { authorRef: m.authorRef } : {}) })) },
    });
    return res.body.conversationId as string;
  }
  const lastUser = () => (llm.requests as unknown as Array<{ messages: Array<{ content: string }> }>).at(-1)?.messages[1]?.content ?? '';
  async function extract(conv: string, messages: Msg[], out: object, participants: unknown[] = []): Promise<string> {
    const id = await ingest(conv, messages, participants);
    llm.queue.push(out);
    await app.get<ExtractionRunner>(EXTRACTION_RUNNER).runForConversation(id);
    return lastUser();
  }
  const run = async (conv: string) => app.get<ExtractionRunner>(EXTRACTION_RUNNER).runForConversation(conv);
  const contacts = () => db.query(`SELECT display_name, full_name, relation FROM persons WHERE owner_scope = $1 ORDER BY created_at`, [me]);
  const episode = (like: string) => db.query(
    `SELECT e.id, e.content, e.subject_kind, p.display_name AS subject, e.subject_candidates, e.stance, e.author_role
     FROM episodes e LEFT JOIN persons p ON p.id = e.subject_person_id WHERE e.owner_id = $1 AND e.content LIKE $2`, [me, like]).then((r) => r[0]);
  const context = (query: string, now: string) => call(url, 'POST', '/api/v1/context', {
    token: key, headers: { 'x-recordare-user': 'andrea', 'x-recordare-now': now }, body: { query },
  });

  it('writes a person only mentioned as a contact with relation; the self and the window speak in the first person', async () => {
    const prompt = await extract('s1', [{ id: 's1-1', content: 'Ieri sono stato al mare con mia sorella Giulia, che ha vinto la gara di nuoto.', at: '2026-09-07T10:00:00+02:00' }], {
      episodes: [
        { content: 'Il 6 settembre 2026 sono stato al mare con mia sorella Giulia.', subject: 'me', people: ['Giulia (sorella)'], origin: 'lived', evidence: [1] },
        { content: 'Mia sorella Giulia ha vinto la gara di nuoto.', subject: 'Giulia (sorella)', people: ['Giulia (sorella)'], origin: 'told', evidence: [1] },
      ],
    });
    expect(prompt).toMatch(/^ME: Andrea — gender masculine\n\nMEMORY LANGUAGE: it/);
    expect(prompt).toContain(' me: Ieri sono stato al mare');
    expect(await contacts()).toEqual([{ display_name: 'Giulia', full_name: null, relation: 'sorella' }]);
    expect(await episode('%al mare%')).toMatchObject({ subject_kind: 'self', subject: null });
    expect(await episode('%gara di nuoto%')).toMatchObject({ subject_kind: 'contact', subject: 'Giulia', stance: 'stated' });
    expect(await db.query(`SELECT count(*)::int AS n FROM episode_people WHERE person_id IS NOT NULL`)).toEqual([{ n: 2 }]);
    // Next time the same person is listed with her C-number, and a bare "Giulia" is the same contact (no duplicate).
    const next = await extract('s1b', [{ id: 's1b-1', content: 'Giulia mi ha prestato la bici.', at: '2026-09-08T10:00:00+02:00' }], {
      episodes: [{ content: "L'8 settembre 2026 Giulia mi ha prestato la bici.", subject: 'me', people: ['Giulia'], evidence: [1] }],
      notes: [{ subject: 'C1', category: 'preference', content: 'Giulia nuota a livello agonistico.', evidence: [1] }],
    });
    expect(next).toContain('PEOPLE I KNOW:\nC1: Giulia — sorella');
    expect(await contacts()).toHaveLength(1);
    expect(await db.query(`SELECT n.subject_kind, p.display_name FROM notes n JOIN persons p ON p.id = n.subject_person_id`))
      .toEqual([{ subject_kind: 'contact', display_name: 'Giulia' }]);
  });

  it('keeps two people with the same name apart (relation, full name) and never merges on a conflict', async () => {
    await extract('m1', [{ id: 'm1-1', content: 'Mio cugino Marco si è trasferito a Torino.', at: '2026-09-09T10:00:00+02:00' }], {
      facts: [{ subject: 'Marco (cugino)', key: 'city', value: 'Torino', verdict: 'new', evidence: [1] }],
    });
    await extract('m2', [{ id: 'm2-1', content: 'Pranzo con il mio collega Marco Bellini.', at: '2026-09-10T10:00:00+02:00' }], {
      episodes: [{ content: 'Il 10 settembre 2026 ho pranzato con il mio collega Marco Bellini.', subject: 'me', people: ['Marco Bellini (collega)'], evidence: [1] }],
    });
    // "Marco (collega)" is Bellini (relation), not the cousin.
    await extract('m3', [{ id: 'm3-1', content: 'Il mio collega Marco è in ferie.', at: '2026-09-11T10:00:00+02:00' }], {
      episodes: [{ content: 'Il mio collega Marco Bellini è in ferie.', subject: 'Marco (collega)', evidence: [1] }],
    });
    expect(await episode('%in ferie%')).toMatchObject({ subject_kind: 'contact', subject: 'Marco Bellini' });
    expect((await contacts()).filter((c: { display_name: string }) => c.display_name.startsWith('Marco'))).toEqual([
      { display_name: 'Marco', full_name: null, relation: 'cugino' },
      { display_name: 'Marco Bellini', full_name: 'Marco Bellini', relation: 'collega' },
    ]);
    const facts = await db.query(`SELECT p.display_name, f.key, f.value FROM facts f JOIN persons p ON p.id = f.subject_person_id WHERE f.owner_id = $1`, [me]);
    expect(facts).toEqual([{ display_name: 'Marco', key: 'city', value: 'Torino' }]);
    // A single "Luca" with another relation is someone else: a new contact, never a merge.
    await extract('l1', [{ id: 'l1-1', content: 'Mio fratello Luca e il vicino Luca.', at: '2026-09-12T10:00:00+02:00' }], {
      episodes: [{ content: 'Mio fratello Luca ha cambiato casa.', subject: 'Luca (fratello)', evidence: [1] },
        { content: 'Il vicino Luca ha un cane nuovo.', subject: 'Luca (vicino)', evidence: [1] }],
    });
    expect((await contacts()).filter((c: { display_name: string }) => c.display_name === 'Luca').map((c: { relation: string }) => c.relation)).toEqual(['fratello', 'vicino']);
  });

  it('stores an ambiguous person as undecided with a question, offers it in the context, resolves it from a later answer', async () => {
    const prompt = await extract('a1', [{ id: 'a1-1', content: 'Marco ha avuto un incidente in moto, si è rotto il polso.', at: '2026-09-18T10:00:00+02:00' }], {
      episodes: [{ content: 'Marco ha avuto un incidente in moto e si è rotto il polso.', subject: 'Marco', people: ['Marco'], evidence: [1] }],
    });
    // Both Marcos are listed for the model, with the relation that tells them apart.
    expect(prompt).toMatch(/C\d+: Marco — cugino/);
    expect(prompt).toMatch(/C\d+: Marco Bellini — collega/);
    const ep = await episode('%polso%');
    expect(ep).toMatchObject({ subject_kind: 'undecided', subject: null });
    expect(ep.subject_candidates).toHaveLength(2);
    const [q] = await db.query(`SELECT question, status, episode_id FROM clarifications WHERE owner_id = $1`, [me]);
    expect(q).toMatchObject({ question: 'Marco? Marco (cugino) / Marco Bellini (collega)', status: 'open', episode_id: ep.id }); // fallback question
    const [summary] = await db.query(`SELECT summary FROM extraction_runs WHERE conversation_id = (SELECT id FROM conversations WHERE external_id = 'a1')`);
    expect(summary.summary.clarifications).toEqual({ asked: 1, resolved: 0 });

    // The memory context suggests the question when the message names one of the candidates.
    const ctx = await context('Devo chiamare Marco stasera', '2026-09-19T10:00:00+02:00');
    expect(ctx.body.block).toContain('- if natural, ask: Marco? Marco (cugino) / Marco Bellini (collega)');
    expect(ctx.body.block).toContain('Background from your memory (you are Andrea: first-person items are yours)');

    // A later window lists it under OPEN QUESTIONS; an unknown contact or the assistant's turn is no answer.
    const cousin = (await db.query(`SELECT id FROM persons WHERE owner_scope = $1 AND display_name = 'Marco'`, [me]))[0].id as string;
    const later = await ingest('a2', [{ id: 'a2-1', content: 'Il Marco dell\'incidente è mio cugino.', at: '2026-09-21T10:00:00+02:00' }]);
    llm.queue.push({ answers: [{ question: 'Q1', contact: 'C9', evidence: [1] }] });
    await run(later);
    const sent = lastUser();
    expect(sent).toMatch(/OPEN QUESTIONS:\nQ1: Marco\? Marco \(cugino\) \/ Marco Bellini \(collega\) \(about: "Marco ha avuto un incidente in moto e si è rotto il polso\."; candidates C\d+, C\d+\)/);
    const ref = (sent.match(/C\d+(?=: Marco — cugino)/) ?? [''])[0];
    expect((await db.query(`SELECT status FROM clarifications`))[0].status).toBe('open');
    const again = await ingest('a3', [
      { id: 'a3-1', role: 'assistant', content: 'Era tuo cugino?', at: '2026-09-22T10:00:00+02:00' },
      { id: 'a3-2', content: 'Va bene.', at: '2026-09-22T10:00:05+02:00' },
    ]);
    llm.queue.push({ answers: [{ question: 'Q1', contact: ref, evidence: [1] }] });
    await run(again);
    expect((await db.query(`SELECT status FROM clarifications`))[0].status).toBe('open');
    const third = await ingest('a4', [{ id: 'a4-1', content: 'Confermo: il polso rotto è di mio cugino Marco.', at: '2026-09-23T10:00:00+02:00' }]);
    llm.queue.push({ answers: [{ question: 'Q1', contact: ref, evidence: [1] }] });
    await run(third);
    expect((await db.query(`SELECT status, resolved_person_id, resolution FROM clarifications`))[0])
      .toEqual({ status: 'resolved', resolved_person_id: cousin, resolution: 'Marco' });
    // The attribution is added; the memory's text is not rewritten.
    expect(await episode('%polso%')).toMatchObject({ subject_kind: 'contact', subject: 'Marco', content: 'Marco ha avuto un incidente in moto e si è rotto il polso.' });
    expect(await db.query(`SELECT person_id FROM episode_people WHERE episode_id = $1`, [ep.id])).toEqual([{ person_id: cousin }]);
    expect((await context('Devo chiamare Marco stasera', '2026-09-24T10:00:00+02:00')).body.block ?? '').not.toContain('if natural, ask');
  });

  it('lets unanswered questions expire after 14 days', async () => {
    await extract('x1', [{ id: 'x1-1', content: 'Marco mi ha scritto.', at: '2026-10-01T10:00:00+02:00' }], {
      episodes: [{ content: 'Il 1 ottobre 2026 Marco mi ha scritto.', subject: 'undecided', candidates: ['C1', 'C2'], question: 'Quale Marco ti ha scritto?', evidence: [1] }],
    });
    const [q] = await db.query(`SELECT id, status FROM clarifications WHERE question = 'Quale Marco ti ha scritto?'`);
    expect(q.status).toBe('open');
    expect((await context('Marco', '2026-10-02T10:00:00+02:00')).body.block).toContain('if natural, ask: Quale Marco ti ha scritto?');
    await extract('x2', [{ id: 'x2-1', content: 'Oggi piove.', at: '2026-10-16T10:00:00+02:00' }], {});
    expect((await db.query(`SELECT status FROM clarifications WHERE id = $1`, [q.id]))[0].status).toBe('expired');
  });

  it('recall: items carry their subject; an identified speaker gets their own items first; others\' claims about me stay apart', async () => {
    // Giulia (identified) about herself, and Paolo (a display name only) about me.
    await extract('grp', [
      { id: 'grp-1', role: 'other', authorRef: 'g', content: 'Sabato 26 vado a Catania al concerto di Levante!', at: '2026-09-22T18:00:00+02:00' },
      { id: 'grp-2', role: 'other', authorRef: 'p', content: 'Andrea si è comprato una Tesla, dicono.', at: '2026-09-22T18:01:00+02:00' },
      { id: 'grp-3', content: 'Bella Giulia!', at: '2026-09-22T18:02:00+02:00' },
    ], {
      episodes: [
        { content: 'Giulia andrà a Catania al concerto di Levante sabato 26 settembre 2026.', kind: 'plan', occurred_at: '2026-09-26', subject: 'C2', people: ['Giulia'], evidence: [1] },
        { content: 'Paolo dice che mi sono comprato una Tesla.', subject: 'me', people: ['Paolo'], evidence: [2] },
      ],
      facts: [{ subject: 'me', key: 'car', value: 'Tesla', verdict: 'new', evidence: [2] }],
    }, [giulia, { ref: 'p', role: 'other', displayName: 'Paolo' }]);
    // A first name is not enough (owner's decision 2026-10-09): the identified Giulia is a new contact, and the memory
    // asks whether she is the sister it knew only by name.
    const sister = (await db.query(`SELECT id FROM persons WHERE owner_scope = $1 AND display_name = 'Giulia' AND relation = 'sorella'`, [me]))[0].id as string;
    const giulias = await db.query(`SELECT id FROM persons WHERE owner_scope = $1 AND display_name = 'Giulia' ORDER BY created_at`, [me]);
    expect(giulias).toHaveLength(2);
    const newcomer = giulias[1].id as string;
    const [ask] = await db.query(`SELECT id, question, candidates, contact_id, status, episode_id FROM clarifications WHERE contact_id IS NOT NULL`);
    expect(ask).toMatchObject({ question: 'Giulia, che ha scritto il 22 settembre, è la stessa persona di Giulia (sorella)?',
      candidates: [sister], contact_id: newcomer, status: 'open', episode_id: null });
    expect(await episode('%Levante%')).toMatchObject({ subject_kind: 'contact', subject: 'Giulia', stance: 'stated', author_role: 'other' });
    expect((await db.query(`SELECT subject_person_id FROM episodes WHERE content LIKE '%Levante%'`))[0].subject_person_id).toBe(newcomer);

    // A later window answers it: the same person → the new contact is merged into the sister (every reference moves).
    const answer = await ingest('grp-ans', [{ id: 'ga-1', content: 'La Giulia del gruppo è mia sorella.', at: '2026-09-22T19:00:00+02:00' }]);
    llm.queue.push({ answers: [{ question: 'Q1', contact: 'C1', evidence: [1] }] });
    await run(answer);
    expect(lastUser()).toContain('Q1: Giulia, che ha scritto il 22 settembre, è la stessa persona di Giulia (sorella)? (about: C2 — the same person as C1?; answer C1 if yes, C2 if not)');
    expect((await db.query(`SELECT status, resolved_person_id, resolution FROM clarifications WHERE id = $1`, [ask.id]))[0])
      .toEqual({ status: 'resolved', resolved_person_id: sister, resolution: 'same person' });
    expect(await db.query(`SELECT id FROM persons WHERE owner_scope = $1 AND display_name = 'Giulia'`, [me])).toEqual([{ id: sister }]);
    expect(await db.query(`SELECT person_id FROM external_identities WHERE external_id = 'giulia-1'`)).toEqual([{ person_id: sister }]);
    expect(await db.query(`SELECT author_person_id FROM messages WHERE external_id = 'grp-1'`)).toEqual([{ author_person_id: sister }]);
    expect(await db.query(`SELECT person_id FROM conversation_participants WHERE ref = 'g'`)).toEqual([{ person_id: sister }]);
    expect((await db.query(`SELECT subject_person_id FROM episodes WHERE content LIKE '%Levante%'`))[0].subject_person_id).toBe(sister);
    expect(await db.query(`SELECT alias_norm FROM person_aliases WHERE person_id = $1`, [sister])).toEqual([{ alias_norm: 'giulia' }]);
    expect(await episode('%Levante%')).toMatchObject({ content: 'Giulia andrà a Catania al concerto di Levante sabato 26 settembre 2026.' });
    expect(await episode('%Tesla%')).toMatchObject({ subject_kind: 'self', stance: 'inferred' });
    expect(await db.query(`SELECT pending FROM facts WHERE value = 'Tesla'`)).toEqual([{ pending: true }]);

    const connect = async (headers: Record<string, string>) => {
      const client = new Client({ name: 't', version: '1' });
      await client.connect(new StreamableHTTPClientTransport(new URL(`${url}/mcp`), { requestInit: { headers } }));
      return client;
    };
    // An undeclared asker (personal token, no conversation): the self.
    const mine = await connect({ authorization: `Bearer ${token}`, 'x-recordare-now': '2026-09-23T10:00:00+02:00' });
    const out = (await mine.callTool({ name: 'search_episodes', arguments: { query: 'concerto Levante Tesla' } })).structuredContent as Record<string, unknown>;
    expect(out['memory']).toEqual({ name: 'Andrea', mode: 'personal' });
    expect(out['speaker']).toEqual({ kind: 'self' });
    expect((out['episodes'] as Array<{ content: string; subject: unknown }>).find((e) => e.content.includes('Levante'))?.subject).toEqual({ kind: 'contact', name: 'Giulia' });
    expect((out['claims'] as Array<{ content: string; claimedBy: string[] }>).map((c) => [c.content, c.claimedBy])).toEqual([['Paolo dice che mi sono comprato una Tesla.', ['Paolo']]]);
    await mine.close();

    // Giulia asks in her own conversation: she is the speaker, her items come first.
    await ingest('ask-g', [{ id: 'ask-g-1', role: 'other', authorRef: 'g', content: 'Cosa faccio sabato?', at: '2026-09-23T10:00:00+02:00' }], [giulia]);
    await db.query(`INSERT INTO episodes (owner_id, kind, content, occurred_at, date_precision, origin, author_role, stance, audience)
      VALUES ($1, 'event', 'Sabato cosa faccio: vado al mare.', '2026-09-26', 'day', 'owner_lived', 'owner', 'stated', $2)`, [me, [me]]);
    const hers = await connect({ authorization: `Bearer ${token}`, 'x-recordare-now': '2026-09-23T10:00:01+02:00', 'x-recordare-conversation': 'ask-g' });
    const res = (await hers.callTool({ name: 'search_episodes', arguments: { query: 'Cosa faccio sabato?' } })).structuredContent as Record<string, unknown>;
    expect(res['speaker']).toEqual({ kind: 'contact', name: 'Giulia' });
    expect((res['episodes'] as Array<{ subject: { kind: string } }>)[0]?.subject).toEqual({ kind: 'contact', name: 'Giulia' });
    expect((res['notes'] as string[]).some((n) => n.includes('chi chiede è Giulia'))).toBe(true);
    const memory = (await hers.callTool({ name: 'search_memory', arguments: { query: 'nuoto agonistico' } })).structuredContent as Record<string, unknown>;
    expect(memory['speaker']).toEqual({ kind: 'contact', name: 'Giulia' });
    expect((memory['notes'] as Array<{ subject: unknown }>)[0]?.subject).toEqual({ kind: 'contact', name: 'Giulia' });
    await hers.close();
  });

  it('a personal window of other people only costs a call; assistant and tool turns alone do not', async () => {
    const before = llm.requests.length;
    await extract('only-others', [{ id: 'oo-1', role: 'other', authorRef: 'g', content: 'Domani piove.', at: '2026-09-25T10:00:00+02:00' }], {}, [giulia]);
    expect(llm.requests.length).toBe(before + 1);
    const id = await ingest('only-assistant', [{ id: 'oa-1', role: 'assistant', content: 'Promemoria: dentista.', at: '2026-09-25T11:00:00+02:00' }]);
    await run(id);
    expect(llm.requests.length).toBe(before + 1);
  });

  it('drops an item about a contact the window neither names nor hears from (no carry-over)', async () => {
    await extract('co', [{ id: 'co-1', content: 'Oggi giornata tranquilla.', at: '2026-09-26T10:00:00+02:00' }], {
      episodes: [{ content: 'Marco Bellini è tornato dalle ferie.', subject: 'Marco Bellini', evidence: [1] }],
    });
    expect(await episode('%tornato dalle ferie%')).toBeUndefined();
  });

  it('identified participants: a unique full name binds; several namesakes ask nothing; a "no" keeps two contacts', async () => {
    const before = await db.query(`SELECT count(*)::int AS n FROM clarifications WHERE contact_id IS NOT NULL`);
    const bellini = (await db.query(`SELECT id FROM persons WHERE owner_scope = $1 AND full_name = 'Marco Bellini'`, [me]))[0].id as string;
    // Full name equal to exactly one contact without an identity: the same person, bound directly.
    await ingest('fn', [{ id: 'fn-1', role: 'other', authorRef: 'mb', content: 'Ciao!', at: '2026-09-28T10:00:00+02:00' }],
      [{ ref: 'mb', role: 'other', displayName: 'Marco Bellini', identity: { externalUserId: 'mb-1' } }]);
    expect(await db.query(`SELECT person_id FROM external_identities WHERE external_id = 'mb-1'`)).toEqual([{ person_id: bellini }]);
    expect(await db.query(`SELECT author_person_id FROM messages WHERE external_id = 'fn-1'`)).toEqual([{ author_person_id: bellini }]);
    // Two unbound Lucas (brother, neighbour): a new contact, no question.
    const lucas = (await contacts()).filter((c: { display_name: string }) => c.display_name === 'Luca').length;
    await ingest('lu', [{ id: 'lu-1', role: 'other', authorRef: 'l', content: 'Ci sono anch\'io.', at: '2026-09-28T11:00:00+02:00' }],
      [{ ref: 'l', role: 'other', displayName: 'Luca', identity: { externalUserId: 'luca-1' } }]);
    expect((await contacts()).filter((c: { display_name: string }) => c.display_name === 'Luca')).toHaveLength(lucas + 1);
    expect(await db.query(`SELECT count(*)::int AS n FROM clarifications WHERE contact_id IS NOT NULL`)).toEqual(before);
    // One unbound Marco (the cousin; Bellini is now bound): a new contact and a question; answered "no", both stay.
    const cousin = (await db.query(`SELECT id FROM persons WHERE owner_scope = $1 AND display_name = 'Marco' AND relation = 'cugino'`, [me]))[0].id as string;
    await ingest('mx', [{ id: 'mx-1', role: 'other', authorRef: 'm', content: 'Sono Marco del calcetto.', at: '2026-09-28T12:00:00+02:00' }],
      [{ ref: 'm', role: 'other', displayName: 'Marco', identity: { externalUserId: 'marco-x' } }]);
    const marco = (await db.query(`SELECT person_id FROM external_identities WHERE external_id = 'marco-x'`))[0].person_id as string;
    expect(marco).not.toBe(cousin);
    const [q] = await db.query(`SELECT id, question, candidates FROM clarifications WHERE contact_id = $1`, [marco]);
    expect(q).toMatchObject({ question: 'Marco, che ha scritto il 28 settembre, è la stessa persona di Marco (cugino)?', candidates: [cousin] });
    const no = await ingest('mx-ans', [{ id: 'mxa-1', content: 'No, il Marco del calcetto non è mio cugino.', at: '2026-09-28T13:00:00+02:00' }]);
    // Listed: C1 the cousin, C2 Bellini (also called Marco), C3 the new Marco.
    llm.queue.push({ answers: [{ question: 'Q1', contact: 'C3', evidence: [1] }] });
    await run(no);
    expect(lastUser()).toContain('Q1: Marco, che ha scritto il 28 settembre, è la stessa persona di Marco (cugino)? (about: C3 — the same person as C1?; answer C1 if yes, C3 if not)');
    expect((await db.query(`SELECT status, resolved_person_id, resolution FROM clarifications WHERE id = $1`, [q.id]))[0])
      .toEqual({ status: 'resolved', resolved_person_id: marco, resolution: 'different person' });
    expect(await db.query(`SELECT id FROM persons WHERE id = ANY($1::uuid[]) ORDER BY created_at`, [[cousin, marco]])).toEqual([{ id: cousin }, { id: marco }]);
  });

  it('mergeContacts moves every reference (arrays, facts, questions) and deletes the merged contact', async () => {
    const [{ id: a }] = await db.query(`INSERT INTO persons (owner_scope, display_name, relation) VALUES ($1, 'Sara', 'amica') RETURNING id`, [me]);
    const [{ id: b }] = await db.query(`INSERT INTO persons (owner_scope, display_name, full_name) VALUES ($1, 'Sara', 'Sara Neri') RETURNING id`, [me]);
    await db.query(`INSERT INTO person_aliases (owner_id, person_id, alias, alias_norm, source) VALUES ($1, $2, 'Sara', 'sara', 'extracted'),
      ($1, $3, 'Sara', 'sara', 'client'), ($1, $3, 'Sarina', 'sarina', 'client')`, [me, a, b]);
    const ins = (sql: string, params: unknown[]) => db.query(sql, params).then((r) => r[0].id as string);
    const ep = await ins(`INSERT INTO episodes (owner_id, kind, content, origin, author_role, stance, audience, subject_kind, subject_candidates)
      VALUES ($1, 'event', 'Sara ha traslocato.', 'owner_told', 'owner', 'stated', $2, 'undecided', $3) RETURNING id`, [me, [me, b], [a, b]]);
    await db.query(`INSERT INTO episode_people (episode_id, alias, person_id) VALUES ($1, 'Sara', $2)`, [ep, b]);
    const old = await ins(`INSERT INTO facts (owner_id, subject_person_id, key, value, origin, author_role, audience, subject_kind, recorded_at)
      VALUES ($1, $2, 'city', 'Roma', 'owner_told', 'owner', $3, 'contact', '2026-09-01') RETURNING id`, [me, a, [me]]);
    const recent = await ins(`INSERT INTO facts (owner_id, subject_person_id, key, value, origin, author_role, audience, subject_kind, recorded_at, confidence_of)
      VALUES ($1, $2, 'city', 'Milano', 'owner_told', 'owner', $3, 'contact', '2026-09-20', $2) RETURNING id`, [me, b, [me, b]]);
    const which = await ins(`INSERT INTO clarifications (owner_id, question, candidates, episode_id, created_at) VALUES ($1, 'Quale Sara?', $2, $3, '2026-09-29') RETURNING id`, [me, [a, b], ep]);
    const same = await ins(`INSERT INTO clarifications (owner_id, question, candidates, contact_id, created_at) VALUES ($1, 'Stessa Sara?', $2, $3, '2026-09-29') RETURNING id`, [me, [a], b]);
    expect(await db.transaction((tx) => mergeContacts(tx, me, b, a, new Date('2026-09-30T10:00:00Z')))).toBe(true);

    expect(await db.query(`SELECT id, full_name, relation FROM persons WHERE id = ANY($1::uuid[])`, [[a, b]])).toEqual([{ id: a, full_name: 'Sara Neri', relation: 'amica' }]);
    expect((await db.query(`SELECT alias_norm FROM person_aliases WHERE person_id = $1 ORDER BY alias_norm`, [a])).map((r: { alias_norm: string }) => r.alias_norm)).toEqual(['sara', 'sarina']);
    expect((await db.query(`SELECT subject_kind, subject_person_id, subject_candidates, audience FROM episodes WHERE id = $1`, [ep]))[0])
      .toEqual({ subject_kind: 'contact', subject_person_id: a, subject_candidates: [], audience: [me, a] });
    expect(await db.query(`SELECT person_id FROM episode_people WHERE episode_id = $1`, [ep])).toEqual([{ person_id: a }]);
    expect(await db.query(`SELECT id, subject_person_id, status, audience, confidence_of FROM facts WHERE id = ANY($1::uuid[]) ORDER BY recorded_at`, [[old, recent]])).toEqual([
      { id: old, subject_person_id: a, status: 'superseded', audience: [me], confidence_of: null },
      { id: recent, subject_person_id: a, status: 'current', audience: [me, a], confidence_of: a },
    ]);
    expect(await db.query(`SELECT id, status, candidates, resolved_person_id, contact_id FROM clarifications WHERE id = ANY($1::uuid[]) ORDER BY question`, [[which, same]])).toEqual([
      { id: which, status: 'resolved', candidates: [a], resolved_person_id: a, contact_id: null },
      { id: same, status: 'resolved', candidates: [], resolved_person_id: a, contact_id: a },
    ]);
  });

  it('writes the gender of the first person in the prompt', async () => {
    expect((await call(url, 'PATCH', '/api/v1/me', { token: key, headers: { 'x-recordare-user': 'andrea' }, body: { gender: 'feminine' } })).status).toBe(204);
    const prompt = await extract('gen', [{ id: 'gen-1', content: 'Sono stanca.', at: '2026-09-27T10:00:00+02:00' }], {});
    expect(prompt).toMatch(/^ME: Andrea — gender feminine/);
  });
});
