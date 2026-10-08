// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Who will see an answer (docs/API.md §1 "Viewer context"). Resolved by Recordare from the
 * participants it has ingested — never asserted by the client or the LLM. Extra viewers declared
 * by headers / `_meta` can only add people (narrowing what is returned).
 */
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { type Principal } from './principal';

export const CONVERSATION_HEADER = 'x-recordare-conversation';
export const VIEWERS_HEADER = 'x-recordare-viewers';

export interface ViewerContext {
  /** Phase 1 rule: memories are returned only when the viewers are exactly the owner. */
  ownerOnly: boolean;
  source: 'conversation' | 'owner_direct' | 'none';
  conversationId?: string;
}

@Injectable()
export class ViewerContextService {
  constructor(private readonly db: DataSource) {}

  async resolve(
    principal: Principal, ownerId: string, conversationExternalId: string | undefined, extraViewers: string | undefined,
  ): Promise<ViewerContext> {
    const added = (extraViewers ?? '').split(',').map((v) => v.trim()).filter(Boolean).length > 0;
    if (!conversationExternalId) {
      // Owner-direct use (personal token) sees as the owner; client keys must name a conversation.
      if (principal.kind === 'owner_token') return { ownerOnly: !added, source: 'owner_direct' };
      return { ownerOnly: false, source: 'none' };
    }
    if (principal.kind === 'admin') return { ownerOnly: false, source: 'none' };
    const [conv] = await this.db.query(
      `SELECT id FROM conversations WHERE client_id = $1 AND owner_id = $2 AND external_id = $3 AND deleted_at IS NULL`,
      [principal.clientId, ownerId, conversationExternalId],
    );
    // A personal token is the person: a conversation not stored yet (a client asking before it ingests) is theirs alone.
    if (!conv) return principal.kind === 'owner_token' ? { ownerOnly: !added, source: 'owner_direct' } : { ownerOnly: false, source: 'none' };
    const [{ others }] = await this.db.query(
      `SELECT count(*)::int AS others FROM conversation_participants
       WHERE conversation_id = $1 AND role = 'other' AND (person_id IS NULL OR person_id <> $2)`,
      [conv.id, ownerId],
    );
    return { ownerOnly: others === 0 && !added, source: 'conversation', conversationId: conv.id };
  }
}
