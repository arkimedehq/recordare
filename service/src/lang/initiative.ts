// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * What the agent says on its own initiative, in the memory's language (D53, WORK_PLAN 8.12c; maintainer's rule: all
 * languages). The economy profile has no model: these sentences are the initiatives themselves — a plan past its date
 * asked about, a plan coming up reminded of, a question the agent holds to look up. `plan` is the plan's text as the
 * memory holds it, `day` the date as Intl writes it in that locale. A locale not listed falls back to English.
 */
import { language } from './locales';

export interface InitiativeText {
  /** A plan past its date without an outcome: did it happen? */
  askPlan: (plan: string, day: string) => string;
  /** A plan coming up: a reminder. */
  remindPlan: (plan: string, day: string) => string;
  /** A question the agent holds and would like looked up (for the agent that hosts the memory, not for a person). */
  lookup: (question: string) => string;
}

const TEXTS: Record<string, InitiativeText> = {
  en: {
    askPlan: (p, d) => `On ${d} this was planned: ${p} Did it happen?`,
    remindPlan: (p, d) => `A reminder for ${d}: ${p}`,
    lookup: (q) => `I would like to find out: ${q}`,
  },
  it: {
    askPlan: (p, d) => `Per ${d} era previsto: ${p} È andata?`,
    remindPlan: (p, d) => `Un promemoria per ${d}: ${p}`,
    lookup: (q) => `Vorrei scoprire: ${q}`,
  },
  es: {
    askPlan: (p, d) => `Para el ${d} estaba previsto: ${p} ¿Se hizo?`,
    remindPlan: (p, d) => `Un recordatorio para el ${d}: ${p}`,
    lookup: (q) => `Me gustaría averiguar: ${q}`,
  },
  fr: {
    askPlan: (p, d) => `Pour le ${d} c'était prévu : ${p} Cela a-t-il eu lieu ?`,
    remindPlan: (p, d) => `Un rappel pour le ${d} : ${p}`,
    lookup: (q) => `J'aimerais savoir : ${q}`,
  },
  de: {
    askPlan: (p, d) => `Für den ${d} war geplant: ${p} Hat es stattgefunden?`,
    remindPlan: (p, d) => `Eine Erinnerung für den ${d}: ${p}`,
    lookup: (q) => `Ich würde gern herausfinden: ${q}`,
  },
  pt: {
    askPlan: (p, d) => `Para ${d} estava previsto: ${p} Aconteceu?`,
    remindPlan: (p, d) => `Um lembrete para ${d}: ${p}`,
    lookup: (q) => `Gostaria de descobrir: ${q}`,
  },
  zh: {
    askPlan: (p, d) => `${d}原本有计划：${p}后来实现了吗？`,
    remindPlan: (p, d) => `${d}的提醒：${p}`,
    lookup: (q) => `我想弄清楚：${q}`,
  },
  hi: {
    askPlan: (p, d) => `${d} के लिए योजना थी: ${p} क्या ऐसा हुआ?`,
    remindPlan: (p, d) => `${d} के लिए एक याद दिलाना: ${p}`,
    lookup: (q) => `मुझे यह जानना है: ${q}`,
  },
  ar: {
    askPlan: (p, d) => `كان مخططًا في ${d}: ${p} هل حدث ذلك؟`,
    remindPlan: (p, d) => `تذكير بموعد ${d}: ${p}`,
    lookup: (q) => `أودّ أن أعرف: ${q}`,
  },
  bn: {
    askPlan: (p, d) => `${d}-এর জন্য পরিকল্পনা ছিল: ${p} সেটা কি হয়েছিল?`,
    remindPlan: (p, d) => `${d}-এর জন্য একটি অনুস্মারক: ${p}`,
    lookup: (q) => `আমি জানতে চাই: ${q}`,
  },
  ru: {
    askPlan: (p, d) => `На ${d} было запланировано: ${p} Это состоялось?`,
    remindPlan: (p, d) => `Напоминание на ${d}: ${p}`,
    lookup: (q) => `Мне хотелось бы выяснить: ${q}`,
  },
  ur: {
    askPlan: (p, d) => `${d} کے لیے منصوبہ تھا: ${p} کیا ایسا ہوا؟`,
    remindPlan: (p, d) => `${d} کے لیے ایک یاد دہانی: ${p}`,
    lookup: (q) => `مجھے یہ معلوم کرنا ہے: ${q}`,
  },
  id: {
    askPlan: (p, d) => `Untuk ${d} sudah direncanakan: ${p} Apakah itu terlaksana?`,
    remindPlan: (p, d) => `Pengingat untuk ${d}: ${p}`,
    lookup: (q) => `Saya ingin mencari tahu: ${q}`,
  },
  ja: {
    askPlan: (p, d) => `${d}の予定でした：${p}予定どおりになりましたか？`,
    remindPlan: (p, d) => `${d}のリマインダー：${p}`,
    lookup: (q) => `確かめたいことがあります：${q}`,
  },
  tr: {
    askPlan: (p, d) => `${d} için planlanmıştı: ${p} Oldu mu?`,
    remindPlan: (p, d) => `${d} için bir hatırlatma: ${p}`,
    lookup: (q) => `Öğrenmek isterim: ${q}`,
  },
  ko: {
    askPlan: (p, d) => `${d}에 예정되어 있었습니다: ${p} 잘 진행되었나요?`,
    remindPlan: (p, d) => `${d} 알림: ${p}`,
    lookup: (q) => `알아보고 싶은 것이 있습니다: ${q}`,
  },
  vi: {
    askPlan: (p, d) => `Vào ${d} đã có kế hoạch: ${p} Việc đó đã diễn ra chưa?`,
    remindPlan: (p, d) => `Nhắc nhở cho ${d}: ${p}`,
    lookup: (q) => `Tôi muốn tìm hiểu: ${q}`,
  },
  fa: {
    askPlan: (p, d) => `برای ${d} برنامه‌ریزی شده بود: ${p} انجام شد؟`,
    remindPlan: (p, d) => `یادآوری برای ${d}: ${p}`,
    lookup: (q) => `دوست دارم بدانم: ${q}`,
  },
  pl: {
    askPlan: (p, d) => `Na ${d} zaplanowano: ${p} Czy do tego doszło?`,
    remindPlan: (p, d) => `Przypomnienie na ${d}: ${p}`,
    lookup: (q) => `Chcę się dowiedzieć: ${q}`,
  },
  nl: {
    askPlan: (p, d) => `Voor ${d} stond gepland: ${p} Is het doorgegaan?`,
    remindPlan: (p, d) => `Een herinnering voor ${d}: ${p}`,
    lookup: (q) => `Ik zou graag willen weten: ${q}`,
  },
  th: {
    askPlan: (p, d) => `มีแผนไว้สำหรับ ${d}: ${p} เกิดขึ้นหรือไม่`,
    remindPlan: (p, d) => `เตือนความจำสำหรับ ${d}: ${p}`,
    lookup: (q) => `อยากทราบว่า: ${q}`,
  },
  sw: {
    askPlan: (p, d) => `Kwa ${d} ilipangwa: ${p} Je, ilifanyika?`,
    remindPlan: (p, d) => `Ukumbusho wa ${d}: ${p}`,
    lookup: (q) => `Ningependa kujua: ${q}`,
  },
  uk: {
    askPlan: (p, d) => `На ${d} було заплановано: ${p} Це відбулося?`,
    remindPlan: (p, d) => `Нагадування на ${d}: ${p}`,
    lookup: (q) => `Мені хотілося б з'ясувати: ${q}`,
  },
  ro: {
    askPlan: (p, d) => `Pentru ${d} era planificat: ${p} S-a întâmplat?`,
    remindPlan: (p, d) => `Un memento pentru ${d}: ${p}`,
    lookup: (q) => `Aș vrea să aflu: ${q}`,
  },
  el: {
    askPlan: (p, d) => `Για τις ${d} είχε προγραμματιστεί: ${p} Έγινε;`,
    remindPlan: (p, d) => `Υπενθύμιση για τις ${d}: ${p}`,
    lookup: (q) => `Θα ήθελα να μάθω: ${q}`,
  },
};

/** The sentences in the memory's language, English for a language not listed. */
export function initiativeText(locale: string): InitiativeText {
  return TEXTS[language(locale)] ?? TEXTS.en!;
}
