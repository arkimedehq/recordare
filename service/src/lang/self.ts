// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Leak detector for first-person memories (WORK_PLAN 8.4, both modes since 8.5; replaces 4.11's `nameOwner`): a memory is written in the
 * first person, which no substitution can produce (verbs agree with the subject), so the run summary counts the items
 * that still speak of "I" in the third person — the self's name, or a stand-in for it ("the user", "l'utente", "the
 * owner", "the assistant"…) in any of the most used languages. Counts only (WORK_PLAN 4.12): the text is never logged.
 */
import { normalize } from './locales';

/** Third-person stand-ins for the self, by language (lower case; matched as whole words, or anywhere in CJK scripts). */
const STAND_INS: Record<string, string[]> = {
  en: ['the user', "the user's", 'the owner', "the owner's", 'the assistant', "the assistant's"],
  it: ["l'utente", "dell'utente", "all'utente", "l'owner", "dell'owner", "all'owner", 'il proprietario', 'la proprietaria',
    "l'assistente", "dell'assistente", "all'assistente"],
  es: ['el usuario', 'la usuaria', 'del usuario', 'al usuario', 'el propietario', 'el asistente', 'del asistente'],
  fr: ["l'utilisateur", "l'utilisatrice", "de l'utilisateur", 'le propriétaire', "l'assistant", "de l'assistant"],
  de: ['der benutzer', 'der nutzer', 'die nutzerin', 'des nutzers', 'des benutzers', 'der besitzer', 'der assistent', 'des assistenten'],
  pt: ['o usuário', 'a usuária', 'o utilizador', 'do usuário', 'o proprietário', 'o assistente', 'do assistente'],
  nl: ['de gebruiker', 'de eigenaar', 'de assistent'],
  pl: ['użytkownik', 'użytkowniczka', 'asystent'],
  ru: ['пользователь', 'пользователя', 'владелец', 'ассистент'],
  uk: ['користувач', 'користувача', 'власник', 'асистент'],
  tr: ['kullanıcı', 'kullanıcının', 'asistan'],
  id: ['pengguna', 'asisten'],
  vi: ['người dùng', 'trợ lý'],
  ro: ['utilizatorul', 'asistentul'],
  el: ['ο χρήστης', 'του χρήστη', 'ο βοηθός'],
  zh: ['用户', '助手'],
  ja: ['ユーザー', 'アシスタント'],
  ko: ['사용자', '어시스턴트'],
  hi: ['उपयोगकर्ता', 'सहायक'],
  ar: ['المستخدم', 'المساعد'],
  bn: ['ব্যবহারকারী'],
  fa: ['کاربر'],
  ur: ['صارف'],
  th: ['ผู้ใช้'],
  sw: ['mtumiaji'],
};

const PHRASES = [...new Set(Object.values(STAND_INS).flat().map(normalize))];
const NO_SPACES = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}]/u;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const fold = (s: string) => normalize(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
const has = (text: string, phrase: string) => NO_SPACES.test(phrase)
  ? text.includes(phrase)
  : new RegExp(`(?<![\\p{L}\\p{N}])${escape(phrase)}(?![\\p{L}\\p{N}])`, 'u').test(text);

export type SelfLeak = 'name' | 'stand_in';

/** Whether a first-person memory still speaks of the self in the third person, and how. */
export function selfLeak(text: string, selfNames: string[]): SelfLeak | null {
  const t = normalize(text);
  const folded = fold(text);
  if (selfNames.some((n) => n.trim().length >= 2 && has(folded, fold(n)))) return 'name';
  if (PHRASES.some((p) => has(t, p))) return 'stand_in';
  return null;
}
