// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validateEnv, type Env } from './config/env';
import { HealthController } from './health/health.controller';
import { dataSourceOptions } from './db/data-source-options';
import { LlmModule } from './llm/llm.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { MeController } from './me/me.controller';
import { QueueModule } from './queue/queue.module';
import { RawLogModule } from './rawlog/rawlog.module';

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
    LlmModule,
    AuthModule,
    AdminModule,
    QueueModule,
    RawLogModule,
  ],
  controllers: [HealthController, MeController],
})
export class AppModule {}
