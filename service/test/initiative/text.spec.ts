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
      if (locale !== 'en') expect(t).not.toBe(initiativeText('en'));
    }
    expect(initiativeText('xx-YY')).toBe(initiativeText('en'));
    expect(initiativeText('it-IT').askPlan('Dentista.', 'lunedì 12 ottobre')).toBe('Per lunedì 12 ottobre era previsto: Dentista. È andata?');
  });
});
