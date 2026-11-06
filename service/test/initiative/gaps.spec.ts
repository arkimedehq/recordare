// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/** A card whose name already says who they are through someone known is no gap (D55 F2b run 1), in any language. */
import { relationInName } from '../../src/initiative/initiative.service';

describe('relationInName', () => {
  const people = [{ id: '1', display_name: 'Luca' }, { id: '2', display_name: 'Marta' }, { id: '3', display_name: '健二' }];
  const card = (display_name: string) => ({ id: 'x', display_name });

  it('a relation word and another person\'s name: the name says who they are', () => {
    expect(relationInName(card('la mamma di Luca'), people)).toBe(true);
    expect(relationInName(card('nonna di Marta'), people)).toBe(true);
    expect(relationInName(card("Marta's grandmother"), people)).toBe(true);
    expect(relationInName(card('健二のお母さん'), people)).toBe(true);
  });

  it('a plain name, a relation word alone, or a relation with an unknown name: still a gap', () => {
    expect(relationInName(card('Elena'), people)).toBe(false);
    expect(relationInName(card('Zio Franco'), people)).toBe(false);
    expect(relationInName(card('Lucas'), people)).toBe(false);
  });
});
