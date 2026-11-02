// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { InitiativeModule } from '../initiative/initiative.module';

@Module({ imports: [InitiativeModule], controllers: [AdminController], providers: [AdminService] })
export class AdminModule {}
