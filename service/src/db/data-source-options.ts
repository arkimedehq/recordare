// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type DataSourceOptions } from 'typeorm';
import { AccessToken, ApiKey, Clarification, Client, ExternalIdentity, Memory, Person } from '../identity/identity.entities';
import { InitialSchema1790950000000 } from './migrations/1790950000000-InitialSchema';
import { Notes1790960000000 } from './migrations/1790960000000-Notes';
import { MessageAuthorRef1790970000000 } from './migrations/1790970000000-MessageAuthorRef';
import { MemoryQualityProfile1790980000000 } from './migrations/1790980000000-MemoryQualityProfile';
import { Consolidation1790990000000 } from './migrations/1790990000000-Consolidation';
import { RecallLog1791000000000 } from './migrations/1791000000000-RecallLog';
import { RecallLogConversation1791010000000 } from './migrations/1791010000000-RecallLogConversation';
import { FactsReview1791020000000 } from './migrations/1791020000000-FactsReview';
import { EntityMemory1791030000000 } from './migrations/1791030000000-EntityMemory';
import { ConsentWaiting1791040000000 } from './migrations/1791040000000-ConsentWaiting';
import { RunSummary1791050000000 } from './migrations/1791050000000-RunSummary';
import { NoConsent1791060000000 } from './migrations/1791060000000-NoConsent';
import { MemoryIdentity1791070000000 } from './migrations/1791070000000-MemoryIdentity';
import { ContactClarification1791080000000 } from './migrations/1791080000000-ContactClarification';
import { Sources1791090000000 } from './migrations/1791090000000-Sources';
import { Memories1791100000000 } from './migrations/1791100000000-Memories';
import { FactNoteTombstones1791110000000 } from './migrations/1791110000000-FactNoteTombstones';
import { EpisodeResolvedAt1791120000000 } from './migrations/1791120000000-EpisodeResolvedAt';
import { Patterns1791130000000 } from './migrations/1791130000000-Patterns';
import { Exports1791140000000 } from './migrations/1791140000000-Exports';
import { HolderLinks1791150000000 } from './migrations/1791150000000-HolderLinks';
import { Conversation, ConversationParticipant, Message } from '../rawlog/rawlog.entities';

/**
 * Postgres + pgvector. Schema changes only through migrations (never `synchronize`): enums,
 * HNSW / GIN / partial indexes are written explicitly in SQL. Entities and migrations are listed
 * explicitly (no globs): works the same under tsc, SWC and the test runner.
 */
export const ENTITIES = [Person, Memory, Client, ApiKey, AccessToken, ExternalIdentity, Clarification, Conversation, ConversationParticipant, Message];
export const MIGRATIONS = [InitialSchema1790950000000, Notes1790960000000, MessageAuthorRef1790970000000, MemoryQualityProfile1790980000000, Consolidation1790990000000, RecallLog1791000000000, RecallLogConversation1791010000000, FactsReview1791020000000,
  EntityMemory1791030000000, ConsentWaiting1791040000000, RunSummary1791050000000, NoConsent1791060000000,
  MemoryIdentity1791070000000, ContactClarification1791080000000, Sources1791090000000, Memories1791100000000,
  FactNoteTombstones1791110000000, EpisodeResolvedAt1791120000000, Patterns1791130000000, Exports1791140000000,
  HolderLinks1791150000000];

/**
 * Every session scans HNSW indexes iteratively (pgvector ≥ 0.8, WORK_PLAN 4.14): a vector search filtered by memory
 * otherwise stops at `hnsw.ef_search` candidates (40) of the whole table and returns fewer rows than asked once other
 * memories fill it (3 of 10 with one memory holding 0.5 % of 20,000 rows). `strict_order` keeps the exact distance
 * order the rank fusion relies on. Set at connection start: an older pgvector drops the unknown setting with a warning.
 */
const SESSION_OPTIONS = '-c hnsw.iterative_scan=strict_order';

export function dataSourceOptions(url: string): DataSourceOptions {
  return { type: 'postgres', url, entities: ENTITIES, migrations: MIGRATIONS, migrationsRun: false, synchronize: false,
    extra: { options: SESSION_OPTIONS } };
}
