// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * The person's name wherever the model wrote "the owner" (the prompt's word for the person, kept in English on
 * purpose) or translated it. Languages with articles get "the owner" / "of the owner" forms; "the owner OF something"
 * (someone else's owner) is left alone. In every language the bare English word left inside the text is replaced too.
 * The model copies or translates the word in ≈ 5 % of episodes and notes (2026-10-08); naming the person in the prompt
 * instead cost ≈ 2 points on blind5 (extract.v9, 3 runs), so the fix is here, deterministic.
 */
const A = "['’]";
/** Word edges that also work for accented letters (\\b does not: "à", "é"). */
const B = String.raw`(?<![\p{L}\p{N}])`;
const E = String.raw`(?![\p{L}\p{N}])`;
/** Not followed by "of …" in that language: someone else's owner ("il proprietario del bar", "the owner of the bar"). */
const notOf = (words: string, elided = '') =>
  String.raw`(?!\s+(?:(?:${words})(?![\p{L}])${elided ? `|(?:${elided})['’]` : ''}))`;

type Rule = (text: string, name: string) => string;

const RULES: Record<string, Rule> = {
  en: (t, n) => t
    .replace(new RegExp(`${B}the owner${A}s${E}`, 'giu'), `${n}'s`)
    .replace(new RegExp(`${B}the owner${E}${notOf('of')}`, 'giu'), n),
  it: (t, n) => {
    const prep: Record<string, string> = { al: 'a', dal: 'da', nel: 'in', sul: 'su', del: 'di' };
    const of = notOf('del|della|dello|dei|degli|delle|di', 'd|dell');
    return t
      .replace(new RegExp(`${B}dell${A}owner${E}`, 'giu'), `di ${n}`)
      .replace(new RegExp(`${B}(al|dal|nel|sul)l${A}owner${E}`, 'giu'), (_m, p: string) => `${prep[p.toLowerCase()]} ${n}`)
      .replace(new RegExp(`${B}l${A}owner${E}`, 'giu'), n)
      .replace(new RegExp(`${B}(del|al|dal|nel|sul)(?:la)? propriet(?:ario|aria)${E}${of}`, 'giu'), (_m, p: string) => `${prep[p.toLowerCase()]} ${n}`)
      .replace(new RegExp(`${B}(?:il|la) propriet(?:ario|aria)${E}${of}`, 'giu'), n);
  },
  es: (t, n) => {
    const of = notOf('del|de');
    return t
      .replace(new RegExp(`${B}del (?:propietario|dueño)${E}${of}|${B}de la (?:propietaria|dueña)${E}${of}`, 'giu'), `de ${n}`)
      .replace(new RegExp(`${B}al (?:propietario|dueño)${E}${of}|${B}a la (?:propietaria|dueña)${E}${of}`, 'giu'), `a ${n}`)
      .replace(new RegExp(`${B}(?:el (?:propietario|dueño)|la (?:propietaria|dueña))${E}${of}`, 'giu'), n);
  },
  fr: (t, n) => {
    const of = notOf('du|de|des', 'd');
    return t
      .replace(new RegExp(`${B}du propriétaire${E}${of}|${B}de la propriétaire${E}${of}`, 'giu'), `de ${n}`)
      .replace(new RegExp(`${B}au propriétaire${E}${of}|${B}à la propriétaire${E}${of}`, 'giu'), `à ${n}`)
      .replace(new RegExp(`${B}(?:le|la) propriétaire${E}${of}`, 'giu'), n);
  },
  pt: (t, n) => {
    const of = notOf('do|da|dos|das|de');
    return t
      .replace(new RegExp(`${B}(?:do proprietário|da proprietária|do dono|da dona)${E}${of}`, 'giu'), `de ${n}`)
      .replace(new RegExp(`${B}(?:ao proprietário|à proprietária|ao dono|à dona)${E}${of}`, 'giu'), `a ${n}`)
      .replace(new RegExp(`${B}(?:o proprietário|a proprietária|o dono|a dona)${E}${of}`, 'giu'), n);
  },
  de: (t, n) => {
    const of = notOf('des|der|von|vom');
    return t
      .replace(new RegExp(`${B}(?:des besitzers|der besitzerin|des eigentümers|der eigentümerin)${E}${of}`, 'giu'), `von ${n}`)
      .replace(new RegExp(`${B}(?:dem besitzer|der besitzerin|dem eigentümer|der eigentümerin)${E}${of}`, 'giu'), n)
      .replace(new RegExp(`${B}(?:der besitzer|die besitzerin|der eigentümer|die eigentümerin)${E}${of}`, 'giu'), n);
  },
};

/** Any language: the English word itself left in the text ("Owner", "owner's"), when not followed by "of". */
const bare: Rule = (t, n) => t
  .replace(new RegExp(`${B}owner${A}s${E}`, 'giu'), `${n}'s`)
  .replace(new RegExp(`${B}owner${E}${notOf('of')}`, 'giu'), n);

export function nameOwner(text: string, name: string): string {
  return bare(Object.values(RULES).reduce((t, rule) => rule(t, name), text), name);
}
