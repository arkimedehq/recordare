// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { describe, expect, it } from 'vitest';
import { qualityProfile } from '../../src/engine/quality-profile';

describe('quality profiles (D35)', () => {
  it('uses the owner choice, else the installation default; unknown values fall back', () => {
    expect(qualityProfile('full', 'balanced').name).toBe('full');
    expect(qualityProfile(null, 'economy').name).toBe('economy');
    expect(qualityProfile('platinum', 'balanced').name).toBe('balanced');
  });

  it('keeps balanced at the measured configuration', () => {
    expect(qualityProfile(null, 'balanced')).toEqual({
      name: 'balanced', windowChars: 12_000, extractionRole: 'main', reasoning: false,
      recentEpisodes: 8, relatedEpisodes: 10, resolverWindowDays: 3, resolverSimilarity: 0.7, rawHitsAlongside: 3,
    });
  });

  it('lets an explicit window size override the profile', () => {
    expect(qualityProfile('full', 'balanced', 4000).windowChars).toBe(4000);
  });
});
