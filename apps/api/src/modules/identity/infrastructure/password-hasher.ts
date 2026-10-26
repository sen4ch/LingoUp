import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

// OWASP Password Storage Cheat Sheet: Argon2id, m=19 MiB, t=2, p=1.
// The library's default algorithm is Argon2id (its enum is a const enum, so it is not
// referenced directly under isolatedModules).
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

@Injectable()
export class PasswordHasher {
  /** Pre-computed hash used to keep login timing equal for unknown emails. */
  private readonly dummyHash = hash('timing-equalizer-not-a-real-password', OPTIONS);

  hash(password: string): Promise<string> {
    return hash(password, OPTIONS);
  }

  verify(passwordHash: string, password: string): Promise<boolean> {
    return verify(passwordHash, password);
  }

  /** Burns the same CPU time as a real verification. Always resolves to false. */
  async verifyAgainstDummy(password: string): Promise<false> {
    await verify(await this.dummyHash, password);
    return false;
  }
}
