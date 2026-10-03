// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Credential format: `<kind>_<prefix>_<secret>` — `rk` client API keys, `rp` personal tokens.
 * The prefix (12 hex chars) is stored in clear for lookup and display; the whole credential is
 * stored as an argon2id hash and shown only once.
 */
import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';

export type CredentialKind = 'rk' | 'rp';

export interface ParsedCredential {
  kind: CredentialKind;
  prefix: string;
  raw: string;
}

const PATTERN = /^(rk|rp)_([0-9a-f]{12})_([A-Za-z0-9_-]{43})$/;

export function generateCredential(kind: CredentialKind): ParsedCredential {
  const prefix = randomBytes(6).toString('hex');
  const secret = randomBytes(32).toString('base64url');
  return { kind, prefix, raw: `${kind}_${prefix}_${secret}` };
}

export function parseCredential(raw: string): ParsedCredential | null {
  const m = PATTERN.exec(raw);
  if (!m) return null;
  return { kind: m[1] as CredentialKind, prefix: m[2] as string, raw };
}

export function hashCredential(raw: string): Promise<string> {
  return argon2.hash(raw, { type: argon2.argon2id });
}

export async function verifyCredential(hash: string, raw: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, raw);
  } catch {
    return false;
  }
}
