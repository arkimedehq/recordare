// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { initiativeText } from '../../src/lang/initiative';
import { LOCALES } from '../../src/lang/locales';

describe('the initiatives\' sentences (all languages)', () => {
  it('has every locale, each with the plan, the day and the question in place', () => {
    for (const locale of LOCALES) {
      const t = initiativeText(locale);
      expect(t.askPlan('PLAN.', 'DAY')).toMatch(/PLAN\..*|.*PLAN\./);
      expect(t.askPlan('PLAN.', 'DAY')).toContain('DAY');
      expect(t.remindPlan('PLAN.', 'DAY')).toContain('PLAN.');
      expect(t.remindPlan('PLAN.', 'DAY')).toContain('DAY');
      expect(t.lookup('Q?')).toContain('Q?');
      // The opening said with others in the room (D55 §5c): the name, a question, nothing of the initiative.
      expect(t.opening('NAME')).toMatch(/^NAME/);
      expect(t.opening('NAME')).toMatch(/[?？;؟;]|ไหม$/);
      if (locale !== 'en') expect(t.opening('NAME')).not.toBe(initiativeText('en').opening('NAME'));
      // Who someone heard named is (D55 F2b, a gap): the name and a question, in that language.
      expect(t.whoIs('NAME')).toContain('NAME');
      expect(t.whoIs('NAME')).toMatch(/[?？;؟]|ใคร/);
      if (locale !== 'en') expect(t.whoIs('NAME')).not.toBe(initiativeText('en').whoIs('NAME'));
      // A confirmation (D55 F2b): the belief as held, then a question.
      expect(t.confirm('BELIEF.')).toContain('BELIEF.');
      expect(t.confirm('BELIEF.')).toMatch(/[?？;؟]$/);
      if (locale !== 'en') expect(t.confirm('BELIEF.')).not.toBe(initiativeText('en').confirm('BELIEF.'));
      // 8.16 F3: what I read, with its source and day; a question where it asks.
      expect(t.readSay('WHAT.', 'SITE', 'DAY')).toContain('WHAT.');
      expect(t.readSay('WHAT.', 'SITE', 'DAY')).toContain('SITE');
      expect(t.readSay('WHAT.', 'SITE', 'DAY')).toContain('DAY');
      for (const asked of [t.readAsk('WHAT.', 'SITE', 'DAY'), t.checkRead('WHAT.', 'SITE'), t.contradiction('HAD.', 'WHAT.', 'SITE')]) {
        expect(asked).toContain('WHAT.');
        expect(asked).toContain('SITE');
        expect(asked).toMatch(/[?？;؟]$/);
      }
      expect(t.contradiction('HAD.', 'WHAT.', 'SITE')).toContain('HAD.');
      expect(t.failedStep('TASK', 3, 'STEP')).toContain('TASK');
      expect(t.failedStep('TASK', 3, 'STEP')).toContain('3');
      expect(t.failedStep('TASK', 3, 'STEP')).toContain('STEP');
      expect(t.failedStep('TASK', 3, 'STEP')).toMatch(/[?？;؟]$/);
      expect(t.ownTool.length).toBeGreaterThan(2);
      if (locale !== 'en') {
        expect(t.readAsk('W', 'S', 'D')).not.toBe(initiativeText('en').readAsk('W', 'S', 'D'));
        expect(t.ownTool).not.toBe(initiativeText('en').ownTool);
      }
      if (locale !== 'en') expect(t).not.toBe(initiativeText('en'));
    }
    expect(initiativeText('xx-YY')).toBe(initiativeText('en'));
    expect(initiativeText('it-IT').askPlan('Dentista.', 'lunedì 12 ottobre')).toBe('Per lunedì 12 ottobre era previsto: Dentista. È andata?');
  });
});
