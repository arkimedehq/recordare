// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';

/** Errors as RFC 9457 problem details; internal errors never leak messages or stack traces. */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly log = new Logger(ProblemDetailsFilter.name);

  catch(err: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<{ status(n: number): { type(t: string): { send(b: string): void } } }>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'internal_error';
    let detail: string | undefined;
    if (err instanceof HttpException) {
      status = err.getStatus();
      const body = err.getResponse();
      if (typeof body === 'object' && body !== null) {
        const b = body as { code?: string; detail?: string };
        code = b.code ?? HttpStatus[status]?.toLowerCase() ?? 'error';
        detail = b.detail;
      } else {
        code = HttpStatus[status]?.toLowerCase() ?? 'error';
      }
    } else {
      this.log.error(err instanceof Error ? err.stack : String(err));
    }
    res.status(status).type('application/problem+json').send(JSON.stringify({
      type: 'about:blank', title: HttpStatus[status] ?? 'Error', status, code, ...(detail ? { detail } : {}),
    }));
  }
}
