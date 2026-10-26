import { z } from 'zod';
import { CefrLevelSchema, IsoDateTimeSchema, UuidSchema } from './common.js';

const EmailSchema = z
  .email()
  .max(254)
  .transform((value) => value.trim().toLowerCase());

// Length-only policy (NIST SP 800-63B); the upper bound protects the password hasher.
const PasswordSchema = z.string().min(10).max(128);

export const RegisterRequestSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  displayName: z.string().trim().min(1).max(60),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1).max(128),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const NATIVE_LANGUAGES = ['ru', 'uk', 'en', 'es', 'de', 'fr', 'pt', 'tr', 'zh'] as const;
export const NativeLanguageSchema = z.enum(NATIVE_LANGUAGES);
export type NativeLanguage = z.infer<typeof NativeLanguageSchema>;

export const UserSettingsSchema = z.object({
  nativeLanguage: NativeLanguageSchema,
  targetLevel: CefrLevelSchema,
  dailyGoalMinutes: z.number().int().min(5).max(240),
  /** Explicit consent to send user content to external (third-party) AI providers. */
  aiDataSharing: z.boolean(),
});
export type UserSettings = z.infer<typeof UserSettingsSchema>;

export const UpdateSettingsRequestSchema = UserSettingsSchema.partial();
export type UpdateSettingsRequest = z.infer<typeof UpdateSettingsRequestSchema>;

export const CurrentUserSchema = z.object({
  id: UuidSchema,
  email: z.string(),
  displayName: z.string(),
  createdAt: IsoDateTimeSchema,
  settings: UserSettingsSchema,
});
export type CurrentUser = z.infer<typeof CurrentUserSchema>;

export const DeleteAccountRequestSchema = z.object({
  password: z.string().min(1).max(128),
});
export type DeleteAccountRequest = z.infer<typeof DeleteAccountRequestSchema>;

export const PersonalDataExportSchema = z.object({
  exportedAt: IsoDateTimeSchema,
  sections: z.record(z.string(), z.unknown()),
});
export type PersonalDataExport = z.infer<typeof PersonalDataExportSchema>;
