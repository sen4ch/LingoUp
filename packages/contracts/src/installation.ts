import { z } from 'zod';

const endpoint = z
  .url()
  .max(500)
  .refine((value) => {
    const url = new URL(value);
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  }, 'Use an HTTP or HTTPS address without credentials, query parameters or fragments');

export const InstallationSettingsSchema = z
  .object({
    mode: z.enum(['basic', 'ollama', 'openai-compatible']),
    apiProvider: z.enum(['custom', 'openai', 'anthropic', 'deepseek']).default('custom'),
    workspaceId: z
      .string()
      .trim()
      .max(120)
      .regex(/^[a-zA-Z0-9_:-]*$/)
      .default(''),
    endpoint: endpoint.default('http://ollama:11434'),
    model: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/)
      .default('qwen3:4b'),
    apiKey: z.string().max(4096).optional(),
    clearApiKey: z.boolean().default(false),
    allowExternal: z.boolean().default(false),
    dataLocality: z.enum(['local', 'external']).default('external'),
    imageSearch: z.enum(['none', 'wikimedia', 'openverse']).default('none'),
    speech: z.enum(['none', 'edge', 'piper-medium', 'piper-high']).default('none'),
    hardwareOverride: z
      .object({
        memoryGiB: z.number().min(0.5).max(16384),
        cpuCores: z.number().min(0.25).max(4096),
        gpuMemoryGiB: z.number().min(0).max(4096).nullable(),
      })
      .nullable()
      .default(null),
    speaking: z.boolean().default(false),
  })
  .refine(
    (value) =>
      value.mode !== 'openai-compatible' ||
      value.dataLocality !== 'external' ||
      value.allowExternal,
    {
      message: 'Allow external AI processing to use an external provider',
      path: ['allowExternal'],
    },
  )
  .refine(
    (value) =>
      value.mode !== 'openai-compatible' ||
      value.apiProvider === 'custom' ||
      value.dataLocality === 'external',
    {
      message:
        'Named cloud providers use external processing. Choose Other for a server you operate.',
      path: ['dataLocality'],
    },
  );
export type InstallationSettings = z.infer<typeof InstallationSettingsSchema>;

export const InstallationStatusSchema = z.object({
  enabled: z.boolean(),
  required: z.boolean().default(false),
  claimed: z.boolean(),
  configured: z.boolean(),
  authenticated: z.boolean(),
  activeRevision: z.string().nullable(),
});
export type InstallationStatus = z.infer<typeof InstallationStatusSchema>;

export const InstallationConnectionSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
  models: z.array(z.string()).max(200).default([]),
});
export const InstallationApplySchema = z.object({ revision: z.uuid() });
export const InstallationPullSchema = z.object({
  status: z.enum(['idle', 'downloading', 'complete', 'error']),
  message: z.string(),
  completed: z.number().nonnegative(),
  total: z.number().nonnegative(),
});
export type InstallationPull = z.infer<typeof InstallationPullSchema>;

export const InstallationHardwareSchema = z.object({
  memoryGiB: z.number().nonnegative(),
  availableMemoryGiB: z.number().nonnegative(),
  cpuCores: z.number().positive(),
  cpuModel: z.string(),
  diskFreeGiB: z.number().nonnegative().nullable(),
  gpu: z.object({ name: z.string(), memoryGiB: z.number().nonnegative() }).nullable(),
  containerLimited: z.boolean(),
  scope: z.literal('application-server'),
});
export type InstallationHardware = z.infer<typeof InstallationHardwareSchema>;

export const InstallationSafeSettingsSchema = z
  .object(InstallationSettingsSchema.shape)
  .omit({ apiKey: true })
  .extend({ apiKeyConfigured: z.boolean() });
