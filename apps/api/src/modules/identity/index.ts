// Public API of the Identity module. Other modules import only from this file.
export { IdentityModule } from './identity.module.js';
export { UserSettingsQuery } from './application/user-settings.query.js';
export { CurrentUser } from './http/current-user.decorator.js';
export type { AuthenticatedUser } from './domain/authenticated-user.js';
