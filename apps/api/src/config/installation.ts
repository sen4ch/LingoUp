import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { InstallationSettingsSchema, type InstallationSettings } from '@lingoup/contracts';
export { InstallationSettingsSchema, type InstallationSettings };
export const InstallationRuntimeSchema = z.object({
  revision: z.uuid(),
  settings: InstallationSettingsSchema,
});

export function readInstallationRuntime(directory?: string) {
  if (!directory || !existsSync(join(directory, 'runtime.json'))) return null;
  return InstallationRuntimeSchema.parse(
    JSON.parse(readFileSync(join(directory, 'runtime.json'), 'utf8')),
  );
}

export function installationEnvironment(settings: InstallationSettings): Record<string, string> {
  return {
    AI_PROVIDER: settings.mode === 'basic' ? 'none' : 'ai-service',
    AI_ALLOW_EXTERNAL: String(settings.allowExternal),
    IMAGE_SEARCH_PROVIDER: settings.imageSearch,
    SPEECH_PROVIDER: settings.speech,
    SPEAKING_ENABLED: String(settings.speaking),
    PIPER_QUALITY: settings.speech === 'piper-high' ? 'high' : 'medium',
  };
}
