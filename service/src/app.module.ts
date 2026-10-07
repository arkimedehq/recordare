// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validateEnv, type Env } from './config/env';
import { HealthController } from './health/health.controller';
import { dataSourceOptions } from './db/data-source-options';
import { LlmModule } from './llm/llm.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { AtlasModule } from './atlas/atlas.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { ConsoleModule } from './console/console.module';
import { ContextModule } from './recall/context.module';
import { MeController } from './me/me.controller';
import { QueueModule } from './queue/queue.module';
import { EngineModule } from './engine/engine.module';
import { RawLogModule } from './rawlog/rawlog.module';
import { McpModule } from './mcp/mcp.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, validate: validateEnv, cache: true,
      // tests configure process.env explicitly and never read the developer's .env
      ignoreEnvFile: process.env['NODE_ENV'] === 'test',
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        dataSourceOptions(config.get('DATABASE_URL', { infer: true })),
    }),
    TelemetryModule,
    AtlasModule,
    LlmModule,
    AuthModule,
    AdminModule,
    ConsoleModule,
    ContextModule,
    EngineModule,
    QueueModule,
    RawLogModule,
    McpModule,
  ],
  controllers: [HealthController, MeController],
})
export class AppModule {}
