// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Atlas snapshot (M5b.2): the map the dashboard starts from — one owner's memories as a network. Episodes are the
 * neurons (placed by meaning: the first three principal components of their embeddings), edges are real relations
 * (nearest neighbours in meaning, corrections, duplicates, plan → outcome, shared people), facts / notes / digests are
 * the cortex. Metadata only, never content (the same rule as the telemetry stream).
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface AtlasEpisode { id: string; kind: string; authorRole: string; importance: number; day: string | null; precision: string;
  planStatus: string | null; hidden: 'duplicate' | 'invalidated' | null; xyz: [number, number, number] }
export interface AtlasEdge { a: string; b: string; kind: 'similar' | 'corrects' | 'duplicate' | 'outcome' | 'rescheduled' | 'people' }
export interface AtlasSnapshot {
  owner: { id: string; name: string }; generatedAt: string;
  episodes: AtlasEpisode[]; edges: AtlasEdge[];
  facts: Array<{ id: string; key: string; status: string }>;
  notes: Array<{ id: string; category: string; pending: boolean }>;
  digests: Array<{ id: string; level: string; period: string }>;
  /** Lifetime totals of the owner (so the dashboard counters never restart from zero). */
  totals: { llmCalls: number; inputTokens: number; outputTokens: number; recalls: number };
}

const NEIGHBOURS = 3;
const MAX_EPISODES = 4000;

@Injectable()
export class AtlasService {
  constructor(private readonly db: DataSource) {}

  async owners(): Promise<Array<{ id: string; name: string; episodes: number; lastActivity: string | null }>> {
    return this.db.query(
      `SELECT o.person_id AS id, p.display_name AS name,
              (SELECT count(*)::int FROM episodes e WHERE e.owner_id = o.person_id AND e.deleted_at IS NULL) AS episodes,
              (SELECT max(m.received_at) FROM messages m WHERE m.owner_id = o.person_id) AS "lastActivity"
       FROM owners o JOIN persons p ON p.id = o.person_id
       ORDER BY "lastActivity" DESC NULLS LAST LIMIT 200`);
  }

  async snapshot(ownerId: string): Promise<AtlasSnapshot> {
    const [owner] = await this.db.query(
      `SELECT o.person_id AS id, p.display_name AS name, o.timezone FROM owners o JOIN persons p ON p.id = o.person_id WHERE o.person_id = $1`, [ownerId]);
    if (!owner) throw new NotFoundException();
    const rows: Array<{ id: string; kind: string; author_role: string; importance: number; day: string | null; date_precision: string;
      plan_status: string | null; duplicate_of: string | null; invalidated: boolean; corrects: string | null; confirmed_by: string | null;
      rescheduled_to: string | null; embedding: string | null }> = await this.db.query(
      `SELECT id, kind, author_role, importance, (occurred_at AT TIME ZONE $2)::date::text AS day, date_precision, plan_status, duplicate_of,
              invalidated_at IS NOT NULL AS invalidated, corrects, confirmed_by, rescheduled_to, embedding::text
       FROM episodes WHERE owner_id = $1 AND deleted_at IS NULL ORDER BY recorded_at DESC LIMIT $3`, [ownerId, owner.timezone, MAX_EPISODES]);
    const ids = new Set(rows.map((r) => r.id));
    const vectors = rows.map((r) => (r.embedding ? (JSON.parse(r.embedding) as number[]) : null));
    const xyz = layout(vectors);

    const edges: AtlasEdge[] = [];
    const add = (a: string | null, b: string | null, kind: AtlasEdge['kind']) => { if (a && b && ids.has(a) && ids.has(b) && a !== b) edges.push({ a, b, kind }); };
    for (const r of rows) {
      add(r.id, r.corrects, 'corrects'); add(r.id, r.duplicate_of, 'duplicate');
      add(r.id, r.confirmed_by, 'outcome'); add(r.id, r.rescheduled_to, 'rescheduled');
    }
    const near: Array<{ a: string; b: string }> = await this.db.query(
      `SELECT e.id AS a, n.id AS b FROM episodes e
       CROSS JOIN LATERAL (SELECT x.id FROM episodes x WHERE x.owner_id = e.owner_id AND x.id <> e.id AND x.deleted_at IS NULL AND x.embedding IS NOT NULL
                           ORDER BY x.embedding <=> e.embedding LIMIT $2) n
       WHERE e.owner_id = $1 AND e.deleted_at IS NULL AND e.embedding IS NOT NULL`, [ownerId, NEIGHBOURS]);
    for (const n of near) add(n.a, n.b, 'similar');
    const people: Array<{ a: string; b: string }> = await this.db.query(
      `SELECT p1.episode_id AS a, p2.episode_id AS b FROM episode_people p1
       JOIN episode_people p2 ON lower(p1.alias) = lower(p2.alias) AND p1.episode_id < p2.episode_id
       JOIN episodes e1 ON e1.id = p1.episode_id JOIN episodes e2 ON e2.id = p2.episode_id
       WHERE e1.owner_id = $1 AND e2.owner_id = $1 AND e1.deleted_at IS NULL AND e2.deleted_at IS NULL LIMIT 20000`, [ownerId]);
    for (const p of people) add(p.a, p.b, 'people');

    const facts = await this.db.query(`SELECT id, key, status FROM facts WHERE owner_id = $1 AND deleted_at IS NULL ORDER BY key, valid_from NULLS FIRST`, [ownerId]);
    const notes = await this.db.query(`SELECT id, category, pending FROM notes WHERE owner_id = $1 AND deleted_at IS NULL AND status = 'current'`, [ownerId]);
    const digests = await this.db.query(`SELECT id, level, period_start::text AS period FROM digests WHERE owner_id = $1 AND superseded_at IS NULL ORDER BY period_start`, [ownerId]);
    const [llm] = await this.db.query(
      `SELECT count(*)::int AS calls, coalesce(sum(input_tokens), 0)::bigint AS input, coalesce(sum(output_tokens), 0)::bigint AS output
       FROM llm_calls WHERE owner_id = $1`, [ownerId]);
    const [rec] = await this.db.query(`SELECT count(*)::int AS n FROM recall_log WHERE owner_id = $1`, [ownerId]);
    return {
      owner: { id: owner.id, name: owner.name }, generatedAt: new Date().toISOString(),
      episodes: rows.map((r, i) => ({
        id: r.id, kind: r.kind, authorRole: r.author_role, importance: r.importance, day: r.day, precision: r.date_precision, planStatus: r.plan_status,
        hidden: r.duplicate_of ? 'duplicate' : r.invalidated ? 'invalidated' : null, xyz: xyz[i] as [number, number, number],
      })),
      edges, facts, notes, digests,
      totals: { llmCalls: llm.calls, inputTokens: Number(llm.input), outputTokens: Number(llm.output), recalls: rec.n },
    };
  }
}

/**
 * Places items by meaning: the first three principal components of their embeddings (power iteration with
 * deflation), scaled to [-1, 1]. Items without an embedding sit at the origin.
 */
export function layout(vectors: Array<number[] | null>): Array<[number, number, number]> {
  const present = vectors.map((v, i) => [v, i] as const).filter((p): p is readonly [number[], number] => !!p[0]);
  const out: Array<[number, number, number]> = vectors.map(() => [0, 0, 0]);
  if (present.length < 2) return out;
  const d = present[0]![0].length;
  const mean = new Array<number>(d).fill(0);
  for (const [v] of present) for (let k = 0; k < d; k++) mean[k]! += v[k]! / present.length;
  const X = present.map(([v]) => v.map((x, k) => x - mean[k]!));
  const comps: number[][] = [];
  for (let c = 0; c < 3; c++) {
    let w = Array.from({ length: d }, (_, k) => Math.sin(k * (c + 1) + 1));
    for (let it = 0; it < 40; it++) {
      const s = X.map((row) => row.reduce((a, x, k) => a + x * w[k]!, 0));          // X w
      const next = new Array<number>(d).fill(0);
      X.forEach((row, i) => { for (let k = 0; k < d; k++) next[k]! += row[k]! * s[i]!; }); // Xᵀ X w
      for (const p of comps) { const dot = next.reduce((a, x, k) => a + x * p[k]!, 0); for (let k = 0; k < d; k++) next[k]! -= dot * p[k]!; }
      const norm = Math.hypot(...next) || 1;
      w = next.map((x) => x / norm);
    }
    comps.push(w);
  }
  const proj = X.map((row) => comps.map((w) => row.reduce((a, x, k) => a + x * w[k]!, 0)));
  for (let c = 0; c < 3; c++) {
    const m = Math.max(...proj.map((p) => Math.abs(p[c]!))) || 1;
    proj.forEach((p) => { p[c] = p[c]! / m; });
  }
  present.forEach(([, i], j) => { out[i] = proj[j] as [number, number, number]; });
  return out;
}
