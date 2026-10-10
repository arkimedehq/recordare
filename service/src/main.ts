// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { type Env } from './config/env';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { configureHttp } from './http';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  configureHttp(app);
  app.enableShutdownHooks();
  // Whatever an open connection or a job does, a stop request ends the process: a half-closed instance that still
  // consumes the queues next to a new one is worse than an interrupted job (jobs are retried).
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => setTimeout(() => process.exit(1), 30_000).unref());
  }
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  await app.listen(config.get('PORT', { infer: true }));
}

void bootstrap();
