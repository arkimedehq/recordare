// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/** Entry point: configuration from the environment, the proxy server, a graceful stop. */
import { loadConfig } from './config.js';
import { Memory, type Logger } from './memory.js';
import { createProxy } from './proxy.js';

const VERSION = '0.1.0';
const log: Logger = {
  info: (m) => console.log(`${new Date().toISOString()} info ${m}`),
  warn: (m) => console.warn(`${new Date().toISOString()} warn ${m}`),
};

const cfg = loadConfig();
const memory = cfg.recordareUrl && cfg.recordareApiKey ? new Memory(cfg, log) : null;
const server = createProxy(cfg, { log, memory });
server.listen(cfg.port, () => {
  log.info(`recordare-openai-proxy ${VERSION} on :${cfg.port} → ${cfg.upstreamBaseUrl}; Recordare ${memory
    ? `${cfg.personal ? 'personal token' : 'client key'}, resolvers ${cfg.resolvers.join(',')}` : 'off (pass-through)'}`);
});

let stopping = false;
async function stop(): Promise<void> {
  if (stopping) return;
  stopping = true;
  server.close();
  await memory?.stop();
  process.exit(0);
}
process.on('SIGTERM', () => { void stop(); });
process.on('SIGINT', () => { void stop(); });
