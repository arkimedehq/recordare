// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Whether a person reference an extraction wrote is a name (WORK_PLAN 8.4: contacts are created for named people, not
 * for "mamma", "the neighbours", "amiche del nuoto"). Works by letter case, so it holds for every script that has case
 * (Latin, Greek, Cyrillic, Armenian…); in scripts without case (Han, Arabic, Devanagari…) every reference counts as a
 * name, since nothing in the writing tells them apart.
 */
const CASED = /[\p{Lu}\p{Ll}]/u;
const UPPER = /\p{Lu}/u;

/** A proper name: in a cased script, at least one word starts with a capital letter ("Giulia", "zia Carmela"). */
export function isProperName(raw: string): boolean {
  const s = raw.trim();
  if (!s) return false;
  if (!CASED.test(s)) return true;
  return s.split(/\s+/).some((w) => UPPER.test(w.charAt(0)));
}

/** A full name: two or more words, each capitalised ("Marco Bellini"; not "zia Carmela", not "dottor Ferri"). */
export function isFullName(raw: string): boolean {
  const words = raw.trim().split(/\s+/);
  if (words.length < 2) return false;
  if (!CASED.test(raw)) return false;
  return words.every((w) => UPPER.test(w.charAt(0)) || /^(de|di|da|del|della|van|von|der|den|la|le|du|dos|das|bin|ibn|al)$/i.test(w));
}
