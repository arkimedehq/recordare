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
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { type Env } from '../config/env';
import { initiativeText } from '../lang/initiative';
import { afterQuiet, InitiativeService, TIMING, timingPolicy, type InitiativeView, type MomentHold } from './initiative.service';
import { dayPart, shouldHold, withOthers } from './learning';

/**
 * How the agent perceived the person: at home (`home`: an account's presence, not enough to speak), heard (voice), seen
 * (camera), at a screen it shows (panel), writing (chat).
 */
export const PRESENCE_CHANNELS = ['home', 'voice', 'camera', 'panel', 'chat'] as const;
/** In a room the agent can speak in: where §5c's rules hold (arrival, pace, quiet hours, the opening). */
const ROOM = new Set(['voice', 'camera']);

type Identity = { channel: string; externalId: string } | { externalUserId: string };

export interface PresenceInput {
  /** One person (the shorthand of a place with one person); none: the holder of a personal memory, nobody known in an entity memory. */
  person?: { identity: Identity };
  confidence: number;
  /** D55 §5c: everyone the agent recognises in the place, each with how sure. */
  people?: Array<{ identity: Identity; confidence: number }>;
  /** People in the place the agent cannot name. */
  someone?: number;
  channel: (typeof PRESENCE_CHANNELS)[number];
  ttlSeconds: number;
  place?: string;
  left?: boolean;
  /** Timing v2 (F6): the client knows the person(s) of this impulse are busy now (a call, a meeting, do-not-disturb); false: no longer. */
  busy?: boolean;
  /** Timing v2 (F6): the client knows people in the place are talking now (a conversation in progress). */
  talking?: boolean;
}

type Person = { personId: string; name: string };

export interface PresenceResult {
  /** The person the initiative is for, else the first recognised. */
  person: Person | null;
  people: Person[];
  initiative: InitiativeView | null;
  askWho: Person | null;
  /** Others are in the room: say only this; the initiative waits for the person's "yes" (their next turn gets it). */
  opening: string | null;
}

@Injectable()
export class PresenceService {
  constructor(private readonly db: DataSource, private readonly initiatives: InitiativeService, private readonly config: ConfigService<Env, true>) {}

  async report(memoryId: string, clientId: string | null, input: PresenceInput, now: Date): Promise<PresenceResult> {
    const entries = input.people ?? [{ identity: input.person?.identity, confidence: input.confidence }];
    const resolved = await Promise.all(entries.map(async (e) => ({ person: await this.resolve(memoryId, clientId, e.identity), confidence: e.confidence })));
    const people = resolved.flatMap((r) => (r.person ? [r.person] : []));
    const none: PresenceResult = { person: people[0] ?? null, people, initiative: null, askWho: null, opening: null };
    if (input.left) {
      for (const r of resolved) {
        await this.db.query(`UPDATE presences SET expires_at = $3 WHERE memory_id = $1 AND person_id IS NOT DISTINCT FROM $2 AND expires_at > $3`,
          [memoryId, r.person?.personId ?? null, now]);
      }
      return none;
    }
    const room = ROOM.has(input.channel);
    const arrived = new Set<string>();
    const rowOf = new Map<string, string>();
    for (const r of resolved) {
      // An arrival: nobody of theirs was live in this place (a refresh only keeps the presence live) — §5c; or the last
      // presence there was an arrival held for a busy person or a conversation (timing v2: the moment is still owed).
      if (r.person && room) {
        const [live]: Array<{ arrival_held: boolean }> = await this.db.query(
          `SELECT arrival_held FROM presences WHERE memory_id = $1 AND person_id = $2 AND place IS NOT DISTINCT FROM $3 AND channel = ANY($4) AND expires_at > $5
           ORDER BY seen_at DESC LIMIT 1`,
          [memoryId, r.person.personId, input.place ?? null, [...ROOM], now]);
        if (!live || live.arrival_held) arrived.add(r.person.personId);
      }
      // No longer busy: the earlier busy presences of theirs end being busy.
      if (input.busy === false && r.person) {
        await this.db.query(`UPDATE presences SET busy = false WHERE memory_id = $1 AND person_id = $2 AND busy AND expires_at > $3`, [memoryId, r.person.personId, now]);
      }
      const [row]: Array<{ id: string }> = await this.db.query(
        `INSERT INTO presences (memory_id, person_id, client_id, channel, confidence, place, seen_at, expires_at, busy, talking)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [memoryId, r.person?.personId ?? null, clientId, input.channel, r.confidence, input.place ?? null, now, new Date(now.getTime() + input.ttlSeconds * 1000),
          !!input.busy, !!input.talking]);
      if (r.person && row) rowOf.set(r.person.personId, row.id);
    }
    // At home is not enough to speak: recorded (the clock reads it), nothing offered.
    if (input.channel === 'home') return none;
    // Seen or heard: what is offered is said by voice (a camera sighting is answered in the agent's voice); a panel on its
    // screen; a chat presence is the chat.
    const channel = input.channel === 'chat' ? 'chat' : input.channel === 'panel' ? 'panel' : 'voice';
    const others = resolved.length + (input.someone ?? 0) > 1;
    const [memory]: Array<{ locale: string; timezone: string; quiet_from: number; quiet_to: number }> = await this.db.query(
      `SELECT locale, timezone, quiet_from, quiet_to FROM memories WHERE person_id = $1`, [memoryId]);
    const quiet = !!memory && afterQuiet(now, memory.timezone, memory.quiet_from, memory.quiet_to).getTime() !== now.getTime();
    const { learns, learn, context, v2 } = timingPolicy(this.config);
    // Timing v2 (F6): others here and talking now — the opening waits for a pause.
    const conversation = context && room && others && await this.conversing(memoryId, input.place ?? null, now);
    for (const r of resolved) {
      if (!r.person) continue;
      // In a room, spontaneous only at an arrival, within the pace, outside the quiet hours; else only a timed request or promise.
      const timedOwedOnly = room && (!arrived.has(r.person.personId) || quiet || await this.paced(memoryId, r.person.personId, now));
      // Timing v1 (F4): where this person has often ignored or declined what was said to them (this part of the day, this
      // channel), a flexible one waits for a better moment; a time they chose still goes. v2 learns company apart.
      let learnt: boolean | null = null;
      let moment: MomentHold | null = null;
      if ((learn || context) && memory && !timedOwedOnly) {
        const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: memory.timezone }).format(now)) % 24;
        const self = r.person.personId === memoryId;
        const forId = self ? null : r.person.personId;
        if (learn) {
          const exp = await this.initiatives.experienceOf(memoryId, forId, memory.timezone, now, { company: v2 });
          learnt = shouldHold(exp, dayPart(hour), channel, TIMING.defaultPrior);
        }
        if (context && conversation) moment = 'conversation';
        else if (context && room && others) {
          const company = await this.initiatives.experienceOf(memoryId, forId, memory.timezone, now, { company: true });
          if (shouldHold(company, dayPart(hour), withOthers(channel), TIMING.defaultPrior)) moment = 'learnt_company';
        }
      }
      const hold = learns && !!learnt;
      const res = await this.initiatives.offer(memoryId, { personId: r.person.personId, confidence: r.confidence }, channel, now,
        { timedOwedOnly: timedOwedOnly || hold, open: room && others, moment,
          features: learnt === null ? undefined : learns ? { learntHold: learnt } : { shadow: { policy: 'v1', hold: learnt } } });
      // A spontaneous moment held for a busy person or a conversation stays owed: the next impulse here is still the arrival.
      if (v2 && (res.held === 'busy' || res.held === 'conversation') && arrived.has(r.person.personId)) {
        await this.db.query(`UPDATE presences SET arrival_held = true WHERE id = $1`, [rowOf.get(r.person.personId)]);
      }
      if (res.initiative) {
        return { person: r.person, people, initiative: res.initiative, askWho: null,
          opening: res.opened ? initiativeText(memory?.locale ?? 'en').opening(r.person.name) : null };
      }
    }
    if (people.length) return none;
    // Nobody identified: an entity memory may ask whether this is someone something waits for.
    const { askWho } = await this.initiatives.offer(memoryId, { personId: null, confidence: 0 }, channel, now);
    return { ...none, askWho };
  }

  /**
   * Timing v2 (F6): a conversation in progress in this place — a client said people are talking there within
   * `INITIATIVE_CONVERSATION_GAP_SECONDS`. Only the client's word: a `voice` impulse naming several people describes the
   * room, not who speaks.
   */
  private async conversing(memoryId: string, place: string | null, now: Date): Promise<boolean> {
    const gap = this.config.get('INITIATIVE_CONVERSATION_GAP_SECONDS', { infer: true }) ?? 90;
    if (!gap) return false;
    const [hit] = await this.db.query(
      `SELECT 1 FROM presences WHERE memory_id = $1 AND place IS NOT DISTINCT FROM $2 AND talking
         AND seen_at > $3::timestamptz - make_interval(secs => $4) AND seen_at <= $3 LIMIT 1`, [memoryId, place, now, gap]);
    return !!hit;
  }

  /** Whether this person had a spontaneous announcement (an initiative by voice, or an opening) within the pace (§5c). */
  private async paced(memoryId: string, personId: string, now: Date): Promise<boolean> {
    const minutes = this.config.get('INITIATIVE_VOICE_PACE_MINUTES', { infer: true }) ?? 30;
    if (!minutes) return false;
    const since = new Date(now.getTime() - minutes * 60_000);
    const [hit] = await this.db.query(
      `SELECT 1 FROM initiatives WHERE memory_id = $1 AND for_person_id IS NOT DISTINCT FROM $2
         AND ((channel = 'voice' AND offered_at > $3) OR opened_at > $3) LIMIT 1`, [memoryId, personId === memoryId ? null : personId, since]);
    return !!hit;
  }

  /** The person in this memory: the self (personal memory: no identity, or the account's own user), a known contact, or nobody. */
  private async resolve(memoryId: string, clientId: string | null, identity: Identity | undefined): Promise<Person | null> {
    const [memory]: Array<{ mode: string; name: string }> = await this.db.query(
      `SELECT o.mode, p.display_name AS name FROM memories o JOIN persons p ON p.id = o.person_id WHERE o.person_id = $1`, [memoryId]);
    if (!memory) return null;
    const selfOf = { personId: memoryId, name: memory.name };
    if (!identity) return memory.mode === 'personal' ? selfOf : null;
    const id = identity;
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
