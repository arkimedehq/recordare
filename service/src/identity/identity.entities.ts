// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/** Identity tables (docs/DATA_MODEL.md → Identity, v1 home / research profile). */
import { Column, CreateDateColumn, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import { type QualityProfileName } from '../engine/quality-profile';

export const SCOPES = ['ingest', 'mcp', 'read', 'write', 'memory_settings', 'export', 'admin'] as const;
export type Scope = (typeof SCOPES)[number];

/**
 * D50: `personal` — undeclared input is the memory's self (the account holder is "I"); `entity` — undeclared input is
 * "someone" and only content marked as the agent's own is the self (a shared device, a robot, a place).
 */
export const MEMORY_MODES = ['personal', 'entity'] as const;
export type MemoryMode = (typeof MEMORY_MODES)[number];
/** The grammatical gender of the memory's first person in gendered languages (D50). */
export const MEMORY_GENDERS = ['masculine', 'feminine', 'neutral'] as const;
export type MemoryGender = (typeof MEMORY_GENDERS)[number];
/** Whose a memory row is: the memory's self, a contact, an unidentified someone, or undecided between candidates. */
export const SUBJECT_KINDS = ['self', 'contact', 'someone', 'undecided'] as const;
export type SubjectKind = (typeof SUBJECT_KINDS)[number];

@Entity('persons')
export class Person {
  @PrimaryGeneratedColumn('uuid') id!: string;
  /** null for a memory's own row; set for contacts (required: a contact belongs to exactly one memory, D50). */
  @Column({ name: 'memory_id', type: 'uuid', nullable: true }) memoryId!: string | null;
  @Column({ name: 'display_name', type: 'text' }) displayName!: string;
  /** Contacts: the full name when known (names and nicknames live in `person_aliases`). */
  @Column({ name: 'full_name', type: 'text', nullable: true }) fullName!: string | null;
  /** Contacts: the relation to the memory's self (sister, colleague, boss…). */
  @Column({ type: 'text', nullable: true }) relation!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}

@Entity('memories')
export class Memory {
  @PrimaryColumn({ name: 'person_id', type: 'uuid' }) personId!: string;
  @Column({ type: 'text', nullable: true }) email!: string | null;
  @Column({ type: 'text', default: 'it' }) locale!: string;
  @Column({ type: 'text', default: 'Europe/Rome' }) timezone!: string;
  /** D35: null = installation default. */
  @Column({ name: 'quality_profile', type: 'text', nullable: true }) qualityProfile!: QualityProfileName | null;
  @Column({ type: 'enum', enumName: 'memory_mode', enum: MEMORY_MODES, default: 'personal' }) mode!: MemoryMode;
  @Column({ type: 'enum', enumName: 'memory_gender', enum: MEMORY_GENDERS, default: 'masculine' }) gender!: MemoryGender;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}

@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'text' }) name!: string;
  @Column({ type: 'enum', enumName: 'client_kind', enum: ['platform', 'mcp_client', 'import'] }) kind!: 'platform' | 'mcp_client' | 'import';
  @Column({ name: 'auto_provision', type: 'boolean', default: false }) autoProvision!: boolean;
  @Column({ name: 'raw_log_scope', type: 'enum', enumName: 'raw_log_scope', enum: ['own', 'all'], default: 'own' }) rawLogScope!: 'own' | 'all';
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @Column({ name: 'disabled_at', type: 'timestamptz', nullable: true }) disabledAt!: Date | null;
}

@Entity('api_keys')
export class ApiKey {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'client_id', type: 'uuid', nullable: true }) clientId!: string | null;
  @Column({ type: 'text' }) prefix!: string;
  @Column({ type: 'text' }) hash!: string;
  @Column({ type: 'text', array: true }) scopes!: Scope[];
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true }) lastUsedAt!: Date | null;
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true }) revokedAt!: Date | null;
}

@Entity('access_tokens')
export class AccessToken {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'memory_id', type: 'uuid' }) memoryId!: string;
  @Column({ name: 'client_id', type: 'uuid' }) clientId!: string;
  @Column({ type: 'enum', enumName: 'token_kind', enum: ['personal'], default: 'personal' }) kind!: 'personal';
  @Column({ type: 'text' }) prefix!: string;
  @Column({ type: 'text' }) hash!: string;
  @Column({ type: 'text', array: true }) scopes!: Scope[];
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true }) expiresAt!: Date | null;
  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true }) lastUsedAt!: Date | null;
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true }) revokedAt!: Date | null;
}

/**
 * `account`: a client's user id → the memory it opens (`memory_id` null, the person is the memory's own row).
 * `participant`: a client's participant id (`client_id`) or a channel id (`channel`) → a contact, or the self, of the
 * memory `memory_id` (D50).
 */
@Entity('external_identities')
export class ExternalIdentity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'memory_id', type: 'uuid', nullable: true }) memoryId!: string | null;
  @Column({ name: 'person_id', type: 'uuid' }) personId!: string;
  @Column({ type: 'enum', enumName: 'identity_kind', enum: ['account', 'participant'] }) kind!: 'account' | 'participant';
  @Column({ name: 'client_id', type: 'uuid', nullable: true }) clientId!: string | null;
  @Column({ type: 'text', nullable: true }) channel!: string | null;
  @Column({ name: 'external_id', type: 'text' }) externalId!: string;
  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true }) verifiedAt!: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}

/** A question Recordare wants answered ("which Marco?", "is this Giulia my sister?"), D50 / vision L1 (8.4). */
@Entity('clarifications')
export class Clarification {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'memory_id', type: 'uuid' }) memoryId!: string;
  @Column({ type: 'text' }) question!: string;
  /** The candidate contacts. */
  @Column({ type: 'uuid', array: true, default: () => "'{}'" }) candidates!: string[];
  @Column({ name: 'episode_id', type: 'uuid', nullable: true }) episodeId!: string | null;
  @Column({ name: 'fact_id', type: 'uuid', nullable: true }) factId!: string | null;
  @Column({ name: 'note_id', type: 'uuid', nullable: true }) noteId!: string | null;
  /** A "same person?" question (8.4): the new contact that may be one of the candidates (no item then). */
  @Column({ name: 'contact_id', type: 'uuid', nullable: true }) contactId!: string | null;
  @Column({ type: 'enum', enumName: 'clarification_status', enum: ['open', 'resolved', 'expired'], default: 'open' }) status!: 'open' | 'resolved' | 'expired';
  /** The answer as given. */
  @Column({ type: 'text', nullable: true }) resolution!: string | null;
  /** The contact the answer chose, when it chose one. */
  @Column({ name: 'resolved_person_id', type: 'uuid', nullable: true }) resolvedPersonId!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true }) resolvedAt!: Date | null;
}
