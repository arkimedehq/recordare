// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/** Room fan-out (WORK_PLAN 6.5 (4)): one transcript heard in a room, as one recipient's `ambient` conversation. */
import { type IngestRequest, type RoomRequest } from './ingest.schemas';

/**
 * The transcript as `recipient` (a client user id) hears it: their own words are `user` turns; everyone else is an
 * `other` participant, linked to a contact of their memory through the speaker's identity — the user id of a speaker
 * with an account (`externalUserId`), else the given channel identity; an unknown speaker is "someone".
 */
export function roomFor(room: RoomRequest, recipient: string): IngestRequest {
  const self = new Set(room.speakers.filter((s) => s.user === recipient).map((s) => s.ref));
  const participants = room.speakers.filter((s) => !self.has(s.ref)).map((s) => {
    const identity = s.user !== undefined ? { externalUserId: s.user } : s.identity;
    return { ref: s.ref, role: 'other' as const, ...(s.displayName ? { displayName: s.displayName } : {}), ...(identity ? { identity } : {}) };
  });
  return {
    conversation: { ...room.conversation, source: 'ambient', participants },
    messages: room.messages.map((m) => ({
      externalId: m.externalId, content: m.content, sentAt: m.sentAt, upsert: m.upsert,
      ...(m.speakerRef !== undefined && self.has(m.speakerRef) ? { role: 'user' as const } : { role: 'other' as const, ...(m.speakerRef !== undefined ? { authorRef: m.speakerRef } : {}) }),
    })),
    hints: room.hints,
  };
}
