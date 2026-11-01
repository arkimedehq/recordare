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
};

/** The sentences in the memory's language, English for a language not listed. */
export function initiativeText(locale: string): InitiativeText {
  return TEXTS[language(locale)] ?? TEXTS.en!;
}
