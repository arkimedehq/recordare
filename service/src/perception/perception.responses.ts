// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { z } from 'zod';

export const perceptionResponse = z.object({
  episodeId: z.uuid().describe('The episode that remembers it (origin `perceived`).'),
  duplicate: z.boolean().describe('The same perception was noticed a moment ago (same sensor, place and words): that one is answered.'),
  people: z.array(z.object({ personId: z.uuid(), name: z.string() })).describe('Who was recognised in this memory.'),
  expiresAt: z.string().nullable().describe('When it fades; null: kept.'),
});
