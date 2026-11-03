// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import type { Charter } from '@arkimedehq/recordare-client';

/** How often a charter in hand is checked for a new version. */
const REFRESH_MS = 60 * 60_000;
/** While no charter could be read: at most one try per this interval (the turns never wait for it). */
const RETRY_MS = 30_000;

/**
 * The memory charter (D54, `GET api/v1/charter`) cached for the process: read once, re-read hourly and replaced only
 * when its version changes (the system prompt stays byte-identical, so the host's prompt caching keeps working).
 * `get()` never throws: when Recordare does not answer, the last charter read is used, or none.
 */
export class CharterCache {
  private value: Charter | null = null;
  private checkedAt = -Infinity;
  private inflight: Promise<void> | null = null;

  constructor(private readonly read: () => Promise<Charter>, private readonly now: () => number = Date.now) {}

  async get(): Promise<string | undefined> {
    const due = this.now() - this.checkedAt >= (this.value ? REFRESH_MS : RETRY_MS);
    if (due && !this.inflight) {
      this.checkedAt = this.now();
      this.inflight = this.read()
        .then((c) => {
          if (typeof c?.charter === 'string' && c.charter && c.version !== this.value?.version) this.value = c;
        }, () => undefined)
        .finally(() => { this.inflight = null; });
    }
    // The first read is awaited (the time-boxed client bounds it); later refreshes run in the background.
    if (!this.value && this.inflight) await this.inflight;
    return this.value?.charter;
  }

  /** The charter in hand, without asking Recordare (while it is known to be down). */
  cached(): string | undefined {
    return this.value?.charter;
  }
}
