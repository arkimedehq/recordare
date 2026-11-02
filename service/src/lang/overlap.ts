// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Two short texts about the same thing (D53, 8.12c): a request to be reminded and the plan it is also, a "never mind" and
 * the request it withdraws. Words of four letters or more, compared by their first five letters so that inflections meet
 * ("ordinare" / "ordino", "abbonamento" / "abbonamenti"), accents folded; the shorter text must share at least half of its
 * words with the other. No language list: it works on any script that separates words.
 */
export function overlap(a: string, b: string, floor = 0.5): boolean {
  const stems = (s: string) => new Set(s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 4).map((w) => w.slice(0, 5)));
  const sa = stems(a), sb = stems(b);
  if (!sa.size || !sb.size) return false;
  const shared = [...sa].filter((w) => sb.has(w)).length;
  return shared / Math.min(sa.size, sb.size) >= floor;
}
