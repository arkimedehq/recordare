// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Who each of the platform's users is in Recordare, cached: the person (ownerId), their consent, the kind of memory and
 * the Atlas address. The synchronous readers never wait on Recordare: they answer from the cache (even if stale) and
 * refresh in the background. Each lookup also keeps the person's name in sync with the platform's profile.
 */
import { type MemoryKind } from './contract.js';
import { type RecordareClient } from './client.js';

/** The person's memory as the platform shows it: consent given, not yet, or Recordare unreachable. */
export type ConsentState = 'waiting_activation' | 'active' | 'unknown';

export interface Person {
  ownerId: string | null;
  /** true / false, null = unknown (Recordare unreachable). */
  consent: boolean | null;
  kind: MemoryKind | null;
  atlasUrl: string | null;
}

export interface PersonDirectoryOptions {
  /** How long a lookup is trusted; default 5 minutes. */
  ttlMs?: number;
  /** The user's current profile name on the platform (null = unknown user: no rename). */
  profileName: (user: string) => Promise<string | null | undefined>;
  /** Called when a lookup or a rename fails (the cache keeps the last known person). */
  onError?: (user: string, err: unknown) => void;
}

interface Entry extends Person { until: number }

export class PersonDirectory {
  private readonly cache = new Map<string, Entry>();
  private readonly inflight = new Map<string, Promise<Person>>();

  constructor(private readonly client: RecordareClient, private readonly options: PersonDirectoryOptions) {}

  /** Last known person (possibly stale), or undefined; a stale or missing entry is refreshed in the background. */
  peek(user: string): Person | undefined {
    const hit = this.cache.get(user);
    if (!hit || hit.until <= Date.now()) void this.refresh(user).catch(() => undefined);
    if (!hit) return undefined;
    const { until: _until, ...person } = hit;
    return person;
  }

  /** A person known from the host's own storage (e.g. after a restart), marked stale so it is refreshed on first use. */
  seed(user: string, ownerId: string): void {
    if (!this.cache.has(user)) this.cache.set(user, { ownerId, consent: null, kind: null, atlasUrl: null, until: 0 });
  }

  /** Forgets a user (e.g. after their switch or name changed): the next read asks Recordare again. */
  invalidate(user: string): void {
    this.cache.delete(user);
  }

  /** Users whose consent is known to be off: a sender skips them (nothing is buffered before consent). */
  knownOff(): string[] {
    return [...this.cache].filter(([, e]) => e.consent === false).map(([u]) => u);
  }

  /** Re-checks now, waiting at most `timeoutMs`; falls back to the last known state. */
  async status(user: string, timeoutMs = 3_000): Promise<ConsentState> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fresh = await Promise.race([
      this.refresh(user).catch(() => undefined),
      new Promise<undefined>((r) => { timer = setTimeout(() => r(undefined), timeoutMs); }),
    ]);
    if (timer) clearTimeout(timer);
    const consent = (fresh ?? this.cache.get(user))?.consent ?? null;
    return consent === true ? 'active' : consent === false ? 'waiting_activation' : 'unknown';
  }

  /** Asks Recordare now (one request in flight per user). */
  refresh(user: string): Promise<Person> {
    const running = this.inflight.get(user);
    if (running) return running;
    const p = this.lookup(user).finally(() => this.inflight.delete(user));
    this.inflight.set(user, p);
    return p;
  }

  private async lookup(user: string): Promise<Person> {
    const ttl = this.options.ttlMs ?? 5 * 60 * 1_000;
    const remember = (p: Person): Person => {
      this.cache.set(user, { ...p, until: Date.now() + ttl });
      return p;
    };
    try {
      const me = await this.client.me(user);
      const name = (await this.options.profileName(user))?.trim().slice(0, 100);
      if (name && me.displayName !== name) {
        await this.client.updateMe(user, { displayName: name }).catch((err) => this.options.onError?.(user, err));
      }
      return remember({ ownerId: me.ownerId, consent: me.episodicEnabled, kind: me.kind, atlasUrl: me.atlasUrl ?? null });
    } catch (err) {
      this.options.onError?.(user, err);
      const last = this.cache.get(user);
      return remember({ ownerId: last?.ownerId ?? null, consent: null, kind: last?.kind ?? null, atlasUrl: last?.atlasUrl ?? null });
    }
  }
}
