import { createHash, randomBytes } from 'node:crypto';

export const SESSION_COOKIE = 'lingoup_session';

/** 256-bit opaque token for the cookie. */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Only this hash is stored; a database leak does not reveal usable tokens. */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Rejects obviously malformed cookies before touching the database. */
export function isWellFormedToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}
