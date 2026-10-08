// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Relation words by relation and language, for questions like "what did my sister say?" (recall/people.ts). The
 * extractor writes episode people as "Name (relation)" in the conversation's language, so both sides use these words.
 * Lower case; scripts without spaces are matched as substrings (locales.ts).
 */
import { type RelationKey } from './types';

export const RELATIONS: Record<RelationKey, Record<string, string[]>> = {
  mother: { en: ['mother', 'mom', 'mum'], it: ['madre', 'mamma'], es: ['madre', 'mamá'], fr: ['mère', 'maman'], de: ['mutter', 'mama'],
    pt: ['mãe'], ru: ['мама', 'мать'], zh: ['妈妈', '母亲'], ja: ['母', 'お母さん'], hi: ['माँ', 'माता'], ar: ['أمي', 'أم', 'والدتي'],
    bn: ['মা'], id: ['ibu'], tr: ['anne', 'annem'], ko: ['엄마', '어머니'], vi: ['mẹ'], pl: ['mama', 'matka'], nl: ['moeder', 'mama'], uk: ['мама', 'мати'] },
  father: { en: ['father', 'dad'], it: ['padre', 'papà', 'papa', 'babbo'], es: ['padre', 'papá'], fr: ['père', 'papa'], de: ['vater', 'papa'],
    pt: ['pai'], ru: ['папа', 'отец'], zh: ['爸爸', '父亲'], ja: ['父', 'お父さん'], hi: ['पिता', 'पापा'], ar: ['أبي', 'أب', 'والدي'],
    bn: ['বাবা'], id: ['ayah', 'bapak'], tr: ['baba', 'babam'], ko: ['아빠', '아버지'], vi: ['bố', 'cha'], pl: ['tata', 'ojciec'], nl: ['vader', 'papa'], uk: ['тато', 'батько'] },
  sister: { en: ['sister'], it: ['sorella'], es: ['hermana'], fr: ['sœur'], de: ['schwester'], pt: ['irmã'], ru: ['сестра'],
    zh: ['姐姐', '妹妹'], ja: ['姉', '妹'], hi: ['बहन'], ar: ['أختي', 'أخت'], bn: ['বোন'], id: ['kakak perempuan', 'adik perempuan', 'saudari'],
    tr: ['kız kardeş', 'abla'], ko: ['언니', '누나', '여동생'], vi: ['chị', 'em gái'], pl: ['siostra'], nl: ['zus'], uk: ['сестра'] },
  brother: { en: ['brother'], it: ['fratello'], es: ['hermano'], fr: ['frère'], de: ['bruder'], pt: ['irmão'], ru: ['брат'],
    zh: ['哥哥', '弟弟'], ja: ['兄', '弟'], hi: ['भाई'], ar: ['أخي', 'أخ'], bn: ['ভাই'], id: ['kakak laki-laki', 'adik laki-laki', 'saudara'],
    tr: ['erkek kardeş', 'ağabey'], ko: ['오빠', '형', '남동생'], vi: ['anh trai', 'em trai'], pl: ['brat'], nl: ['broer'], uk: ['брат'] },
  wife: { en: ['wife'], it: ['moglie'], es: ['esposa', 'mujer'], fr: ['épouse'], de: ['ehefrau'], pt: ['esposa', 'mulher'],
    ru: ['жена'], zh: ['妻子', '老婆'], ja: ['妻'], hi: ['पत्नी'], ar: ['زوجتي', 'زوجة'], bn: ['স্ত্রী'], id: ['istri'], tr: ['eşim', 'karım'],
    ko: ['아내'], vi: ['vợ'], pl: ['żona'], nl: ['vrouw'], uk: ['дружина'] },
  husband: { en: ['husband'], it: ['marito'], es: ['esposo', 'marido'], fr: ['mari', 'époux'], de: ['ehemann'], pt: ['marido'],
    ru: ['муж'], zh: ['丈夫', '老公'], ja: ['夫'], hi: ['पति'], ar: ['زوجي', 'زوج'], bn: ['স্বামী'], id: ['suami'], tr: ['kocam'],
    ko: ['남편'], vi: ['chồng'], pl: ['mąż'], nl: ['man'], uk: ['чоловік'] },
  partner: { en: ['partner', 'boyfriend', 'girlfriend'], it: ['compagno', 'compagna', 'fidanzato', 'fidanzata'], es: ['novio', 'novia', 'pareja'],
    fr: ['copain', 'copine', 'compagnon', 'compagne'], de: ['freund', 'freundin', 'partner', 'partnerin'], pt: ['namorado', 'namorada'],
    ru: ['парень', 'девушка'], zh: ['男朋友', '女朋友'], ja: ['彼氏', '彼女'], hi: ['प्रेमी', 'प्रेमिका'], ar: ['حبيبي', 'حبيبتي'],
    id: ['pacar'], tr: ['sevgilim'], ko: ['남자친구', '여자친구'], vi: ['người yêu'], pl: ['chłopak', 'dziewczyna'], nl: ['vriend', 'vriendin'] },
  son: { en: ['son'], it: ['figlio'], es: ['hijo'], fr: ['fils'], de: ['sohn'], pt: ['filho'], ru: ['сын'], zh: ['儿子'], ja: ['息子'],
    hi: ['बेटा'], ar: ['ابني', 'ابن'], bn: ['ছেলে'], id: ['putra', 'anak laki-laki'], tr: ['oğlum'], ko: ['아들'], vi: ['con trai'], pl: ['syn'], nl: ['zoon'], uk: ['син'] },
  daughter: { en: ['daughter'], it: ['figlia'], es: ['hija'], fr: ['fille'], de: ['tochter'], pt: ['filha'], ru: ['дочь'], zh: ['女儿'], ja: ['娘'],
    hi: ['बेटी'], ar: ['ابنتي', 'ابنة'], bn: ['মেয়ে'], id: ['putri', 'anak perempuan'], tr: ['kızım'], ko: ['딸'], vi: ['con gái'], pl: ['córka'], nl: ['dochter'], uk: ['донька'] },
  grandparent: { en: ['grandfather', 'grandmother', 'grandpa', 'grandma'], it: ['nonno', 'nonna'], es: ['abuelo', 'abuela'], fr: ['grand-père', 'grand-mère', 'papi', 'mamie'],
    de: ['opa', 'oma', 'großvater', 'großmutter'], pt: ['avô', 'avó'], ru: ['дедушка', 'бабушка'], zh: ['爷爷', '奶奶', '外公', '外婆'], ja: ['祖父', '祖母', 'おじいさん', 'おばあさん'],
    hi: ['दादा', 'दादी', 'नाना', 'नानी'], ar: ['جدي', 'جدتي'], id: ['kakek', 'nenek'], tr: ['dede', 'babaanne', 'anneanne'], ko: ['할아버지', '할머니'], vi: ['ông', 'bà'] },
  uncleAunt: { en: ['uncle', 'aunt'], it: ['zio', 'zia'], es: ['tío', 'tía'], fr: ['oncle', 'tante'], de: ['onkel', 'tante'], pt: ['tio', 'tia'], ru: ['дядя', 'тётя'],
    zh: ['叔叔', '阿姨', '舅舅', '姑姑'], ja: ['叔父', '叔母', 'おじさん', 'おばさん'], hi: ['चाचा', 'चाची', 'मामा', 'मौसी'], ar: ['عمي', 'خالي', 'عمتي', 'خالتي'],
    id: ['paman', 'bibi'], tr: ['amca', 'dayı', 'teyze', 'hala'], ko: ['삼촌', '이모', '고모'] },
  cousin: { en: ['cousin'], it: ['cugino', 'cugina'], es: ['primo', 'prima'], fr: ['cousin', 'cousine'], de: ['cousin', 'cousine'], pt: ['primo', 'prima'],
    ru: ['двоюродный брат', 'двоюродная сестра'], zh: ['表哥', '表姐', '堂哥', '堂姐'], ja: ['いとこ'], id: ['sepupu'], tr: ['kuzen'], ko: ['사촌'] },
  nephewNiece: { en: ['nephew', 'niece', 'grandson', 'granddaughter'], it: ['nipote'], es: ['sobrino', 'sobrina', 'nieto', 'nieta'], fr: ['neveu', 'nièce', 'petit-fils', 'petite-fille'],
    de: ['neffe', 'nichte', 'enkel', 'enkelin'], pt: ['sobrinho', 'sobrinha', 'neto', 'neta'], ru: ['племянник', 'племянница', 'внук', 'внучка'], zh: ['侄子', '外甥', '孙子', '孙女'], ja: ['甥', '姪', '孫'] },
  inLaw: { en: ['father-in-law', 'mother-in-law', 'brother-in-law', 'sister-in-law'], it: ['suocero', 'suocera', 'cognato', 'cognata'], es: ['suegro', 'suegra', 'cuñado', 'cuñada'],
    fr: ['beau-père', 'belle-mère', 'beau-frère', 'belle-sœur'], de: ['schwiegervater', 'schwiegermutter', 'schwager', 'schwägerin'], pt: ['sogro', 'sogra', 'cunhado', 'cunhada'] },
  colleague: { en: ['colleague', 'coworker'], it: ['collega', 'colleghi'], es: ['compañero de trabajo', 'colega'], fr: ['collègue'], de: ['kollege', 'kollegin'], pt: ['colega'],
    ru: ['коллега'], zh: ['同事'], ja: ['同僚'], hi: ['सहकर्मी'], ar: ['زميلي', 'زميلتي'], id: ['rekan kerja'], tr: ['iş arkadaşım'], ko: ['동료'], pl: ['kolega', 'koleżanka'], nl: ['collega'] },
  boss: { en: ['boss'], it: ['capo'], es: ['jefe', 'jefa'], fr: ['patron', 'patronne', 'cheffe'], de: ['chef', 'chefin'], pt: ['chefe'], ru: ['начальник', 'начальница'],
    zh: ['老板', '上司'], ja: ['上司'], hi: ['बॉस'], ar: ['مديري'], id: ['atasan', 'bos'], tr: ['patronum'], ko: ['상사'], pl: ['szef'], nl: ['baas'] },
  friend: { en: ['friend'], it: ['amico', 'amica'], es: ['amigo', 'amiga'], fr: ['ami', 'amie'], de: ['freund', 'freundin'], pt: ['amigo', 'amiga'], ru: ['друг', 'подруга'],
    zh: ['朋友'], ja: ['友達', '友人'], hi: ['दोस्त'], ar: ['صديقي', 'صديقتي'], bn: ['বন্ধু'], id: ['teman'], tr: ['arkadaşım'], ko: ['친구'], vi: ['bạn'], pl: ['przyjaciel', 'przyjaciółka'], nl: ['vriend', 'vriendin'] },
};
