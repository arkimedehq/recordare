// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { All, Controller, Headers, Req, Res } from '@nestjs/common';
import { type Request, type Response } from 'express';
import { CurrentPrincipal, RequireScopes } from '../auth/decorators';
import { USER_HEADER } from '../auth/owner-resolver.service';
import { type Principal } from '../auth/principal';
import { McpService } from './mcp.service';

@Controller('mcp')
@RequireScopes('mcp')
export class McpController {
  constructor(private readonly mcp: McpService) {}

  @All()
  async handle(
    @CurrentPrincipal() principal: Principal, @Headers(USER_HEADER) user: string | undefined,
    @Req() req: Request, @Res() res: Response,
  ): Promise<void> {
    await this.mcp.handle(principal, user, req, res, req.body);
  }
}
