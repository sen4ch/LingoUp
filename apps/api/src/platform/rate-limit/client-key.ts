import { isIPv6 } from 'node:net';

/** Expands an IPv6 address to 8 hextets (no zone id, no embedded IPv4). */
function expandIPv6(address: string): string[] {
  const [head = '', tail] = address.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const missing = tail === undefined ? 0 : 8 - left.length - right.length;
  return [...left, ...Array<string>(missing).fill('0'), ...right].map((part) => part.toLowerCase());
}

/**
 * Rate-limit identity of a client address. A single IPv6 subscriber usually controls a
 * whole /64, so limiting per full IPv6 address is trivially bypassed; the /64 prefix is used
 * instead. IPv4-mapped IPv6 addresses are reduced to their IPv4 form.
 */
export function clientRateLimitKey(ip: string): string {
  const address = ip.split('%')[0] ?? ip;
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(address);
  if (mapped) return mapped[1]!;
  if (!isIPv6(address) || address.includes('.')) return address;
  return `${expandIPv6(address).slice(0, 4).join(':')}::/64`;
}
