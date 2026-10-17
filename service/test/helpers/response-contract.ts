// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { isDeepStrictEqual } from 'node:util';
import { map, type Observable } from 'rxjs';
import { type z } from 'zod';
import { RETURNS_KEY } from '../../src/common/returns';

/**
 * Every JSON answer the tests see is checked against its route's `@Returns` schema, as it goes on the wire: a field
 * missing, of another type, or not in the schema fails the request (500) and is printed — the response half of the
 * contract (OpenAPI) cannot drift from what the service answers.
 */
export class ResponseContract implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const schema = Reflect.getMetadata(RETURNS_KEY, ctx.getHandler()) as z.ZodType | undefined;
    if (!schema) return next.handle();
    const route = `${ctx.getClass().name}.${ctx.getHandler().name}`;
    return next.handle().pipe(map((data: unknown) => {
      const wire: unknown = data === undefined ? undefined : JSON.parse(JSON.stringify(data));
      const parsed = schema.safeParse(wire);
      const problem = !parsed.success
        ? parsed.error.issues.map((i) => `${i.path.join('.') || '(response)'}: ${i.message}`).join('; ')
        : !isDeepStrictEqual(JSON.parse(JSON.stringify(parsed.data ?? null)), wire ?? null) ? 'fields not in the schema' : null;
      if (problem) {
        const msg = `response contract broken by ${route}: ${problem}\n${JSON.stringify(wire).slice(0, 2_000)}`;
        process.stderr.write(`${msg}\n`);
        throw new Error(msg);
      }
      return data;
    }));
  }
}
