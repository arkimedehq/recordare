// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * MCP streamable HTTP endpoint (docs/API.md §3): one session per owner, fixed at `initialize`;
 * every later request must come from the same credential acting for the same owner, otherwise
 * the session is closed (hosts reusing a session across users cannot cross memories).
 */
import { ForbiddenException, Injectable, Logger, NotFoundException, type OnModuleDestroy } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'node:crypto';
import { type IncomingMessage, type ServerResponse } from 'node:http';
import { OwnerResolver } from '../auth/owner-resolver.service';
import { type Principal } from '../auth/principal';
import { ViewerContextService } from '../auth/viewer-context.service';
import { RawLogSearchService } from '../rawlog/rawlog-search.service';
import { registerTools } from './mcp-tools';

interface Session {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  ownerId: string;
  credential: string;
}

const SESSION_HEADER = 'mcp-session-id';

function credentialId(p: Principal): string {
  return p.kind === 'client' ? `key:${p.keyId}` : p.kind === 'owner_token' ? `token:${p.tokenId}` : 'admin';
}

@Injectable()
export class McpService implements OnModuleDestroy {
  private readonly log = new Logger(McpService.name);
  private readonly sessions = new Map<string, Session>();

  constructor(
    private readonly owners: OwnerResolver,
    private readonly viewers: ViewerContextService,
    private readonly rawLog: RawLogSearchService,
  ) {}

  async handle(principal: Principal, externalUser: string | undefined, req: IncomingMessage, res: ServerResponse, body: unknown): Promise<void> {
    if (principal.kind === 'admin') throw new ForbiddenException();
    const ownerId = await this.owners.resolve(principal, externalUser);
    const sessionId = req.headers[SESSION_HEADER] as string | undefined;

    if (sessionId) {
      const session = this.sessions.get(sessionId);
      if (!session) throw new NotFoundException();
      if (session.ownerId !== ownerId || session.credential !== credentialId(principal)) {
        await this.close(sessionId);
        throw new ForbiddenException();
      }
      await session.transport.handleRequest(req, res, body);
      return;
    }
    if (req.method !== 'POST' || !isInitializeRequest(body)) throw new NotFoundException();

    const server = new McpServer({ name: 'recordare', version: '0.1.0' });
    registerTools(server, { principal, ownerId, viewers: this.viewers, rawLog: this.rawLog });
    const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        this.sessions.set(id, { transport, server, ownerId, credential: credentialId(principal) });
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
