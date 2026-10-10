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
    } else if (isClientError(err)) {
      // The HTTP body parser's own errors (too large, malformed JSON) are the client's: their status, never a 500.
      status = err.status;
      code = err.type === 'entity.too.large' ? 'payload_too_large' : err.type === 'entity.parse.failed' ? 'invalid_json' : HttpStatus[status]?.toLowerCase() ?? 'error';
    } else {
      this.log.error(err instanceof Error ? err.stack : String(err));
    }
    res.status(status).type('application/problem+json').send(JSON.stringify({
      type: 'about:blank', title: HttpStatus[status] ?? 'Error', status, code, ...(detail ? { detail } : {}),
    }));
  }
}

/** An http-errors error meant for the client (body parser): status 4xx, `expose` set. */
function isClientError(err: unknown): err is { status: number; type?: string } {
  const e = err as { status?: unknown; expose?: unknown };
  return typeof e?.status === 'number' && e.status >= 400 && e.status < 500 && e.expose === true;
}
