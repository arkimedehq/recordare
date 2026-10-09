// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { isFullName, isProperName, selfLeak } from '../../src/lang';

describe('selfLeak: first-person memories that still speak of the self in the third person (WORK_PLAN 8.4)', () => {
  it.each([
    ['Sono stato al mare con mia sorella Giulia.', null],
    ['Mia sorella Giulia ha vinto la gara.', null],
    ['Andrea è stato al mare con Giulia.', 'name'],
    ['Il 2 ottobre ANDREA ha portato la Panda dal meccanico.', 'name'],
    ["L'utente ha prenotato un tavolo da Aldina.", 'stand_in'],
    ["Il 3 ottobre l'owner ha comprato un ombrello.", 'stand_in'],
    ["L'assistente ha prenotato il dentista.", 'stand_in'],
    ['The user booked a table.', 'stand_in'],
    ['El usuario compró una bicicleta.', 'stand_in'],
    ["L'utilisateur est allé au cinéma.", 'stand_in'],
    ['Der Nutzer war beim Arzt.', 'stand_in'],
    ['用户去了北京。', 'stand_in'],
    ['Пользователь купил машину.', 'stand_in'],
    // Not a leak: someone else's owner is not caught by a bare word, and a name inside another word is not the name.
    ['Ho parlato con Andreas, il vicino.', null],
    ['I booked the table myself.', null],
  ])('%s', (text, expected) => {
    expect(selfLeak(text, ['Andrea'])).toBe(expected);
  });
});

describe('names: contacts are created for names; full names are capitalised words (WORK_PLAN 8.4)', () => {
  it.each([
    ['Giulia', true, false], ['Marco Bellini', true, true], ['zia Carmela', true, false], ['dottor Ferri', true, false],
    ['amiche del nuoto', false, false], ['mamma', false, false], ['Ludwig van Beethoven', true, true], ['王小明', true, false],
    ['Анна Петрова', true, true],
  ])('%s', (name, proper, full) => {
    expect([isProperName(name), isFullName(name)]).toEqual([proper, full]);
  });
});
