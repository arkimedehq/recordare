// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * MCP streamable HTTP endpoint (docs/API.md §3): one session per memory, fixed at `initialize`;
 * every later request must come from the same credential acting for the same memory, otherwise
 * the session is closed (hosts reusing a session across users cannot cross memories).
 */
import { ForbiddenException, Inject, Injectable, Logger, NotFoundException, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Env } from '../config/env';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'node:crypto';
import { type IncomingMessage, type ServerResponse } from 'node:http';
import { MemoryResolver } from '../auth/memory-resolver.service';
import { type Principal } from '../auth/principal';
import { ConversationResolver } from '../auth/conversation-resolver.service';
import { DataSource } from 'typeorm';
import { CLOCK_PORT, type ClockPort } from '../clock/clock.port';
import { EpisodeSearchService } from '../recall/episode-search.service';
import { MemorySearchService } from '../recall/memory-search.service';
import { MemoryWriteService } from '../recall/memory-write.service';
import { registerTools } from './mcp-tools';
import { KnowledgeSearchService } from '../knowledge/knowledge-search.service';
import { SourcesService } from '../knowledge/sources.service';

interface Session {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  memoryId: string;
  credential: string;
}

const SESSION_HEADER = 'mcp-session-id';

function credentialId(p: Principal): string {
  return p.kind === 'client' ? `key:${p.keyId}` : p.kind === 'memory_token' ? `token:${p.tokenId}` : 'admin';
}

@Injectable()
export class McpService implements OnModuleDestroy {
  private readonly log = new Logger(McpService.name);
  private readonly sessions = new Map<string, Session>();

  constructor(
    private readonly memories: MemoryResolver,
    private readonly conversations: ConversationResolver,
    private readonly episodes: EpisodeSearchService,
    private readonly memory: MemorySearchService,
    private readonly writes: MemoryWriteService,
    private readonly knowledge: KnowledgeSearchService,
    private readonly sources: SourcesService,
    private readonly db: DataSource,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async handle(principal: Principal, externalUser: string | undefined, req: IncomingMessage, res: ServerResponse, body: unknown): Promise<void> {
    if (principal.kind === 'admin') throw new ForbiddenException();
    const memoryId = await this.memories.resolve(principal, externalUser);
    const sessionId = req.headers[SESSION_HEADER] as string | undefined;

    if (sessionId) {
      const session = this.sessions.get(sessionId);
      if (!session) throw new NotFoundException();
      if (session.memoryId !== memoryId || session.credential !== credentialId(principal)) {
        await this.close(sessionId);
        throw new ForbiddenException();
      }
      await session.transport.handleRequest(req, res, body);
      return;
    }
    if (req.method !== 'POST' || !isInitializeRequest(body)) throw new NotFoundException();

    const server = new McpServer({ name: 'recordare', version: '0.2.0' });
    const [settings] = await this.db.query(`SELECT timezone, locale FROM memories WHERE person_id = $1`, [memoryId]);
    registerTools(server, {
      principal, memoryId, conversations: this.conversations, episodes: this.episodes, memory: this.memory, writes: this.writes,
      knowledge: this.knowledge, sources: this.sources,
      clock: this.clock, settings: { timezone: settings.timezone, locale: settings.locale },
      allowClockOverride: this.config.get('ALLOW_CLOCK_OVERRIDE', { infer: true }),
    });
    const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        this.sessions.set(id, { transport, server, memoryId, credential: credentialId(principal) });
      },
    });
    transport.onclose = () => {
      if (transport.sessionId) this.sessions.delete(transport.sessionId);
    };
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  }

  private async close(id: string): Promise<void> {
    const s = this.sessions.get(id);
    this.sessions.delete(id);
    await s?.server.close().catch((err: unknown) => this.log.warn(`closing MCP session: ${(err as Error).message}`));
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.sessions.keys()].map((id) => this.close(id)));
  }
}
