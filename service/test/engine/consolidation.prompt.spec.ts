// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { DAY_DIGEST_SYSTEM, dayWordLimit } from '../../src/engine/consolidation.prompt';

describe('day digest word limit (digest.day.v3)', () => {
  it('grows with the day\'s items: 120 up to 10, 10 more per further item, at most 300', () => {
    expect([0, 1, 10, 11, 20, 28, 50].map(dayWordLimit)).toEqual([120, 120, 120, 130, 220, 300, 300]);
  });

  it('the system prompt takes the limit from the request, not a fixed number', () => {
    expect(DAY_DIGEST_SYSTEM).toContain('WORD LIMIT');
    expect(DAY_DIGEST_SYSTEM).not.toMatch(/at most \d+ words/);
  });
});
