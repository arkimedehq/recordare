// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { SetMetadata } from '@nestjs/common';
import { type z } from 'zod';

export const RETURNS_KEY = 'recordare:returns';

/**
 * The JSON a route answers, as a zod schema: the response half of the contract (OpenAPI, API.md). The decorated method
 * must return that type — the compiler checks the handler — and the tests check every response they see against it.
 */
export function Returns<S extends z.ZodType>(schema: S) {
  return <F extends (...args: never[]) => Promise<z.output<S>> | z.output<S>>(
    target: object, key: string | symbol, descriptor: TypedPropertyDescriptor<F>,
  ): void => {
    SetMetadata(RETURNS_KEY, schema)(target, key, descriptor);
  };
}
