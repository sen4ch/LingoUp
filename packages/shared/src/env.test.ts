import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EnvValidationError, loadEnv } from './env.js';

const schema = z.object({
  PORT: z.coerce.number().int().positive(),
  SECRET: z.string().min(8),
});

describe('loadEnv', () => {
  it('parses and coerces valid values', () => {
    expect(loadEnv(schema, { PORT: '4000', SECRET: 'long-enough' })).toEqual({
      PORT: 4000,
      SECRET: 'long-enough',
    });
  });

  it('reports variable names without leaking secret values', () => {
    try {
      loadEnv(schema, { PORT: 'abc', SECRET: 'short' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      const message = (error as Error).message;
      expect(message).toContain('PORT');
      expect(message).toContain('SECRET');
      expect(message).not.toContain('short');
    }
  });
});
