// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Quality profiles (D35): cost is an option, not a limit. Every costly knob of the engine and of
 * recall lives here, never as scattered branches; the installation picks a default
 * (`QUALITY_PROFILE`) and each owner may override it (`owners.quality_profile`).
 * Models stay provider configuration (D27): every LLM task has its own configurable model; a profile only says
 * which task runs the extraction and whether reasoning is allowed. `balanced` = service v4 engine + the h11 recall changes.
 */
import { type LlmTask } from '../llm/llm.port';

export const QUALITY_PROFILES = ['economy', 'balanced', 'full'] as const;
export type QualityProfileName = (typeof QUALITY_PROFILES)[number];

export interface QualityProfile {
  name: QualityProfileName;
  /** Max characters of messages per extraction call. */
  windowChars: number;
  /** Which task's model runs the extraction (`extract_economy` uses the default model unless one is configured). */
  extractionTask: Extract<LlmTask, 'extract' | 'extract_economy'>;
  /** Let the extraction model reason (slower, more output tokens). */
  reasoning: boolean;
  /** Facts and notes in the episode call (`inline`) or in their own call on the `facts` task model (`separate`).
   * Measured 2026-10-06 (blind5, V4 Pro on `facts`): no gain on facts, answers within noise, +65 calls — so `inline`
   * everywhere; `separate` stays available (FACTS_PASS) for the M5 consolidation work. */
  factsPass: 'inline' | 'separate';
  /** Episode list shown to the extractor: most recent + older ones related to the window. */
  recentEpisodes: number;
  relatedEpisodes: number;
  /** Near-duplicate candidates: ± days, minimum embedding similarity. */
  resolverWindowDays: number;
  resolverSimilarity: number;
  /** Chat excerpts returned next to matching episodes (more when episodes are few). */
  rawHitsAlongside: number;
  /** Give the nightly diary (M5 digests) to period overviews. Measured 2026-10-07 (blind5, 3+3 runs): −1.9 pt,
   * within noise (overviews +0.12, other period questions lower) — off until a version shows a gain. */
  recallDigests: boolean;
  /** Nightly facts review (M5): the owner's facts checked against the episodes recorded since the last review — one
   * call per owner per night with new episodes, none otherwise. Off until a measurement shows a gain. */
  factsReview: boolean;
}

const PROFILES: Record<QualityProfileName, QualityProfile> = {
  economy: {
    name: 'economy', windowChars: 16_000, extractionTask: 'extract_economy', reasoning: false, factsPass: 'inline',
    recentEpisodes: 6, relatedEpisodes: 6, resolverWindowDays: 3, resolverSimilarity: 0.7, rawHitsAlongside: 1, recallDigests: false, factsReview: false,
  },
  balanced: {
    name: 'balanced', windowChars: 12_000, extractionTask: 'extract', reasoning: false, factsPass: 'inline',
    recentEpisodes: 8, relatedEpisodes: 10, resolverWindowDays: 3, resolverSimilarity: 0.7, rawHitsAlongside: 3, recallDigests: false, factsReview: false,
  },
  full: {
    name: 'full', windowChars: 8_000, extractionTask: 'extract', reasoning: true, factsPass: 'inline',
    recentEpisodes: 12, relatedEpisodes: 20, resolverWindowDays: 7, resolverSimilarity: 0.6, rawHitsAlongside: 5, recallDigests: false, factsReview: false,
  },
};

/** The owner's profile, else the installation default; explicit installation settings override single knobs. */
export function qualityProfile(ownerChoice: string | null | undefined, installationDefault: QualityProfileName,
  windowCharsOverride?: number, factsPassOverride?: QualityProfile['factsPass'], recallDigestsOverride?: boolean,
  factsReviewOverride?: boolean): QualityProfile {
  const name = (QUALITY_PROFILES as readonly string[]).includes(ownerChoice ?? '') ? ownerChoice as QualityProfileName : installationDefault;
  const p = PROFILES[name];
  return {
    ...p,
    ...(windowCharsOverride ? { windowChars: windowCharsOverride } : {}),
    ...(factsPassOverride ? { factsPass: factsPassOverride } : {}),
    ...(recallDigestsOverride !== undefined ? { recallDigests: recallDigestsOverride } : {}),
    ...(factsReviewOverride !== undefined ? { factsReview: factsReviewOverride } : {}),
  };
}
