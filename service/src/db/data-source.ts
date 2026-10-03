// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/** DataSource for the TypeORM CLI (migrations). Reads DATABASE_URL from the environment. */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source-options';

const url = process.env['DATABASE_URL'];
if (!url) throw new Error('DATABASE_URL is required');

export default new DataSource(dataSourceOptions(url));
