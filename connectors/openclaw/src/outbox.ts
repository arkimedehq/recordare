// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * The durable retry queue: captured messages that could not be sent wait on disk, one JSON file per batch
 * (`<stateDir>/recordare/outbox/<age>-<id>.json`, owner-only), so a Gateway restart or crash does not lose them. Only
 * failed sends are written: a batch Recordare accepted at once never touches the disk. Without a usable folder the
 * queue stays in memory (as before), with one warning.
 */
import { randomBytes } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IngestRequest } from '@arkimedehq/recordare-client';

export interface Pending { id: string; user: string; req: IngestRequest; attempts: number }

const FILE = /^\d{15}-[0-9a-f]{12}\.json$/;

/** A new batch id that sorts by age. */
export function pendingId(now = Date.now()): string {
  return `${String(now).padStart(15, '0')}-${randomBytes(6).toString('hex')}`;
}

export class Outbox {
  private dir: string | null;

  constructor(dir: string | null, private readonly warn: (msg: string) => void) {
    this.dir = dir;
    if (!dir) return;
    try {
      mkdirSync(dir, { recursive: true, mode: 0o700 });
    } catch (err) {
      this.disable(err);
    }
  }

  get durable(): boolean { return this.dir !== null; }

  /** The batches left by a previous run, oldest first; unreadable files are dropped (logged). */
  load(): Pending[] {
    if (!this.dir) return [];
    let names: string[];
    try {
      names = readdirSync(this.dir).filter((n) => FILE.test(n)).sort();
    } catch (err) {
      this.disable(err);
      return [];
    }
    const out: Pending[] = [];
    for (const name of names) {
      const path = join(this.dir, name);
      try {
        const p = JSON.parse(readFileSync(path, 'utf8')) as Pending;
        if (typeof p.user !== 'string' || !Array.isArray(p.req?.messages)) throw new Error('not a batch');
        out.push({ ...p, id: name.slice(0, -'.json'.length) });
      } catch {
        this.warn(`recordare: dropped an unreadable queued batch (${name})`);
        try { unlinkSync(path); } catch { /* already gone */ }
      }
    }
    return out;
  }

  /** Writes (or rewrites) a batch atomically: a temporary file renamed over the old one. */
  save(p: Pending): void {
    if (!this.dir) return;
    const path = join(this.dir, `${p.id}.json`);
    try {
      writeFileSync(`${path}.tmp`, JSON.stringify(p), { mode: 0o600 });
      renameSync(`${path}.tmp`, path);
    } catch (err) {
      this.disable(err);
    }
  }

  remove(p: Pending): void {
    if (!this.dir) return;
    try { unlinkSync(join(this.dir, `${p.id}.json`)); } catch { /* never written, or already gone */ }
  }

  private disable(err: unknown): void {
    this.warn(`recordare: retry queue kept in memory only, its folder is not usable (${err instanceof Error ? err.message : 'error'})`);
    this.dir = null;
  }
}
