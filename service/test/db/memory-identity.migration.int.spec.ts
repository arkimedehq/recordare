// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Migration MemoryIdentity (D50, WORK_PLAN 8.3) on data of the previous shape: mode from persons.kind, contacts created
 * where a person of another memory (or of none) appears, identities split into account / participant, every message
 * attributed, the subject of every memory row, and `down` back to the previous shape.
 */
import { DataSource } from 'typeorm';
import { dataSourceOptions, MIGRATIONS } from '../../src/db/data-source-options';
import { MemoryIdentity1791070000000 } from '../../src/db/migrations/1791070000000-MemoryIdentity';
import { testEnv } from '../helpers/app';

describe('migration MemoryIdentity (D50, WORK_PLAN 8.3)', () => {
  let db: DataSource;
  const ids: Record<string, string> = {};
  /** MemoryIdentity and the migrations after it (undone together by the `down` test). */
  const at = MIGRATIONS.indexOf(MemoryIdentity1791070000000);

  beforeAll(async () => {
    testEnv();
    const url = process.env['DATABASE_URL'] as string;
    const before = new DataSource({ ...dataSourceOptions(url), migrations: MIGRATIONS.slice(0, at) });
    await before.initialize();
    await before.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await before.runMigrations();
    await seed(before);
    await before.destroy();
    db = new DataSource(dataSourceOptions(url));
    await db.initialize();
    await db.runMigrations();
  });
  afterAll(async () => { await db?.destroy(); });

  const one = async (sql: string, params: unknown[] = []): Promise<string> => (await db.query(sql, params))[0]?.id as string;

  /** Previous shape: persons.kind, client_user / channel identities, the entity recorded as its user's author. */
  async function seed(q: DataSource): Promise<void> {
    const id = async (sql: string, params: unknown[] = []) => (await q.query(sql, params))[0].id as string;
    ids['client'] = await id(`INSERT INTO clients (name, kind) VALUES ('Arkimede', 'platform') RETURNING id`);
    const memory = async (name: string, kind: string, user: string) => {
      const p = await id(`INSERT INTO persons (display_name, kind) VALUES ($1, $2) RETURNING id`, [name, kind]);
      await q.query(`INSERT INTO owners (person_id) VALUES ($1)`, [p]);
      await q.query(`INSERT INTO external_identities (person_id, kind, client_id, external_id, verified_at) VALUES ($1, 'client_user', $2, $3, now())`,
        [p, ids['client'], user]);
      return p;
    };
    ids['andrea'] = await memory('Andrea', 'human', 'andrea');
    ids['arkim3de'] = await memory('Arkim3de', 'entity', 'arkim3de');
    // Persons of no memory: Ghost (referenced nowhere), Marco (a global Telegram binding, present in Andrea's chat).
    ids['ghost'] = await id(`INSERT INTO persons (display_name) VALUES ('Ghost') RETURNING id`);
    await q.query(`INSERT INTO external_identities (person_id, kind, client_id, external_id) VALUES ($1, 'client_user', $2, 'ghost')`, [ids['ghost'], ids['client']]);
    ids['marco'] = await id(`INSERT INTO persons (display_name) VALUES ('Marco') RETURNING id`);
    await q.query(`INSERT INTO external_identities (person_id, kind, channel, external_id, verified_at) VALUES ($1, 'channel', 'telegram', '111', now())`, [ids['marco']]);
    // A contact the writer created in the entity memory.
    ids['marta'] = await id(`INSERT INTO persons (owner_scope, display_name) VALUES ($1, 'Marta') RETURNING id`, [ids['arkim3de']]);

    const conversation = async (owner: string, ext: string, participants: Array<[string, string | null, string]>) => {
      const c = await id(`INSERT INTO conversations (owner_id, client_id, external_id, started_at, last_message_at) VALUES ($1, $2, $3, now(), now()) RETURNING id`,
        [owner, ids['client'], ext]);
      for (const [ref, person, role] of participants) {
        await q.query(`INSERT INTO conversation_participants (conversation_id, ref, person_id, role, display_name) VALUES ($1, $2, $3, $4, $2)`, [c, ref, person, role]);
      }
      return c;
    };
    const message = (c: string, owner: string, ext: string, role: string, author: string | null, ref: string | null) =>
      q.query(`INSERT INTO messages (conversation_id, owner_id, external_id, role, author_person_id, author_ref, content, content_hash, sent_at)
        VALUES ($1, $2, $3, $4, $5, $6, $3, sha256(convert_to($3::text, 'UTF8')), now())`, [c, owner, ext, role, author, ref]);

    const p = await conversation(ids['andrea'], 'p1', [['owner', ids['andrea'], 'owner'], ['assistant', null, 'assistant'], ['marco', ids['marco'], 'other'], ['guest', null, 'other']]);
    await message(p, ids['andrea'], 'p-user', 'user', ids['andrea'], 'owner');
    await message(p, ids['andrea'], 'p-assistant', 'assistant', null, 'assistant');
    await message(p, ids['andrea'], 'p-tool', 'tool', null, 'assistant');
    await message(p, ids['andrea'], 'p-marco', 'other', ids['marco'], 'marco');
    await message(p, ids['andrea'], 'p-guest', 'other', null, 'guest');
    const e = await conversation(ids['arkim3de'], 'e1', [['owner', ids['arkim3de'], 'owner'], ['user:andrea', ids['andrea'], 'other']]);
    await message(e, ids['arkim3de'], 'e-user', 'user', ids['arkim3de'], 'owner');
    await message(e, ids['arkim3de'], 'e-andrea', 'other', ids['andrea'], 'user:andrea');

    const episode = async (owner: string, content: string, people: string[], audience: string[]) => {
      const ep = await id(`INSERT INTO episodes (owner_id, kind, content, origin, author_role, audience) VALUES ($1, 'event', $2, 'owner_lived', 'owner', $3) RETURNING id`,
        [owner, content, audience]);
      for (const alias of people) await q.query(`INSERT INTO episode_people (episode_id, alias) VALUES ($1, $2)`, [ep, alias]);
      return ep;
    };
    ids['p-episode'] = await episode(ids['andrea'], 'Cena con Marco', ['Marco'], [ids['andrea'], ids['marco']]);
    ids['e-marta'] = await episode(ids['arkim3de'], 'Marta ha cucinato', ['Marta (figlia)'], [ids['arkim3de'], ids['andrea']]);
    ids['e-andrea'] = await episode(ids['arkim3de'], 'Andrea è tornato', ['Andrea'], [ids['arkim3de'], ids['andrea']]);
    ids['e-both'] = await episode(ids['arkim3de'], 'Marta e Andrea al mare', ['Marta', 'Andrea'], [ids['arkim3de']]);
    ids['e-none'] = await episode(ids['arkim3de'], 'Qualcuno ha acceso la luce', [], [ids['arkim3de']]);
    await q.query(`INSERT INTO fact_slots (key, description, cardinality) VALUES ('spare_keys_location', 'x', 'single') ON CONFLICT DO NOTHING`);
    await q.query(`INSERT INTO facts (owner_id, key, value, verdict, origin, author_role, audience) VALUES ($1, 'car', 'Golf', 'new', 'owner_lived', 'owner', $2)`,
      [ids['andrea'], [ids['andrea']]]);
    await q.query(`INSERT INTO facts (owner_id, key, value, verdict, origin, author_role, audience, subject_person_id)
      VALUES ($1, 'car', 'Clio', 'new', 'owner_lived', 'owner', $2, $3), ($1, 'spare_keys_location', 'cassetto', 'new', 'owner_lived', 'owner', $2, NULL)`,
      [ids['arkim3de'], [ids['arkim3de']], ids['marta']]);
    for (const owner of [ids['andrea'], ids['arkim3de']]) {
      await q.query(`INSERT INTO notes (owner_id, category, content, origin, author_role, audience) VALUES ($1, 'preference', 'jazz', 'owner_lived', 'owner', $2)`,
        [owner, [owner]]);
    }
  }

  it('moves the kind of memory to memories.mode, with the default gender', async () => {
    expect(await db.query(`SELECT person_id, mode, gender FROM memories ORDER BY mode`)).toEqual([
      { person_id: ids['andrea'], mode: 'personal', gender: 'masculine' },
      { person_id: ids['arkim3de'], mode: 'entity', gender: 'masculine' },
    ]);
    expect(await db.query(`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'persons' AND column_name = 'kind'`)).toEqual([{ n: 0 }]);
  });

  it('creates the contacts each memory references and moves every reference to them', async () => {
    const marco = await one(`SELECT id FROM persons WHERE memory_id = $1 AND display_name = 'Marco'`, [ids['andrea']]);
    const andreaHere = await one(`SELECT id FROM persons WHERE memory_id = $1 AND display_name = 'Andrea'`, [ids['arkim3de']]);
    expect(marco).toBeTruthy();
    expect(andreaHere).toBeTruthy();
    // Persons of no memory are gone (Ghost with its identity, Marco replaced by his contact row).
    expect(await db.query(`SELECT id FROM persons WHERE id = ANY($1)`, [[ids['ghost'], ids['marco']]])).toEqual([]);
    expect(await db.query(`SELECT count(*)::int AS n FROM persons p WHERE p.memory_id IS NULL`)).toEqual([{ n: 2 }]);
    // Identities: the accounts open the memories; participant ids name the contacts inside one memory.
    expect(await db.query(`SELECT i.kind, i.memory_id, i.person_id, i.channel, i.external_id, i.verified_at IS NOT NULL AS verified
      FROM external_identities i ORDER BY i.kind, i.external_id`)).toEqual([
      { kind: 'account', memory_id: null, person_id: ids['andrea'], channel: null, external_id: 'andrea', verified: true },
      { kind: 'account', memory_id: null, person_id: ids['arkim3de'], channel: null, external_id: 'arkim3de', verified: true },
      { kind: 'participant', memory_id: ids['andrea'], person_id: marco, channel: 'telegram', external_id: '111', verified: true },
      { kind: 'participant', memory_id: ids['arkim3de'], person_id: andreaHere, channel: null, external_id: 'andrea', verified: true },
    ]);
    expect(await db.query(`SELECT person_id, alias, alias_norm FROM person_aliases ORDER BY alias`)).toEqual([
      { person_id: andreaHere, alias: 'Andrea', alias_norm: 'andrea' },
      { person_id: marco, alias: 'Marco', alias_norm: 'marco' },
      { person_id: ids['marta'], alias: 'Marta', alias_norm: 'marta' },
    ]);
    expect(await db.query(`SELECT ref, person_id FROM conversation_participants ORDER BY ref`)).toEqual([
      { ref: 'assistant', person_id: null },
      { ref: 'guest', person_id: null },
      { ref: 'marco', person_id: marco },
      { ref: 'holder', person_id: ids['andrea'] },
      { ref: 'holder', person_id: null }, // entity memory: its user is not the entity
      { ref: 'user:andrea', person_id: andreaHere },
    ].sort((a, b) => a.ref.localeCompare(b.ref)));
    expect(await db.query(`SELECT audience FROM episodes WHERE id = $1`, [ids['e-marta']])).toEqual([{ audience: [ids['arkim3de'], andreaHere] }]);
    expect(await db.query(`SELECT audience FROM episodes WHERE id = $1`, [ids['p-episode']])).toEqual([{ audience: [ids['andrea'], marco] }]);
    // A human that is neither a memory nor a contact is refused from now on.
    await expect(db.query(`INSERT INTO persons (display_name) VALUES ('x')`)).rejects.toThrow(/memory_id is required/);
  });

  it('attributes every message: personal self / agent / tool / contact / someone; entity someone unless identified', async () => {
    const marco = await one(`SELECT id FROM persons WHERE memory_id = $1 AND display_name = 'Marco'`, [ids['andrea']]);
    const andreaHere = await one(`SELECT id FROM persons WHERE memory_id = $1 AND display_name = 'Andrea'`, [ids['arkim3de']]);
    expect(await db.query(`SELECT external_id AS id, author_kind AS kind, author_person_id AS person, attribution_method AS method,
      attribution_confidence AS confidence FROM messages ORDER BY external_id`)).toEqual([
      { id: 'e-andrea', kind: 'contact', person: andreaHere, method: 'client_assertion', confidence: 1 },
      { id: 'e-user', kind: 'someone', person: null, method: 'none', confidence: null },
      { id: 'p-assistant', kind: 'agent', person: null, method: 'client_assertion', confidence: 1 },
      { id: 'p-guest', kind: 'someone', person: null, method: 'none', confidence: null },
      { id: 'p-marco', kind: 'contact', person: marco, method: 'declared', confidence: 1 },
      { id: 'p-tool', kind: 'tool', person: null, method: 'client_assertion', confidence: 1 },
      { id: 'p-user', kind: 'self', person: ids['andrea'], method: 'account', confidence: 1 },
    ]);
  });

  it('records whose each memory is', async () => {
    const andreaHere = await one(`SELECT id FROM persons WHERE memory_id = $1 AND display_name = 'Andrea'`, [ids['arkim3de']]);
    const episodes = await db.query(`SELECT id, subject_kind, subject_person_id, subject_candidates FROM episodes`);
    const subject = (id: string) => episodes.find((e: { id: string }) => e.id === id);
    expect(subject(ids['p-episode'] as string)).toMatchObject({ subject_kind: 'self', subject_person_id: null, subject_candidates: [] });
    expect(subject(ids['e-marta'] as string)).toMatchObject({ subject_kind: 'contact', subject_person_id: ids['marta'] });
    expect(subject(ids['e-andrea'] as string)).toMatchObject({ subject_kind: 'contact', subject_person_id: andreaHere });
    expect(subject(ids['e-both'] as string)).toMatchObject({ subject_kind: 'someone', subject_person_id: null }); // two known contacts
    expect(subject(ids['e-none'] as string)).toMatchObject({ subject_kind: 'someone', subject_person_id: null });
    expect(await db.query(`SELECT memory_id, value, subject_kind, subject_person_id FROM facts ORDER BY value`)).toEqual([
      { memory_id: ids['arkim3de'], value: 'cassetto', subject_kind: 'self', subject_person_id: null },
      { memory_id: ids['arkim3de'], value: 'Clio', subject_kind: 'contact', subject_person_id: ids['marta'] },
      { memory_id: ids['andrea'], value: 'Golf', subject_kind: 'self', subject_person_id: null },
    ].sort((a, b) => a.value.localeCompare(b.value)));
    expect(await db.query(`SELECT memory_id, subject_kind FROM notes ORDER BY subject_kind`)).toEqual([
      { memory_id: ids['andrea'], subject_kind: 'self' }, { memory_id: ids['arkim3de'], subject_kind: 'someone' },
    ]);
    expect(await db.query(`SELECT count(*)::int AS n FROM clarifications`)).toEqual([{ n: 0 }]);
  });

  it('goes back to the previous shape (down)', async () => {
    for (let i = MIGRATIONS.length; i > at; i--) await db.undoLastMigration();
    expect(await db.query(`SELECT p.display_name, p.kind FROM persons p JOIN owners o ON o.person_id = p.id ORDER BY 1`)).toEqual([
      { display_name: 'Andrea', kind: 'human' }, { display_name: 'Arkim3de', kind: 'entity' },
    ]);
    expect(await db.query(`SELECT kind, external_id FROM external_identities ORDER BY kind, external_id`)).toEqual([
      { kind: 'client_user', external_id: 'andrea' }, { kind: 'client_user', external_id: 'arkim3de' }, { kind: 'channel', external_id: '111' },
    ]);
    expect(await db.query(`SELECT author_person_id FROM messages WHERE external_id = 'e-user'`)).toEqual([{ author_person_id: ids['arkim3de'] }]);
    const columns = await db.query(`SELECT table_name, column_name FROM information_schema.columns
      WHERE column_name IN ('mode', 'gender', 'author_kind', 'subject_kind', 'full_name') AND table_schema = 'public' AND table_name <> 'recall_log'`);
    expect(columns).toEqual([]);
    expect(await db.query(`SELECT to_regclass('clarifications') AS t`)).toEqual([{ t: null }]);
    await db.runMigrations(); // and up again on the migrated data
    expect(await db.query(`SELECT author_kind FROM messages WHERE external_id = 'e-user'`)).toEqual([{ author_kind: 'someone' }]);
  });
});
