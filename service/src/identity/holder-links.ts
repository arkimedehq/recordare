// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * D51 — the holder's channel identities, linked by one-time code with the holder's confirmation (WORK_PLAN 8.7).
 *
 * 1. The holder makes a code (`RCD-XXXX-XXXX`, ten minutes, one use) with a credential of their personal memory.
 * 2. They send it from the channel (e.g. a Telegram DM to the agent): the ingest that carries it records a *claim* — the
 *    sender's participant identity — and never stores the message. A code in a group chat (when the client says so) or
 *    from a sender without an identity claims nothing; five wrong codes cancel the memory's open codes.
 * 3. The holder confirms the claim (within seven days): the identity is bound to the memory's self
 *    (`external_identities`, verified), so that sender speaks as "I" from then on. Earlier messages keep their
 *    attribution (maintainer's choice 2026-10-14). Until confirmed, nothing changes. A linked identity can be unlinked.
 *
 * Connectors' own lists of the holder's senders (`selfSenders`, `SELF_IDS`, `SELF_USERS`) stay valid: explicit too.
 */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { createHash, randomInt } from 'node:crypto';
import { type EntityManager } from 'typeorm';

type Queryable = Pick<EntityManager, 'query'>;

/** Crockford base32: no I, L, O, U — read aloud or typed without mix-ups. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
/** A message that is only a link code (dashes and a final dot optional, any case). */
export const LINK_CODE = /^\s*RCD-?([0-9A-Z]{4})-?([0-9A-Z]{4})\.?\s*$/i;
export const CODE_TTL_MS = 10 * 60 * 1_000;
export const CLAIM_TTL_DAYS = 7;
export const MAX_FAILURES = 5;

export interface LinkCode { code: string; expiresAt: string }
export interface Claimant {
  identity: { channel: string; externalId: string } | { externalUserId: string };
  displayName?: string;
}

/** The code's hash, after Crockford's normalisation (O → 0, I / L → 1). */
function hashCode(groups: string): Buffer {
  const norm = groups.toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1');
  return createHash('sha256').update(norm).digest();
}

/** A new code for a personal memory; a code still unused is cancelled (one open code at a time). */
export async function createLinkCode(db: Queryable, memoryId: string, now: Date): Promise<LinkCode> {
  const [memory] = await db.query(`SELECT mode FROM memories WHERE person_id = $1`, [memoryId]);
  if (!memory) throw new NotFoundException();
  // In an entity memory "I" is the entity: no person's messages become its own.
  if (memory.mode !== 'personal') throw new ConflictException({ code: 'memory_not_personal' });
  const groups = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  const expiresAt = new Date(now.getTime() + CODE_TTL_MS);
  await db.query(`DELETE FROM link_codes WHERE memory_id = $1 AND claimed_at IS NULL`, [memoryId]);
  await db.query(`INSERT INTO link_codes (memory_id, code_hash, expires_at) VALUES ($1, $2, $3)`, [memoryId, hashCode(groups), expiresAt]);
  return { code: `RCD-${groups.slice(0, 4)}-${groups.slice(4)}`, expiresAt: expiresAt.toISOString() };
}

/**
 * Called by the ingest for each user / other message of a personal memory. Returns true when the message is a link code:
 * the caller drops it (a code is never stored). A valid code from an identified sender in a chat not known to be a group
 * becomes a claim; the same claim sent again (a retried batch) is accepted again; anything else counts as a failure.
 */
export async function claimLinkCode(
  db: Queryable, memoryId: string, clientId: string, content: string, sender: Claimant | null, direct: boolean | undefined, now: Date,
): Promise<boolean> {
  const m = content.match(LINK_CODE);
  if (!m) return false;
  // The holder already (no identity: the connector's own list, the CLI…), or a group chat: nothing to claim.
  if (!sender || direct === false) return true;
  const id = sender.identity;
  const clientUser = 'externalUserId' in id ? id.externalUserId : null;
  const channel = 'channel' in id ? id.channel : null;
  const externalId = clientUser ?? (id as { externalId: string }).externalId;
  const [row] = await db.query(
    `SELECT id, expires_at, claimed_at, claim_client_id, claim_channel, claim_external_id FROM link_codes
     WHERE memory_id = $1 AND code_hash = $2 FOR UPDATE`, [memoryId, hashCode(`${m[1]}${m[2]}`)]);
  if (row?.claimed_at) {
    const same = row.claim_external_id === externalId && (clientUser ? row.claim_client_id === clientId : row.claim_channel === channel);
    if (!same) await fail(db, memoryId, now);
    return true;
  }
  if (!row || row.expires_at <= now) {
    await fail(db, memoryId, now);
    return true;
  }
  await db.query(
    `UPDATE link_codes SET claimed_at = $2, claim_client_id = $3, claim_channel = $4, claim_external_id = $5, claim_display_name = $6
     WHERE id = $1`, [row.id, now, clientUser ? clientId : null, channel, externalId, sender.displayName?.trim().slice(0, 200) || null]);
  return true;
}

/** A wrong code: the memory's open codes count it, and the fifth cancels them. */
async function fail(db: Queryable, memoryId: string, now: Date): Promise<void> {
  await db.query(`UPDATE link_codes SET failures = failures + 1 WHERE memory_id = $1 AND claimed_at IS NULL AND expires_at > $2`, [memoryId, now]);
  await db.query(`DELETE FROM link_codes WHERE memory_id = $1 AND claimed_at IS NULL AND failures >= $2`, [memoryId, MAX_FAILURES]);
}

export interface HolderIdentities {
  /** Identities that speak as the memory's "I" (however they were linked). */
  linked: Array<{ id: string; channel: string | null; client: string | null; externalId: string; linkedAt: string }>;
  /** Claims waiting for the holder's confirmation. */
  pending: Array<{ id: string; channel: string | null; client: string | null; externalId: string; displayName: string | null; claimedAt: string }>;
}

export async function holderIdentities(db: Queryable, memoryId: string, now: Date): Promise<HolderIdentities> {
  const linked: HolderIdentities['linked'] = await db.query(
    `SELECT i.id, i.channel, c.name AS client, i.external_id AS "externalId", i.verified_at AS "linkedAt"
     FROM external_identities i LEFT JOIN clients c ON c.id = i.client_id
     WHERE i.memory_id = $1 AND i.person_id = $1 AND i.kind = 'participant' AND i.verified_at IS NOT NULL ORDER BY i.verified_at`, [memoryId]);
  const pending: HolderIdentities['pending'] = await db.query(
    `SELECT l.id, l.claim_channel AS channel, c.name AS client, l.claim_external_id AS "externalId",
            l.claim_display_name AS "displayName", l.claimed_at AS "claimedAt"
     FROM link_codes l LEFT JOIN clients c ON c.id = l.claim_client_id
     WHERE l.memory_id = $1 AND l.claimed_at > $2 ORDER BY l.claimed_at`, [memoryId, claimCutoff(now)]);
  const iso = (d: Date | string) => new Date(d).toISOString();
  return {
    linked: linked.map((r) => ({ ...r, linkedAt: iso(r.linkedAt) })),
    pending: pending.map((r) => ({ ...r, claimedAt: iso(r.claimedAt) })),
  };
}

/**
 * The holder confirms a claim: the identity is bound to the memory's self from now on (a contact it named before keeps
 * what it said). 404 when the claim is unknown or older than CLAIM_TTL_DAYS.
 */
export async function confirmClaim(db: Queryable, memoryId: string, claimId: string, now: Date): Promise<void> {
  const [claim] = await db.query(
    `WITH d AS (DELETE FROM link_codes WHERE id = $1 AND memory_id = $2 AND claimed_at > $3
       RETURNING claim_client_id, claim_channel, claim_external_id)
     SELECT claim_client_id AS "clientId", claim_channel AS channel, claim_external_id AS "externalId" FROM d`,
    [claimId, memoryId, claimCutoff(now)]);
  if (!claim) throw new NotFoundException();
  const [bound] = await db.query(
    `WITH u AS (UPDATE external_identities SET person_id = $1, verified_at = $2
       WHERE memory_id = $1 AND kind = 'participant' AND external_id = $3
         AND (CASE WHEN $4::uuid IS NULL THEN client_id IS NULL AND channel = $5 ELSE client_id = $4::uuid END)
       RETURNING id) SELECT id FROM u`, [memoryId, now, claim.externalId, claim.clientId, claim.channel]);
  if (!bound) {
    await db.query(
      `INSERT INTO external_identities (memory_id, person_id, kind, client_id, channel, external_id, verified_at)
       VALUES ($1, $1, 'participant', $2, $3, $4, $5)`, [memoryId, claim.clientId, claim.channel, claim.externalId, now]);
  }
}

/** The holder rejects a claim (not them): it is dropped. */
export async function rejectClaim(db: Queryable, memoryId: string, claimId: string): Promise<void> {
  const [gone] = await db.query(
    `WITH d AS (DELETE FROM link_codes WHERE id = $1 AND memory_id = $2 AND claimed_at IS NOT NULL RETURNING id) SELECT id FROM d`, [claimId, memoryId]);
  if (!gone) throw new NotFoundException();
}

/** Unlinks one of the holder's identities: that sender is a participant like any other again (a new contact). */
export async function unlinkHolderIdentity(db: Queryable, memoryId: string, identityId: string): Promise<void> {
  const [gone] = await db.query(
    `WITH d AS (DELETE FROM external_identities WHERE id = $1 AND memory_id = $2 AND person_id = $2 AND kind = 'participant' RETURNING id)
     SELECT id FROM d`,
    [identityId, memoryId]);
  if (!gone) throw new NotFoundException();
}

function claimCutoff(now: Date): Date {
  return new Date(now.getTime() - CLAIM_TTL_DAYS * 86_400_000);
}
