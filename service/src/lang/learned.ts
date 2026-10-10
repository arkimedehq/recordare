// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * The episode a learned source leaves when no conversation tells of it (WORK_PLAN 8.9, D49): "On 10 October 2026 I
 * learned “The boiler manual” from Paolo", in the memory's language, in the first person, with the memory's gender where
 * the verb agrees with it (Russian, Ukrainian, Polish). The date comes from Intl; a locale not listed falls back to
 * English.
 */
import { type LOCALES } from './locales';

type Gender = 'masculine' | 'feminine' | 'neutral';
type Template = (date: string, title: string, from: string | null, gender: Gender) => string;

/** Masculine / feminine forms of a verb; neutral (no grammatical gender for "I") shows both. */
const g = (gender: Gender, m: string, f: string): string => (gender === 'feminine' ? f : gender === 'masculine' ? m : `${m}/${f}`);

const TEMPLATES: Record<(typeof LOCALES)[number], Template> = {
  en: (d, t, p) => `On ${d} I learned “${t}”${p ? ` from ${p}` : ''}.`,
  zh: (d, t, p) => `我在${d}学习了《${t}》${p ? `（来自${p}）` : ''}。`,
  hi: (d, t, p) => `${d} को मैंने «${t}» सीखा${p ? ` (${p} से)` : ''}।`,
  es: (d, t, p) => `El ${d} aprendí «${t}»${p ? `, de ${p}` : ''}.`,
  fr: (d, t, p) => `Le ${d.replace(/^1 /, '1er ')}, j'ai appris « ${t} »${p ? `, de ${p}` : ''}.`,
  ar: (d, t, p) => `في ${d} تعلّمتُ «${t}»${p ? ` من ${p}` : ''}.`,
  bn: (d, t, p) => `${d} তারিখে আমি «${t}» শিখেছি${p ? ` (${p}-এর কাছ থেকে)` : ''}।`,
  pt: (d, t, p) => `Em ${d} aprendi «${t}»${p ? `, de ${p}` : ''}.`,
  ru: (d, t, p, gn) => `${d} я ${g(gn, 'изучил', 'изучила')} «${t}»${p ? ` (от ${p})` : ''}.`,
  ur: (d, t, p) => `${d} کو میں نے «${t}» سیکھا${p ? ` (${p} سے)` : ''}۔`,
  id: (d, t, p) => `Pada ${d} saya mempelajari “${t}”${p ? ` dari ${p}` : ''}.`,
  de: (d, t, p) => `Am ${d} habe ich „${t}“ gelernt${p ? ` (von ${p})` : ''}.`,
  ja: (d, t, p) => `${d}に「${t}」を学んだ${p ? `（${p}から）` : ''}。`,
  it: (d, t, p) => `${/^(8|11) /.test(d) ? "L'" : 'Il '}${d.replace(/^1 /, '1º ')} ho imparato «${t}»${p ? `, da ${p}` : ''}.`,
  tr: (d, t, p) => `${d} tarihinde “${t}” öğrendim${p ? ` (kaynak: ${p})` : ''}.`,
  ko: (d, t, p) => `${d}에 「${t}」을(를) 배웠다${p ? ` (${p}에게서)` : ''}.`,
  vi: (d, t, p) => `Ngày ${d}, tôi đã học “${t}”${p ? ` từ ${p}` : ''}.`,
  fa: (d, t, p) => `در ${d} «${t}» را یاد گرفتم${p ? ` (از ${p})` : ''}.`,
  pl: (d, t, p, gn) => `${d} ${g(gn, 'nauczyłem', 'nauczyłam')} się „${t}”${p ? ` (od ${p})` : ''}.`,
  nl: (d, t, p) => `Op ${d} heb ik ‘${t}’ geleerd${p ? ` (van ${p})` : ''}.`,
  th: (d, t, p) => `เมื่อ ${d} ฉันได้เรียนรู้ “${t}”${p ? ` จาก ${p}` : ''}`,
  sw: (d, t, p) => `Tarehe ${d} nilijifunza “${t}”${p ? ` kutoka kwa ${p}` : ''}.`,
  uk: (d, t, p, gn) => `${d} я ${g(gn, 'вивчив', 'вивчила')} «${t}»${p ? ` (від ${p})` : ''}.`,
  ro: (d, t, p) => `Pe ${d} am învățat „${t}”${p ? ` de la ${p}` : ''}.`,
  el: (d, t, p) => `Στις ${d} έμαθα «${t}»${p ? ` (από: ${p})` : ''}.`,
};

/** A long date ("10 ottobre 2026") in `locale`, English when Intl does not know the locale. */
function longDate(locale: string, at: Date, timeZone: string): string {
  const parts = (l: string) => new Intl.DateTimeFormat(l, { dateStyle: 'long', timeZone }).formatToParts(at).map((p) => p.value).join('');
  try {
    return parts(locale);
  } catch {
    return parts('en');
  }
}

/**
 * "On 10 October 2026 I learned “title” from Paolo" in `locale` (its language part: "it-IT" → it). `from` is the name of
 * who gave it, null when it was mine.
 */
export function learnedSentence(locale: string, at: Date, timeZone: string, title: string, from: string | null, gender: Gender): string {
  const lang = (locale.split(/[-_]/)[0] ?? 'en').toLowerCase();
  const template = (TEMPLATES as Record<string, Template>)[lang] ?? TEMPLATES.en;
  return template(longDate(locale, at, timeZone), title, from, gender);
}
