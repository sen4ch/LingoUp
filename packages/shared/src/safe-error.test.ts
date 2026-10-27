import { describe, expect, it } from 'vitest';
import { toSafeError } from './safe-error.js';

describe('toSafeError', () => {
  it('removes bound query values from message, stack and cause', () => {
    const cause = Object.assign(new Error('duplicate key value'), {
      code: '23505',
      constraint: 'users_email_key',
    });
    const error = new Error(
      'Failed query: insert into "identity"."users" ("email", "password_hash") values ($1, $2)\nparams: alice@example.test,$argon2id$v=19$secret',
      { cause },
    );
    const safe = toSafeError(error);
    const serialized = JSON.stringify(safe);
    expect(serialized).not.toContain('alice@example.test');
    expect(serialized).not.toContain('argon2id');
    expect(safe.message).toContain('insert into "identity"."users"');
    expect(safe.cause).toMatchObject({ code: '23505', constraint: 'users_email_key' });
  });

  it('handles non-error values', () => {
    expect(toSafeError('boom')).toEqual({ type: 'string', message: 'Non-error value thrown' });
  });
});
