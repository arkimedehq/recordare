// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@arkimedehq/recordare-client': fileURLToPath(new URL('../../packages/client/src/index.ts', import.meta.url)),
    },
  },
});
