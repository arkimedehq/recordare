// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Presence impulses (D55, `docs/INITIATIVES_DELIVERY.md` §7): the agent — the body — tells the memory who it sees or hears
 * now, by what and how surely; the memory decides whether this is the moment for something it means to say or ask. The
 * person is resolved inside this memory only, as ingest resolves a participant (a verified participant identity, or the
 * account's own user for the self); an unknown identity creates nobody — a voice the agent cannot name is "someone", and
 * Recordare never stores a voice or a face, only who was recognised, by what, how sure, until when.
 */
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InitiativeService, type InitiativeView } from './initiative.service';

/** How the agent perceived the person: heard (voice), seen (camera), at a screen it shows (panel), writing (chat). */
export const PRESENCE_CHANNELS = ['voice', 'camera', 'panel', 'chat'] as const;

export interface PresenceInput {
  person?: { identity: { channel: string; externalId: string } | { externalUserId: string } };
  channel: (typeof PRESENCE_CHANNELS)[number];
  confidence: number;
  ttlSeconds: number;
  place?: string;
  left?: boolean;
}

export interface PresenceResult {
  person: { personId: string; name: string } | null;
  initiative: InitiativeView | null;
  askWho: { personId: string; name: string } | null;
}

@Injectable()
export class PresenceService {
  constructor(private readonly db: DataSource, private readonly initiatives: InitiativeService) {}

  async report(memoryId: string, clientId: string | null, input: PresenceInput, now: Date): Promise<PresenceResult> {
    const person = await this.resolve(memoryId, clientId, input.person);
    if (input.left) {
      await this.db.query(`UPDATE presences SET expires_at = $3 WHERE memory_id = $1 AND person_id IS NOT DISTINCT FROM $2 AND expires_at > $3`,
        [memoryId, person?.personId ?? null, now]);
      return { person, initiative: null, askWho: null };
    }
    await this.db.query(
      `INSERT INTO presences (memory_id, person_id, client_id, channel, confidence, place, seen_at, expires_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [memoryId, person?.personId ?? null, clientId, input.channel, input.confidence, input.place ?? null, now, new Date(now.getTime() + input.ttlSeconds * 1000)]);
    // Seen or heard: what is offered is said by voice (a camera or a panel sighting is answered in the agent's voice too, or
    // on its screen); a chat presence is the chat.
    const channel = input.channel === 'chat' ? 'chat' : input.channel === 'panel' ? 'panel' : 'voice';
    const { initiative, askWho } = await this.initiatives.offer(memoryId, { personId: person?.personId ?? null, confidence: person ? input.confidence : 0 }, channel, now);
    return { person, initiative, askWho };
  }

  /** The person in this memory: the self (personal memory: no identity, or the account's own user), a known contact, or nobody. */
  private async resolve(memoryId: string, clientId: string | null, person: PresenceInput['person']): Promise<{ personId: string; name: string } | null> {
    const [memory]: Array<{ mode: string; name: string }> = await this.db.query(
      `SELECT o.mode, p.display_name AS name FROM memories o JOIN persons p ON p.id = o.person_id WHERE o.person_id = $1`, [memoryId]);
    if (!memory) return null;
    const selfOf = { personId: memoryId, name: memory.name };
    if (!person) return memory.mode === 'personal' ? selfOf : null;
    const id = person.identity;
    if ('externalUserId' in id) {
      if (!clientId) return null;
      const [own] = await this.db.query(
        `SELECT 1 FROM external_identities WHERE kind = 'account' AND client_id = $1 AND external_id = $2 AND person_id = $3`, [clientId, id.externalUserId, memoryId]);
      if (own) return memory.mode === 'personal' ? selfOf : null; // an entity memory's account is the agent, not a person present
    }
    const [hit]: Array<{ person_id: string; name: string }> = 'externalUserId' in id
      ? await this.db.query(
        `SELECT x.person_id, p.display_name AS name FROM external_identities x JOIN persons p ON p.id = x.person_id
         WHERE x.kind = 'participant' AND x.memory_id = $1 AND x.client_id = $2 AND x.external_id = $3 AND x.verified_at IS NOT NULL`,
        [memoryId, clientId, id.externalUserId])
      : await this.db.query(
        `SELECT x.person_id, p.display_name AS name FROM external_identities x JOIN persons p ON p.id = x.person_id
         WHERE x.kind = 'participant' AND x.memory_id = $1 AND x.channel = $2 AND x.external_id = $3 AND x.verified_at IS NOT NULL`,
        [memoryId, id.channel, id.externalId]);
    if (!hit) return null;
    return hit.person_id === memoryId ? selfOf : { personId: hit.person_id, name: hit.name };
  }
}
