// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/** HTTP set-up shared by the server and the tests: the JSON body limit (MAX_REQUEST_BYTES; bigger sources come in parts). */
import { type NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { type Env } from './config/env';

export function configureHttp(app: NestExpressApplication): void {
  const limit = app.get<ConfigService<Env, true>>(ConfigService).get('MAX_REQUEST_BYTES', { infer: true });
  app.useBodyParser('json', { limit });
}
