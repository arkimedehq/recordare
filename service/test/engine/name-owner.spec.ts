// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { nameOwner } from '../../src/engine/extraction.writer';

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
  ])('%s', (input, expected) => {
    expect(nameOwner(input, 'Marta')).toBe(expected);
  });
});
