// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Admin console (WORK_PLAN 6.9): a static page over the admin API, served by Recordare itself. The page is public (it
 * holds no data); every call it makes needs the admin key, typed by the operator and kept in that browser tab only.
 */
import { Controller, Get, Module, NotFoundException, Param, Res } from '@nestjs/common';
import { type Response } from 'express';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Public } from '../auth/decorators';

/** service/console, from dist/console (build, container) or src/console (tests). */
const DIR = join(__dirname, '..', '..', 'console');
const TYPES: Record<string, string> = {
  'index.html': 'text/html; charset=utf-8',
  'app.js': 'text/javascript; charset=utf-8',
  'console.css': 'text/css; charset=utf-8',
};
const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; "
    + "base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
};

@Controller('admin')
export class ConsoleController {
  private readonly files = new Map<string, string>();

  @Get()
  @Public()
  page(@Res() res: Response): void {
    this.send(res, 'index.html');
  }

  @Get(':file')
  @Public()
  asset(@Param('file') file: string, @Res() res: Response): void {
    if (file === 'index.html' || !TYPES[file]) throw new NotFoundException();
    this.send(res, file);
  }

  private send(res: Response, name: string): void {
    let body = this.files.get(name);
    if (body === undefined) {
      body = readFileSync(join(DIR, name), 'utf8');
      this.files.set(name, body);
    }
    res.set({ ...SECURITY_HEADERS, 'Content-Type': TYPES[name] }).send(body);
  }
}

@Module({ controllers: [ConsoleController] })
export class ConsoleModule {}
