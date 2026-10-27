import { describe, expect, it } from 'vitest';
import { clientRateLimitKey } from './client-key.js';

describe('clientRateLimitKey', () => {
  it('keeps IPv4 addresses', () => {
    expect(clientRateLimitKey('203.0.113.7')).toBe('203.0.113.7');
  });

  it('reduces IPv4-mapped IPv6 to IPv4', () => {
    expect(clientRateLimitKey('::ffff:203.0.113.7')).toBe('203.0.113.7');
  });

  it('groups IPv6 addresses by /64', () => {
    const a = clientRateLimitKey('2001:db8:85a3:12::1');
    const b = clientRateLimitKey('2001:DB8:85a3:12:ffff:ffff:ffff:fffe');
    expect(a).toBe('2001:db8:85a3:12::/64');
    expect(b).toBe(a);
    expect(clientRateLimitKey('2001:db8:85a3:13::1')).not.toBe(a);
  });

  it('handles compressed and loopback forms', () => {
    expect(clientRateLimitKey('::1')).toBe('0:0:0:0::/64');
    expect(clientRateLimitKey('fe80::1%eth0')).toBe('fe80:0:0:0::/64');
  });
});
