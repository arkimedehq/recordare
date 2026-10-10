// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessToken, ApiKey, Client, ExternalIdentity, Memory, Person } from '../identity/identity.entities';
import { ProblemDetailsFilter } from '../common/problem-details.filter';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { MemoryResolver } from './memory-resolver.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Person, Memory, Client, ApiKey, AccessToken, ExternalIdentity])],
  providers: [
    AuthService,
    MemoryResolver,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
  ],
  exports: [AuthService, MemoryResolver],
})
export class AuthModule {}
