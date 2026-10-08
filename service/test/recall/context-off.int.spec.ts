// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

// Its own file: the service's configuration is read once per test file, and this case needs the switch unset.
import { setup } from './context.setup';

describe('pre-turn memory context, default', () => {
  it('is off by default: nothing served, nothing logged', async () => {
    const s = await setup({});
    try {
      expect((await s.context('chat-1')).body).toEqual({ block: null, items: 0 });
      expect(await s.db.query(`SELECT count(*)::int AS n FROM recall_log`)).toEqual([{ n: 0 }]);
    } finally {
      await s.app.close();
      s.fake.server.close();
    }
  });
});
