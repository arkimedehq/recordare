// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * What the agent says on its own initiative, in the memory's language (D53, WORK_PLAN 8.12c; maintainer's rule: all
 * languages). The economy profile has no model: these sentences are the initiatives themselves — a plan past its date
 * asked about, a plan coming up reminded of, a question the agent holds to look up. `plan` is the plan's text as the
 * memory holds it, `day` the date as Intl writes it in that locale; `opening` is said aloud before an initiative when others
 * are in the room. A locale not listed falls back to English.
 */
import { language } from './locales';

export interface InitiativeText {
  /** A plan past its date without an outcome: did it happen? */
  askPlan: (plan: string, day: string) => string;
  /** A plan coming up: a reminder. */
  remindPlan: (plan: string, day: string) => string;
  /** A question the agent holds and would like looked up (for the agent that hosts the memory, not for a person). */
  lookup: (question: string) => string;
  /**
   * Said aloud when others are in the room (D55 §5c): it reveals nothing of the initiative, only that there is one for
   * this person — who answers yes to hear it.
   */
  opening: (name: string) => string;
  /**
   * Someone the memory has heard named but does not know who they are (D55 F2b, a gap): asked of whoever named them most.
   */
  whoIs: (name: string) => string;
}

const TEXTS: Record<string, InitiativeText> = {
  en: {
    askPlan: (p, d) => `On ${d} this was planned: ${p} Did it happen?`,
    remindPlan: (p, d) => `A reminder for ${d}: ${p}`,
    lookup: (q) => `I would like to find out: ${q}`,
    opening: (n) => `${n}, I have something for you: do you want to hear it?`,
    whoIs: (n) => `Who is ${n}? I have heard the name but do not know who they are.`,
  },
  it: {
    askPlan: (p, d) => `Per ${d} era previsto: ${p} È andata?`,
    remindPlan: (p, d) => `Un promemoria per ${d}: ${p}`,
    lookup: (q) => `Vorrei scoprire: ${q}`,
    opening: (n) => `${n}, ho una cosa per te: vuoi sentirla?`,
    whoIs: (n) => `Chi è ${n}? Ho sentito il nome, ma non so chi sia.`,
  },
  es: {
    askPlan: (p, d) => `Para el ${d} estaba previsto: ${p} ¿Se hizo?`,
    remindPlan: (p, d) => `Un recordatorio para el ${d}: ${p}`,
    lookup: (q) => `Me gustaría averiguar: ${q}`,
    opening: (n) => `${n}, tengo algo para ti: ¿quieres oírlo?`,
    whoIs: (n) => `¿Quién es ${n}? He oído el nombre, pero no sé quién es.`,
  },
  fr: {
    askPlan: (p, d) => `Pour le ${d} c'était prévu : ${p} Cela a-t-il eu lieu ?`,
    remindPlan: (p, d) => `Un rappel pour le ${d} : ${p}`,
    lookup: (q) => `J'aimerais savoir : ${q}`,
    opening: (n) => `${n}, j'ai quelque chose pour toi : tu veux l'entendre ?`,
    whoIs: (n) => `Qui est ${n} ? J'ai entendu ce nom, mais je ne sais pas qui c'est.`,
  },
  de: {
    askPlan: (p, d) => `Für den ${d} war geplant: ${p} Hat es stattgefunden?`,
    remindPlan: (p, d) => `Eine Erinnerung für den ${d}: ${p}`,
    lookup: (q) => `Ich würde gern herausfinden: ${q}`,
    opening: (n) => `${n}, ich habe etwas für dich: Möchtest du es hören?`,
    whoIs: (n) => `Wer ist ${n}? Ich habe den Namen gehört, weiß aber nicht, wer das ist.`,
  },
  pt: {
    askPlan: (p, d) => `Para ${d} estava previsto: ${p} Aconteceu?`,
    remindPlan: (p, d) => `Um lembrete para ${d}: ${p}`,
    lookup: (q) => `Gostaria de descobrir: ${q}`,
    opening: (n) => `${n}, tenho uma coisa para você: quer ouvir?`,
    whoIs: (n) => `Quem é ${n}? Ouvi o nome, mas não sei quem é.`,
  },
  zh: {
    askPlan: (p, d) => `${d}原本有计划：${p}后来实现了吗？`,
    remindPlan: (p, d) => `${d}的提醒：${p}`,
    lookup: (q) => `我想弄清楚：${q}`,
    opening: (n) => `${n}，我有件事要告诉你：你想听吗？`,
    whoIs: (n) => `${n}是谁？我听到过这个名字，但不知道是谁。`,
  },
  hi: {
    askPlan: (p, d) => `${d} के लिए योजना थी: ${p} क्या ऐसा हुआ?`,
    remindPlan: (p, d) => `${d} के लिए एक याद दिलाना: ${p}`,
    lookup: (q) => `मुझे यह जानना है: ${q}`,
    opening: (n) => `${n}, आपके लिए कुछ है: क्या आप सुनना चाहेंगे?`,
    whoIs: (n) => `${n} कौन है? मैंने यह नाम सुना है, पर मुझे नहीं पता कि वह कौन है।`,
  },
  ar: {
    askPlan: (p, d) => `كان مخططًا في ${d}: ${p} هل حدث ذلك؟`,
    remindPlan: (p, d) => `تذكير بموعد ${d}: ${p}`,
    lookup: (q) => `أودّ أن أعرف: ${q}`,
    opening: (n) => `${n}، لديّ شيء لك: هل تريد أن تسمعه؟`,
    whoIs: (n) => `من هو ${n}؟ سمعت الاسم لكني لا أعرف من هو.`,
  },
  bn: {
    askPlan: (p, d) => `${d}-এর জন্য পরিকল্পনা ছিল: ${p} সেটা কি হয়েছিল?`,
    remindPlan: (p, d) => `${d}-এর জন্য একটি অনুস্মারক: ${p}`,
    lookup: (q) => `আমি জানতে চাই: ${q}`,
    opening: (n) => `${n}, তোমার জন্য একটা কথা আছে: শুনতে চাও?`,
    whoIs: (n) => `${n} কে? নামটা শুনেছি, কিন্তু জানি না সে কে।`,
  },
  ru: {
    askPlan: (p, d) => `На ${d} было запланировано: ${p} Это состоялось?`,
    remindPlan: (p, d) => `Напоминание на ${d}: ${p}`,
    lookup: (q) => `Мне хотелось бы выяснить: ${q}`,
    opening: (n) => `${n}, у меня есть кое-что для тебя: хочешь послушать?`,
    whoIs: (n) => `Кто такой ${n}? Я слышал это имя, но не знаю, кто это.`,
  },
  ur: {
    askPlan: (p, d) => `${d} کے لیے منصوبہ تھا: ${p} کیا ایسا ہوا؟`,
    remindPlan: (p, d) => `${d} کے لیے ایک یاد دہانی: ${p}`,
    lookup: (q) => `مجھے یہ معلوم کرنا ہے: ${q}`,
    opening: (n) => `${n}، آپ کے لیے ایک بات ہے: کیا آپ سننا چاہیں گے؟`,
    whoIs: (n) => `${n} کون ہے؟ میں نے یہ نام سنا ہے، مگر نہیں جانتا کہ وہ کون ہے۔`,
  },
  id: {
    askPlan: (p, d) => `Untuk ${d} sudah direncanakan: ${p} Apakah itu terlaksana?`,
    remindPlan: (p, d) => `Pengingat untuk ${d}: ${p}`,
    lookup: (q) => `Saya ingin mencari tahu: ${q}`,
    opening: (n) => `${n}, ada sesuatu untukmu: mau dengar?`,
    whoIs: (n) => `Siapa ${n}? Saya pernah mendengar namanya, tapi tidak tahu siapa dia.`,
  },
  ja: {
    askPlan: (p, d) => `${d}の予定でした：${p}予定どおりになりましたか？`,
    remindPlan: (p, d) => `${d}のリマインダー：${p}`,
    lookup: (q) => `確かめたいことがあります：${q}`,
    opening: (n) => `${n}さん、お伝えしたいことがあります。聞きますか？`,
    whoIs: (n) => `${n}さんはどなたですか？お名前は聞きましたが、どなたか分かりません。`,
  },
  tr: {
    askPlan: (p, d) => `${d} için planlanmıştı: ${p} Oldu mu?`,
    remindPlan: (p, d) => `${d} için bir hatırlatma: ${p}`,
    lookup: (q) => `Öğrenmek isterim: ${q}`,
    opening: (n) => `${n}, senin için bir şey var: dinlemek ister misin?`,
    whoIs: (n) => `${n} kim? Adını duydum ama kim olduğunu bilmiyorum.`,
  },
  ko: {
    askPlan: (p, d) => `${d}에 예정되어 있었습니다: ${p} 잘 진행되었나요?`,
    remindPlan: (p, d) => `${d} 알림: ${p}`,
    lookup: (q) => `알아보고 싶은 것이 있습니다: ${q}`,
    opening: (n) => `${n}님, 전해 드릴 말이 있어요. 들으시겠어요?`,
    whoIs: (n) => `${n}님은 누구인가요? 이름은 들었지만 누구인지 모르겠어요.`,
  },
  vi: {
    askPlan: (p, d) => `Vào ${d} đã có kế hoạch: ${p} Việc đó đã diễn ra chưa?`,
    remindPlan: (p, d) => `Nhắc nhở cho ${d}: ${p}`,
    lookup: (q) => `Tôi muốn tìm hiểu: ${q}`,
    opening: (n) => `${n}, có điều này dành cho bạn: bạn có muốn nghe không?`,
    whoIs: (n) => `${n} là ai? Tôi đã nghe tên này nhưng không biết là ai.`,
  },
  fa: {
    askPlan: (p, d) => `برای ${d} برنامه‌ریزی شده بود: ${p} انجام شد؟`,
    remindPlan: (p, d) => `یادآوری برای ${d}: ${p}`,
    lookup: (q) => `دوست دارم بدانم: ${q}`,
    opening: (n) => `${n}، چیزی برایت دارم: می‌خواهی بشنوی؟`,
    whoIs: (n) => `${n} کیست؟ اسمش را شنیده‌ام اما نمی‌دانم کیست.`,
  },
  pl: {
    askPlan: (p, d) => `Na ${d} zaplanowano: ${p} Czy do tego doszło?`,
    remindPlan: (p, d) => `Przypomnienie na ${d}: ${p}`,
    lookup: (q) => `Chcę się dowiedzieć: ${q}`,
    opening: (n) => `${n}, mam coś dla ciebie: chcesz posłuchać?`,
    whoIs: (n) => `Kim jest ${n}? Słyszałem to imię, ale nie wiem, kto to jest.`,
  },
  nl: {
    askPlan: (p, d) => `Voor ${d} stond gepland: ${p} Is het doorgegaan?`,
    remindPlan: (p, d) => `Een herinnering voor ${d}: ${p}`,
    lookup: (q) => `Ik zou graag willen weten: ${q}`,
    opening: (n) => `${n}, ik heb iets voor je: wil je het horen?`,
    whoIs: (n) => `Wie is ${n}? Ik heb de naam gehoord, maar weet niet wie het is.`,
  },
  th: {
    askPlan: (p, d) => `มีแผนไว้สำหรับ ${d}: ${p} เกิดขึ้นหรือไม่`,
    remindPlan: (p, d) => `เตือนความจำสำหรับ ${d}: ${p}`,
    lookup: (q) => `อยากทราบว่า: ${q}`,
    opening: (n) => `${n} มีเรื่องจะบอก อยากฟังไหม`,
    whoIs: (n) => `${n} คือใคร ได้ยินชื่อนี้แต่ไม่รู้ว่าเป็นใคร`,
  },
  sw: {
    askPlan: (p, d) => `Kwa ${d} ilipangwa: ${p} Je, ilifanyika?`,
    remindPlan: (p, d) => `Ukumbusho wa ${d}: ${p}`,
    lookup: (q) => `Ningependa kujua: ${q}`,
    opening: (n) => `${n}, nina jambo lako: ungependa kulisikia?`,
    whoIs: (n) => `${n} ni nani? Nimesikia jina hilo lakini sijui ni nani.`,
  },
  uk: {
    askPlan: (p, d) => `На ${d} було заплановано: ${p} Це відбулося?`,
    remindPlan: (p, d) => `Нагадування на ${d}: ${p}`,
    lookup: (q) => `Мені хотілося б з'ясувати: ${q}`,
    opening: (n) => `${n}, у мене є дещо для тебе: хочеш послухати?`,
    whoIs: (n) => `Хто такий ${n}? Я чув це ім'я, але не знаю, хто це.`,
  },
  ro: {
    askPlan: (p, d) => `Pentru ${d} era planificat: ${p} S-a întâmplat?`,
    remindPlan: (p, d) => `Un memento pentru ${d}: ${p}`,
    lookup: (q) => `Aș vrea să aflu: ${q}`,
    opening: (n) => `${n}, am ceva pentru tine: vrei să auzi?`,
    whoIs: (n) => `Cine este ${n}? Am auzit numele, dar nu știu cine este.`,
  },
  el: {
    askPlan: (p, d) => `Για τις ${d} είχε προγραμματιστεί: ${p} Έγινε;`,
    remindPlan: (p, d) => `Υπενθύμιση για τις ${d}: ${p}`,
    lookup: (q) => `Θα ήθελα να μάθω: ${q}`,
    opening: (n) => `${n}, έχω κάτι για σένα: θέλεις να το ακούσεις;`,
    whoIs: (n) => `Ποιος είναι ο/η ${n}; Έχω ακούσει το όνομα, αλλά δεν ξέρω ποιος είναι.`,
  },
};

/** The sentences in the memory's language, English for a language not listed. */
export function initiativeText(locale: string): InitiativeText {
  return TEXTS[language(locale)] ?? TEXTS.en!;
}
