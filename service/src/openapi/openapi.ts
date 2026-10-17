// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * The OpenAPI 3.1 document, generated from the routes themselves (API.md: the zod schemas are the contract): paths and
 * methods from the Nest metadata, request bodies and query parameters from the `ZodBody` pipes, path parameters from
 * the route, the bearer scopes from `@RequireScopes`, the JSON answers from `@Returns`.
 */
import { type Type } from '@nestjs/common';
import { HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA, ROUTE_ARGS_METADATA, SSE_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common/enums/request-method.enum';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';
import { ParseUUIDPipe } from '@nestjs/common/pipes/parse-uuid.pipe';
import { z } from 'zod';
import { PUBLIC_KEY, SCOPES_KEY } from '../auth/decorators';
import { USER_HEADER } from '../auth/memory-resolver.service';
import { RETURNS_KEY } from '../common/returns';
import { ZodBody } from '../common/zod-body.pipe';
import { VERSION } from '../version';

type Json = Record<string, unknown>;
type RouteArg = { type: number; data?: unknown; pipes?: unknown[] };

const PROBLEM = { $ref: '#/components/schemas/Problem' };

/** JSON Schema of a zod schema — the input it accepts (what the client sends) or its output (what the service answers). */
function schemaOf(schema: z.ZodType, io: 'input' | 'output' = 'input'): Json {
  const out = z.toJSONSchema(schema, { io, unrepresentable: 'any' }) as Json;
  delete out['$schema'];
  return out;
}

function zodOf(arg: RouteArg): z.ZodType | undefined {
  return arg.pipes?.find((p): p is ZodBody<unknown> => p instanceof ZodBody)?.schema;
}

function join(...parts: string[]): string {
  return '/' + parts.map((p) => p.replace(/^\/+|\/+$/g, '')).filter(Boolean).join('/');
}

/** The handler's parameters; the metadata key is `<RouteParamtypes>:<index>` (custom decorators give NaN). */
function routeArgs(ctrl: Type, name: string): RouteArg[] {
  const meta = (Reflect.getMetadata(ROUTE_ARGS_METADATA, ctrl, name) ?? {}) as Record<string, Omit<RouteArg, 'type'>>;
  return Object.entries(meta).map(([key, arg]) => ({ ...arg, type: Number(key.split(':')[0]) }));
}

/** The operation object of one route handler. */
function operation(ctrl: Type, name: string, tag: string, scopes: string[] | undefined, isPublic: boolean, path: string): Json {
  const handler = (ctrl.prototype as Record<string, unknown>)[name] as object;
  const args = routeArgs(ctrl, name);
  const parameters: Json[] = [];
  let requestBody: Json | undefined;
  for (const param of path.match(/\{(\w+)\}/g)?.map((m) => m.slice(1, -1)) ?? []) {
    const arg = args.find((a) => a.type === RouteParamtypes.PARAM && a.data === param);
    const uuid = arg?.pipes?.some((p) => p instanceof ParseUUIDPipe || p === ParseUUIDPipe);
    parameters.push({ name: param, in: 'path', required: true, schema: uuid ? { type: 'string', format: 'uuid' } : { type: 'string' } });
  }
  for (const arg of args) {
    const schema = zodOf(arg);
    // The schemas are the contract: a body or a whole query read without one would be undocumented and unvalidated.
    if ((arg.type === RouteParamtypes.BODY || (arg.type === RouteParamtypes.QUERY && typeof arg.data !== 'string')) && !schema) {
      throw new Error(`${ctrl.name}.${name}: @Body() / @Query() without a ZodBody schema`);
    }
    if (arg.type === RouteParamtypes.BODY && schema) {
      requestBody = { required: true, content: { 'application/json': { schema: schemaOf(schema) } } };
    } else if (arg.type === RouteParamtypes.QUERY) {
      if (typeof arg.data === 'string') {
        const uuid = arg.pipes?.some((p) => p instanceof ParseUUIDPipe);
        parameters.push({ name: arg.data, in: 'query', required: false, schema: uuid ? { type: 'string', format: 'uuid' } : { type: 'string' } });
      } else if (schema) {
        const s = schemaOf(schema) as { properties?: Record<string, Json>; required?: string[] };
        for (const [q, prop] of Object.entries(s.properties ?? {})) {
          parameters.push({ name: q, in: 'query', required: s.required?.includes(q) ?? false, schema: prop });
        }
      }
    } else if (arg.type === RouteParamtypes.HEADERS && arg.data === USER_HEADER) {
      parameters.push({
        name: 'X-Recordare-User', in: 'header', required: false, schema: { type: 'string' },
        description: "With a client key: the client's user id whose memory the call acts on (a personal token is the memory).",
      });
    }
  }
  const sse = Reflect.getMetadata(SSE_METADATA, handler) === true;
  const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod;
  const code = Number(Reflect.getMetadata(HTTP_CODE_METADATA, handler) ?? (method === RequestMethod.POST ? 201 : 200));
  const returns = Reflect.getMetadata(RETURNS_KEY, handler) as z.ZodType | undefined;
  const raw = args.some((a) => a.type === RouteParamtypes.RESPONSE);
  let ok: Json;
  if (code === 204) ok = { description: 'Done, no content' };
  else if (returns) ok = { description: code === 202 ? 'Accepted, carried out in the background' : 'OK', content: { 'application/json': { schema: schemaOf(returns, 'output') } } };
  else if (sse) ok = { description: 'Server-sent events', content: { 'text/event-stream': {} } };
  else if (raw) ok = { description: 'A file, written by the handler', content: { 'application/json': {} } };
  else if (code === 202) ok = { description: 'Accepted, carried out in the background' };
  // The response half of the contract: a JSON answer without a schema would be undocumented.
  else throw new Error(`${ctrl.name}.${name}: a JSON response without @Returns`);
  return {
    operationId: `${tag}_${name}`,
    // The handler's name in words ("forgetPeriod" → "Forget period"): the routes carry no other summary.
    summary: name.replace(/([A-Z])/g, ' $1').toLowerCase().replace(/^./, (c) => c.toUpperCase()),
    tags: [tag],
    ...(isPublic ? { security: [] } : {}),
    ...(isPublic ? {} : { 'x-recordare-scopes': scopes ?? ['admin'] }),
    description: isPublic ? 'No authentication.' : scopes ? `Bearer key or personal token with the scopes: ${scopes.join(', ')}.` : 'Admin key.',
    ...(parameters.length ? { parameters } : {}),
    ...(requestBody ? { requestBody } : {}),
    responses: { [String(code)]: ok, '4XX': { description: 'Client error', content: { 'application/problem+json': { schema: PROBLEM } } } },
  };
}

const METHODS: Partial<Record<RequestMethod, string>> = {
  [RequestMethod.GET]: 'get', [RequestMethod.POST]: 'post', [RequestMethod.PUT]: 'put',
  [RequestMethod.PATCH]: 'patch', [RequestMethod.DELETE]: 'delete',
};

/** The document for the given controllers; only routes under `api/` (the console's HTML pages and `/mcp` are not REST). */
export function buildOpenApi(controllers: Type[]): Json {
  const paths: Record<string, Record<string, Json>> = {};
  for (const ctrl of controllers) {
    const base = String(Reflect.getMetadata(PATH_METADATA, ctrl) ?? '');
    const tag = ctrl.name.replace(/Controller$/, '').replace(/^./, (c) => c.toLowerCase());
    const ctrlScopes = Reflect.getMetadata(SCOPES_KEY, ctrl) as string[] | undefined;
    for (const name of Object.getOwnPropertyNames(ctrl.prototype)) {
      const handler = (ctrl.prototype as Record<string, unknown>)[name];
      if (name === 'constructor' || typeof handler !== 'function') continue;
      const method = METHODS[Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod];
      const sub = Reflect.getMetadata(PATH_METADATA, handler) as string | string[] | undefined;
      if (!method || sub === undefined) continue;
      for (const s of Array.isArray(sub) ? sub : [sub]) {
        const path = join(base, s).replace(/:(\w+)/g, '{$1}');
        if (!path.startsWith('/api/')) continue;
        const scopes = (Reflect.getMetadata(SCOPES_KEY, handler) as string[] | undefined) ?? ctrlScopes;
        const isPublic = Reflect.getMetadata(PUBLIC_KEY, handler) === true || Reflect.getMetadata(PUBLIC_KEY, ctrl) === true;
        (paths[path] ??= {})[method] = operation(ctrl, name, tag, scopes, isPublic, path);
      }
    }
  }
  const sorted = Object.fromEntries(Object.entries(paths).sort(([a], [b]) => a.localeCompare(b)));
  return {
    openapi: '3.1.0',
    info: {
      title: 'Recordare', version: VERSION, license: { name: 'AGPL-3.0-or-later', identifier: 'AGPL-3.0-or-later' },
      description: 'Memory service for AI agents: REST ingest, read API and admin API. The MCP endpoint (`/mcp`, streamable HTTP) '
        + 'is described by its own tool list. Contract and response shapes: docs/API.md.',
    },
    servers: [{ url: '/', description: 'This Recordare instance' }],
    security: [{ bearer: [] }],
    paths: sorted,
    components: {
      securitySchemes: { bearer: { type: 'http', scheme: 'bearer', description: 'Client key, personal token or admin key (D24).' } },
      schemas: {
        Problem: {
          type: 'object', description: 'RFC 9457 problem details.', required: ['type', 'title', 'status', 'code'],
          properties: { type: { type: 'string' }, title: { type: 'string' }, status: { type: 'integer' }, code: { type: 'string' }, detail: { type: 'string' } },
        },
      },
    },
  };
}
