// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/** Layer 0 — raw log (docs/DATA_MODEL.md). Verbatim, the ground truth every memory points to. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import { ATTRIBUTION_METHODS, AUTHOR_KINDS, type AttributionMethod, type AuthorKind } from './attribution';

/** `document`, `perception`, `ambient` (D50): a document given to the agent, what a device perceives, ambient listening. */
export const CONVERSATION_SOURCES = ['chat', 'voice', 'mcp_tool', 'import_chat', 'import_social', 'import_email', 'import_notes', 'interview',
  'document', 'perception', 'ambient'] as const;
export type ConversationSource = (typeof CONVERSATION_SOURCES)[number];
export type ParticipantRole = 'holder' | 'assistant' | 'other';
export type MessageRole = 'user' | 'assistant' | 'tool' | 'other';

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'memory_id', type: 'uuid' }) memoryId!: string;
  @Column({ name: 'client_id', type: 'uuid' }) clientId!: string;
  @Column({ name: 'external_id', type: 'text' }) externalId!: string;
  @Column({ type: 'enum', enumName: 'conversation_source', enum: CONVERSATION_SOURCES, default: 'chat' }) source!: ConversationSource;
  @Column({ type: 'text', nullable: true }) channel!: string | null;
  @Column({ type: 'text', nullable: true }) title!: string | null;
  @Column({ name: 'started_at', type: 'timestamptz' }) startedAt!: Date;
  @Column({ name: 'last_message_at', type: 'timestamptz' }) lastMessageAt!: Date;
  @Column({ name: 'idle_job_at', type: 'timestamptz', nullable: true }) idleJobAt!: Date | null;
  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true }) deletedAt!: Date | null;
}

@Entity('conversation_participants')
export class ConversationParticipant {
  @PrimaryColumn({ name: 'conversation_id', type: 'uuid' }) conversationId!: string;
  @PrimaryColumn({ type: 'text' }) ref!: string;
  @Column({ name: 'person_id', type: 'uuid', nullable: true }) personId!: string | null;
  @Column({ type: 'enum', enumName: 'participant_role', enum: ['holder', 'assistant', 'other'] }) role!: ParticipantRole;
  @Column({ name: 'display_name', type: 'text', nullable: true }) displayName!: string | null;
  @Column({ name: 'joined_at', type: 'timestamptz', default: () => 'now()' }) joinedAt!: Date;
}

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'conversation_id', type: 'uuid' }) conversationId!: string;
  @Column({ name: 'memory_id', type: 'uuid' }) memoryId!: string;
  @Column({ name: 'external_id', type: 'text' }) externalId!: string;
  @Column({ type: 'enum', enumName: 'message_role', enum: ['user', 'assistant', 'tool', 'other'] }) role!: MessageRole;
  @Column({ name: 'tool_name', type: 'text', nullable: true }) toolName!: string | null;
  @Column({ name: 'author_person_id', type: 'uuid', nullable: true }) authorPersonId!: string | null;
  @Column({ name: 'author_ref', type: 'text', nullable: true }) authorRef!: string | null;
  @Column({ name: 'author_kind', type: 'enum', enumName: 'message_author_kind', enum: AUTHOR_KINDS }) authorKind!: AuthorKind;
  @Column({ name: 'attribution_method', type: 'enum', enumName: 'attribution_method', enum: ATTRIBUTION_METHODS }) attributionMethod!: AttributionMethod;
  @Column({ name: 'attribution_confidence', type: 'real', nullable: true }) attributionConfidence!: number | null;
  @Column({ type: 'text' }) content!: string;
  @Column({ name: 'content_hash', type: 'bytea' }) contentHash!: Buffer;
  @Column({ name: 'sent_at', type: 'timestamptz' }) sentAt!: Date;
  @Column({ name: 'received_at', type: 'timestamptz', default: () => 'now()' }) receivedAt!: Date;
  @Column({ name: 'extracted_run_id', type: 'uuid', nullable: true }) extractedRunId!: string | null;
  @Column({ name: 'edited_at', type: 'timestamptz', nullable: true }) editedAt!: Date | null;
}
