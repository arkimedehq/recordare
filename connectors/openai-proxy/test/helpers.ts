// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { type ProxyConfig, loadConfig } from '../src/config.js';

export function config(env: Record<string, string> = {}): ProxyConfig {
  return loadConfig({ UPSTREAM_BASE_URL: 'http://upstream/v1', TZ: 'Europe/Rome', ...env });
}

export const silent = { info: () => undefined, warn: () => undefined };
