// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/** Identity tables (docs/DATA_MODEL.md → Identity, v1 home / research profile). */
import { Column, CreateDateColumn, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import { type QualityProfileName } from '../engine/quality-profile';

export const SCOPES = ['ingest', 'mcp', 'read', 'write', 'owner_settings', 'export', 'admin'] as const;
export type Scope = (typeof SCOPES)[number];

@Entity('persons')
export class Person {
  @PrimaryGeneratedColumn('uuid') id!: string;
  /** null for owners; set for contacts (scoped to one owner's memory). */
  @Column({ name: 'owner_scope', type: 'uuid', nullable: true }) ownerScope!: string | null;
  @Column({ name: 'display_name', type: 'text' }) displayName!: string;
  /** `entity`: a shared device, robot or place whose memory everyone using it reads and writes (D48). */
  @Column({ type: 'enum', enumName: 'person_kind', enum: ['human', 'entity'], default: 'human' }) kind!: 'human' | 'entity';
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}

@Entity('owners')
export class Owner {
  @PrimaryColumn({ name: 'person_id', type: 'uuid' }) personId!: string;
  @Column({ type: 'text', nullable: true }) email!: string | null;
  @Column({ type: 'text', default: 'it' }) locale!: string;
  @Column({ type: 'text', default: 'Europe/Rome' }) timezone!: string;
  /** D35: null = installation default. */
  @Column({ name: 'quality_profile', type: 'text', nullable: true }) qualityProfile!: QualityProfileName | null;
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
  @Column({ name: 'owner_id', type: 'uuid' }) ownerId!: string;
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

@Entity('external_identities')
export class ExternalIdentity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'owner_scope', type: 'uuid', nullable: true }) ownerScope!: string | null;
  @Column({ name: 'person_id', type: 'uuid' }) personId!: string;
  @Column({ type: 'enum', enumName: 'identity_kind', enum: ['client_user', 'channel'] }) kind!: 'client_user' | 'channel';
  @Column({ name: 'client_id', type: 'uuid', nullable: true }) clientId!: string | null;
  @Column({ type: 'text', nullable: true }) channel!: string | null;
  @Column({ name: 'external_id', type: 'text' }) externalId!: string;
  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true }) verifiedAt!: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}
