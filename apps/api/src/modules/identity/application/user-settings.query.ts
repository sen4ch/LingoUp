import { Injectable } from '@nestjs/common';
import type { UserSettings } from '@lingoup/contracts';
import { DomainError } from '../../../platform/index.js';
import { IdentityRepository } from '../infrastructure/identity.repository.js';

/** Public read API of the Identity module for other modules. */
@Injectable()
export class UserSettingsQuery {
  constructor(private readonly repository: IdentityRepository) {}

  async getForUser(userId: string): Promise<UserSettings> {
    const settings = await this.repository.findSettings(userId);
    if (!settings) throw new DomainError('UNAUTHENTICATED', 'Session is no longer valid');
    return settings;
  }
}
