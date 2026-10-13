// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/** OpenClaw plugin entry: `recordare` (does not take the memory slot: OpenClaw's own memory stays as it is). */
import { homedir } from 'node:os';
import { join } from 'node:path';
import { definePluginEntry } from 'openclaw/plugin-sdk/plugin-entry';
import { isCronSessionKey, isIncognitoSessionKey, isSubagentSessionKey } from 'openclaw/plugin-sdk/routing';
import { parseConfig } from './config.js';
import { registerRecordare } from './plugin.js';

export default definePluginEntry({
  id: 'recordare',
  name: 'Recordare',
  description: 'Long-term episodic memory kept by your own Recordare service: capture, recall before each turn, memory tools.',
  register(api) {
    const cfg = parseConfig(api.pluginConfig);
    if (!cfg) {
      api.logger.warn('recordare: not configured (set plugins.entries.recordare.config.url and apiKey); memory is off');
      return;
    }
    // OpenClaw's state dir (its own resolver; the same rule by hand on a host without it).
    const stateDir = api.runtime?.state?.resolveStateDir?.(process.env) || process.env.OPENCLAW_STATE_DIR?.trim() || join(homedir(), '.openclaw');
    const plugin = registerRecordare(api, cfg, {
      isIncognito: (k) => !!k && isIncognitoSessionKey(k),
      isCron: (k) => !!k && isCronSessionKey(k),
      isSubagent: (k) => !!k && isSubagentSessionKey(k),
    }, join(stateDir, 'recordare', 'outbox'));
    api.registerService({ id: 'recordare', start: () => undefined, stop: () => plugin.stop() });
  },
});
