import { describe, expect, it } from 'vitest';
import { PasswordHasher } from './password-hasher.js';

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher();

  it('produces Argon2id hashes that verify only the original password', async () => {
    const hashed = await hasher.hash('correct horse battery staple');
    expect(hashed.startsWith('$argon2id$')).toBe(true);
    await expect(hasher.verify(hashed, 'correct horse battery staple')).resolves.toBe(true);
    await expect(hasher.verify(hashed, 'wrong password')).resolves.toBe(false);
  });

  it('dummy verification always fails', async () => {
    await expect(hasher.verifyAgainstDummy('anything')).resolves.toBe(false);
  });
});
