import { Inject, Injectable } from '@nestjs/common';
import type {
  CurrentUser,
  LoginRequest,
  RegisterRequest,
  UpdateSettingsRequest,
  UserSettings,
} from '@lingoup/contracts';
import { isPgError, PG_ERROR, type Database } from '@lingoup/database';
import {
  DATABASE,
  DomainError,
  OutboxWriter,
  PersonalDataRegistry,
  type PersonalDataExporter,
} from '../../../platform/index.js';
import { PasswordHasher } from '../infrastructure/password-hasher.js';
import { IdentityRepository, toUserSettings } from '../infrastructure/identity.repository.js';

@Injectable()
export class IdentityService implements PersonalDataExporter {
  readonly section = 'account';

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly repository: IdentityRepository,
    private readonly hasher: PasswordHasher,
    private readonly outbox: OutboxWriter,
    personalData: PersonalDataRegistry,
  ) {
    personalData.register(this);
  }

  async register(input: RegisterRequest): Promise<{ userId: string }> {
    const passwordHash = await this.hasher.hash(input.password);
    try {
      return await this.db.transaction(async (tx) => {
        const user = await this.repository.insertUser(tx, {
          email: input.email,
          passwordHash,
          displayName: input.displayName,
        });
        await this.outbox.append(tx, {
          type: 'UserRegistered',
          version: 1,
          userId: user.id,
          payload: { userId: user.id },
        });
        return { userId: user.id };
      });
    } catch (error) {
      if (isPgError(error, PG_ERROR.uniqueViolation, 'users_email_key')) {
        // Revealing registration status is accepted for an MVP without email verification;
        // see docs/architecture/tech-debt.md.
        throw new DomainError('EMAIL_ALREADY_REGISTERED', 'This email is already registered');
      }
      throw error;
    }
  }

  async verifyCredentials(input: LoginRequest): Promise<{ userId: string }> {
    const user = await this.repository.findUserByEmail(input.email);
    const valid = user
      ? await this.hasher.verify(user.passwordHash, input.password)
      : await this.hasher.verifyAgainstDummy(input.password);
    if (!user || !valid) {
      throw new DomainError('INVALID_CREDENTIALS', 'Invalid email or password');
    }
    return { userId: user.id };
  }

  async getCurrentUser(userId: string): Promise<CurrentUser> {
    const row = await this.repository.findUserWithSettings(userId);
    if (!row) throw new DomainError('UNAUTHENTICATED', 'Session is no longer valid');
    return {
      id: row.user.id,
      email: row.user.email,
      displayName: row.user.displayName,
      createdAt: row.user.createdAt.toISOString(),
      settings: toUserSettings(row.settings),
    };
  }

  updateSettings(userId: string, patch: UpdateSettingsRequest): Promise<UserSettings> {
    return this.repository.updateSettings(userId, patch);
  }

  /** Deletes the account and, via ON DELETE CASCADE, all personal data of every module. */
  async deleteAccount(userId: string, password: string): Promise<void> {
    const row = await this.repository.findUserWithSettings(userId);
    if (!row || !(await this.hasher.verify(row.user.passwordHash, password))) {
      throw new DomainError('INVALID_CREDENTIALS', 'Password is incorrect');
    }
    await this.db.transaction(async (tx) => {
      await this.outbox.purgeUser(tx, userId);
      await this.repository.deleteUser(tx, userId);
    });
  }

  exportUserData(userId: string): Promise<unknown> {
    return this.repository.exportUser(userId);
  }
}
