// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { describe, expect, it } from 'vitest';
import { extractionOutputBudget } from '../../src/engine/extraction.runner';

const window = (...sizes: number[]) => sizes.map((n) => ({ content: 'x'.repeat(n) }));

describe('extraction output budget', () => {
  it('keeps 6000 tokens for a window of a profile size', () => {
    expect(extractionOutputBudget(window(200, 300, 1500))).toBe(6000);
    expect(extractionOutputBudget(window(9000))).toBe(6000);
  });

  it('grows with one long message (a diary pasted in a chat) and stops at 32000', () => {
    expect(extractionOutputBudget(window(21_000, 1600))).toBe(15_067);
    expect(extractionOutputBudget(window(64 * 1024))).toBe(32_000);
  });
});
