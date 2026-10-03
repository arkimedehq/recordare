// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type DataSourceOptions } from 'typeorm';
import { AccessToken, ApiKey, Client, ExternalIdentity, Owner, Person } from '../identity/identity.entities';
import { InitialSchema1790950000000 } from './migrations/1790950000000-InitialSchema';

/**
 * Postgres + pgvector. Schema changes only through migrations (never `synchronize`): enums,
 * HNSW / GIN / partial indexes are written explicitly in SQL. Entities and migrations are listed
 * explicitly (no globs): works the same under tsc, SWC and the test runner.
 */
export const ENTITIES = [Person, Owner, Client, ApiKey, AccessToken, ExternalIdentity];
export const MIGRATIONS = [InitialSchema1790950000000];

export function dataSourceOptions(url: string): DataSourceOptions {
  return { type: 'postgres', url, entities: ENTITIES, migrations: MIGRATIONS, migrationsRun: false, synchronize: false };
}
