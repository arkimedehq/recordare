// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

import { isPrivate, sign } from '../../src/initiative/webhooks.service';

describe('Standard Webhooks signing and the SSRF guard', () => {
  it('signs as the specification says: v1, base64 HMAC-SHA256 of id.timestamp.body with the base64 secret', () => {
    // The specification's own example values (standard-webhooks.md, "Signature scheme").
    const secret = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw';
    const s = sign(secret, 'msg_p5jXN8AQM9LWM0D4loKWxJek', 1614265330, '{"test": 2432232314}');
    expect(s).toBe('v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=');
  });

  it('knows the private ranges', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.1.134', '172.16.0.1', '172.31.255.255', '169.254.1.1', '100.64.0.1', '::1', 'fe80::1', 'fd00::1']) expect(isPrivate(ip)).toBe(true);
    for (const ip of ['8.8.8.8', '172.32.0.1', '151.101.1.69', '2606:4700::1111']) expect(isPrivate(ip)).toBe(false);
  });
});
