// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { nameOwner } from '../../src/lang';

describe('nameOwner: the person\'s name instead of "the owner" (WORK_PLAN 4.11)', () => {
  it.each([
    ["L'owner ha comprato una bici", 'Marta ha comprato una bici'],
    ["la bici dell'owner", 'la bici di Marta'],
    ['The owner\'s dog is called Pongo', "Marta's dog is called Pongo"],
    ['Il proprietario è stato dal veterinario con il cane Pongo', 'Marta è stato dal veterinario con il cane Pongo'],
    ['il cane del proprietario', 'il cane di Marta'],
    ['Luca ha scritto al proprietario', 'Luca ha scritto a Marta'],
    // Someone else's owner stays as it is.
    ['Il proprietario del bar ha alzato i prezzi', 'Il proprietario del bar ha alzato i prezzi'],
    ["ha parlato con la proprietaria dell'appartamento", "ha parlato con la proprietaria dell'appartamento"],
    ['The owner of the bar raised prices', 'The owner of the bar raised prices'],
    // Other languages with articles, and the bare English word anywhere.
    ['El propietario compró una bicicleta', 'Marta compró una bicicleta'],
    ['la bicicleta del propietario', 'la bicicleta de Marta'],
    ['el dueño del bar', 'el dueño del bar'],
    ['Le propriétaire est allé chez le vétérinaire', 'Marta est allé chez le vétérinaire'],
    ["le chien du propriétaire", 'le chien de Marta'],
    ['O dono comprou um carro', 'Marta comprou um carro'],
    ['Der Besitzer war beim Tierarzt', 'Marta war beim Tierarzt'],
    ['Owner 去了兽医那里', 'Marta 去了兽医那里'],
  ])('%s', (input, expected) => {
    expect(nameOwner(input, 'Marta')).toBe(expected);
  });
});
