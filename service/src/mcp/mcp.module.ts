// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { Module } from '@nestjs/common';
import { ConversationResolver } from '../auth/conversation-resolver.service';
import { RawLogSearchService } from '../rawlog/rawlog-search.service';
import { EpisodeSearchService } from '../recall/episode-search.service';
import { MemorySearchService } from '../recall/memory-search.service';
import { MemoryWriteService } from '../recall/memory-write.service';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';
import { KnowledgeModule } from '../knowledge/knowledge.module';

@Module({ imports: [KnowledgeModule], controllers: [McpController], providers: [McpService, ConversationResolver, RawLogSearchService, EpisodeSearchService, MemorySearchService, MemoryWriteService] })
export class McpModule {}
