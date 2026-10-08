// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type DataSourceOptions } from 'typeorm';
import { AccessToken, ApiKey, Client, ExternalIdentity, Owner, Person } from '../identity/identity.entities';
import { InitialSchema1790950000000 } from './migrations/1790950000000-InitialSchema';
import { Notes1790960000000 } from './migrations/1790960000000-Notes';
import { MessageAuthorRef1790970000000 } from './migrations/1790970000000-MessageAuthorRef';
import { OwnerQualityProfile1790980000000 } from './migrations/1790980000000-OwnerQualityProfile';
import { Consolidation1790990000000 } from './migrations/1790990000000-Consolidation';
import { RecallLog1791000000000 } from './migrations/1791000000000-RecallLog';
import { RecallLogConversation1791010000000 } from './migrations/1791010000000-RecallLogConversation';
import { FactsReview1791020000000 } from './migrations/1791020000000-FactsReview';
import { EntityMemory1791030000000 } from './migrations/1791030000000-EntityMemory';
import { ConsentWaiting1791040000000 } from './migrations/1791040000000-ConsentWaiting';
import { Conversation, ConversationParticipant, Message } from '../rawlog/rawlog.entities';

/**
 * Postgres + pgvector. Schema changes only through migrations (never `synchronize`): enums,
 * HNSW / GIN / partial indexes are written explicitly in SQL. Entities and migrations are listed
 * explicitly (no globs): works the same under tsc, SWC and the test runner.
 */
export const ENTITIES = [Person, Owner, Client, ApiKey, AccessToken, ExternalIdentity, Conversation, ConversationParticipant, Message];
export const MIGRATIONS = [InitialSchema1790950000000, Notes1790960000000, MessageAuthorRef1790970000000, OwnerQualityProfile1790980000000, Consolidation1790990000000, RecallLog1791000000000, RecallLogConversation1791010000000, FactsReview1791020000000,
  EntityMemory1791030000000, ConsentWaiting1791040000000];

export function dataSourceOptions(url: string): DataSourceOptions {
  return { type: 'postgres', url, entities: ENTITIES, migrations: MIGRATIONS, migrationsRun: false, synchronize: false };
}
