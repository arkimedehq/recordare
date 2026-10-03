// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type DataSourceOptions } from 'typeorm';
import { join } from 'node:path';

/**
 * Postgres + pgvector. Schema changes only through migrations (never `synchronize`): enums,
 * HNSW / GIN / partial indexes are written explicitly in SQL.
 */
export function dataSourceOptions(url: string): DataSourceOptions {
  return {
    type: 'postgres',
    url,
    entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    migrationsRun: false,
    synchronize: false,
  };
}
