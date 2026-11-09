// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { addressOn } from '../../src/initiative/initiative.service';

describe('for.addressOn (F3: templates that cannot index a list)', () => {
  it('keeps the first (oldest) address on each channel', () => {
    expect(addressOn([
      { channel: 'telegram', id: '1001' }, { channel: 'homeassistant', id: 'person.chloe' }, { channel: 'telegram', id: '1002' },
    ])).toEqual({ telegram: '1001', homeassistant: 'person.chloe' });
    expect(addressOn([])).toEqual({});
  });
});
