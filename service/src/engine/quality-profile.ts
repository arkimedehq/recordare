// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Quality profiles (D35): cost is an option, not a limit. Every costly knob of the engine and of
 * recall lives here, never as scattered branches; the installation picks a default
 * (`QUALITY_PROFILE`) and each owner may override it (`owners.quality_profile`).
 * Models stay provider configuration (D27): a profile only says which configured role to use
 * (`main` / `light`) and whether reasoning is allowed. `balanced` = service v4 engine + the h11 recall changes.
 */
import { type ModelRole } from '../llm/llm.port';

export const QUALITY_PROFILES = ['economy', 'balanced', 'full'] as const;
export type QualityProfileName = (typeof QUALITY_PROFILES)[number];

export interface QualityProfile {
  name: QualityProfileName;
  /** Max characters of messages per extraction call. */
  windowChars: number;
  /** Model role of the extraction call (`light` falls back to the main model when none is configured). */
  extractionRole: ModelRole;
  /** Let the extraction model reason (slower, more output tokens). */
  reasoning: boolean;
  /** Episode list shown to the extractor: most recent + older ones related to the window. */
  recentEpisodes: number;
  relatedEpisodes: number;
  /** Near-duplicate candidates: ± days, minimum embedding similarity. */
  resolverWindowDays: number;
  resolverSimilarity: number;
  /** Chat excerpts returned next to matching episodes (more when episodes are few). */
  rawHitsAlongside: number;
}

const PROFILES: Record<QualityProfileName, QualityProfile> = {
  economy: {
    name: 'economy', windowChars: 16_000, extractionRole: 'light', reasoning: false,
    recentEpisodes: 6, relatedEpisodes: 6, resolverWindowDays: 3, resolverSimilarity: 0.7, rawHitsAlongside: 1,
  },
  balanced: {
    name: 'balanced', windowChars: 12_000, extractionRole: 'main', reasoning: false,
    recentEpisodes: 8, relatedEpisodes: 10, resolverWindowDays: 3, resolverSimilarity: 0.7, rawHitsAlongside: 3,
  },
  full: {
    name: 'full', windowChars: 8_000, extractionRole: 'main', reasoning: true,
    recentEpisodes: 12, relatedEpisodes: 20, resolverWindowDays: 7, resolverSimilarity: 0.6, rawHitsAlongside: 5,
  },
};

/** The owner's profile, else the installation default; an explicit window size overrides the profile's. */
export function qualityProfile(ownerChoice: string | null | undefined, installationDefault: QualityProfileName,
  windowCharsOverride?: number): QualityProfile {
  const name = (QUALITY_PROFILES as readonly string[]).includes(ownerChoice ?? '') ? ownerChoice as QualityProfileName : installationDefault;
  const p = PROFILES[name];
  return windowCharsOverride ? { ...p, windowChars: windowCharsOverride } : p;
}
