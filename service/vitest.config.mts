// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Vitest configuration. SWC transforms TypeScript with legacy decorators + metadata, like
 * `nest build`, so tests can import @Injectable services and TypeORM entities.
 * Tests live in `test/**\/*.spec.ts`; `*.int.spec.ts` need Postgres / Redis (docker compose).
 */
import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

export default defineConfig({
  oxc: false,
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: 'es2022',
      },
    }),
  ],
  test: {
    globals: true,
    include: ['test/**/*.spec.ts'],
    environment: 'node',
  },
});
