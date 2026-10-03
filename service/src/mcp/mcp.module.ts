// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { Module } from '@nestjs/common';
import { ViewerContextService } from '../auth/viewer-context.service';
import { RawLogSearchService } from '../rawlog/rawlog-search.service';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';

@Module({ controllers: [McpController], providers: [McpService, ViewerContextService, RawLogSearchService] })
export class McpModule {}
