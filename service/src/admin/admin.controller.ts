// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { Body, Controller, Delete, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ZodBody } from '../common/zod-body.pipe';
import { AdminService } from './admin.service';
import {
  createClientSchema, createIdentitySchema, createKeySchema, createOwnerSchema, createTokenSchema, updateOwnerSchema,
  type CreateClient, type CreateIdentity, type CreateKey, type CreateOwner, type CreateToken, type UpdateOwner,
} from './admin.schemas';

/** Admin API (no @RequireScopes → admin credential only). */
@Controller('api/v1/admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Post('clients')
  createClient(@Body(new ZodBody(createClientSchema)) body: CreateClient) {
    return this.admin.createClient(body);
  }

  @Post('clients/:id/keys')
  createKey(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodBody(createKeySchema)) body: CreateKey) {
    return this.admin.createKey(id, body);
  }

  @Delete('keys/:id')
  @HttpCode(204)
  revokeKey(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.revokeKey(id);
  }

  @Post('owners')
  createOwner(@Body(new ZodBody(createOwnerSchema)) body: CreateOwner) {
    return this.admin.createOwner(body);
  }

  @Patch('owners/:id')
  updateOwner(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodBody(updateOwnerSchema)) body: UpdateOwner) {
    return this.admin.updateOwner(id, body);
  }

  @Post('identities')
  createIdentity(@Body(new ZodBody(createIdentitySchema)) body: CreateIdentity) {
    return this.admin.createIdentity(body);
  }

  @Post('owners/:id/tokens')
  createToken(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodBody(createTokenSchema)) body: CreateToken) {
    return this.admin.createToken(id, body);
  }

  @Delete('tokens/:id')
  @HttpCode(204)
  revokeToken(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.revokeToken(id);
  }
}
