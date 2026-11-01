import type { InstallationSettings } from './installation.js';

/** Practical budgets, not model-vendor minimums or a performance benchmark. */
export const LOCAL_MODEL_PROFILES = [
  {
    model: 'qwen3:4b',
    title: 'Compact',
    memoryGiB: 12,
    recommendedMemoryGiB: 16,
    cpuCores: 4,
    gpuMemoryGiB: 4,
    diskGiB: 4,
    download: '2.5 GB',
    description: 'A smaller model for everyday explanations and short practice.',
    source: 'https://ollama.com/library/qwen3:4b',
  },
  {
    model: 'qwen3:8b',
    title: 'Balanced',
    memoryGiB: 20,
    recommendedMemoryGiB: 24,
    cpuCores: 6,
    gpuMemoryGiB: 8,
    diskGiB: 7,
    download: '5.2 GB',
    description: 'More model capacity for writing feedback and longer conversations.',
    source: 'https://ollama.com/library/qwen3:8b',
  },
  {
    model: 'qwen3:14b',
    title: 'Larger model',
    memoryGiB: 28,
    recommendedMemoryGiB: 32,
    cpuCores: 8,
    gpuMemoryGiB: 12,
    diskGiB: 12,
    download: '9.3 GB',
    description: 'For a stronger workstation or server with more memory headroom.',
    source: 'https://ollama.com/library/qwen3:14b',
  },
] as const;

export const API_PROVIDER_PROFILES = [
  { id: 'custom', title: 'Other / OpenAI-compatible', endpoint: '', model: '', source: '' },
  {
    id: 'openai',
    title: 'OpenAI / GPT',
    endpoint: 'https://api.openai.com/v1',
    model: 'gpt-4.1-mini',
    source: 'https://developers.openai.com/api/docs/models/gpt-4.1-mini',
  },
  {
    id: 'anthropic',
    title: 'Anthropic / Claude',
    endpoint: 'https://api.anthropic.com/v1',
    model: 'claude-haiku-5-5',
    source: 'https://platform.claude.com/docs/en/models/overview',
  },
  {
    id: 'deepseek',
    title: 'DeepSeek',
    endpoint: 'https://api.deepseek.com',
    model: 'deepseek-flash',
    source: 'https://api-docs.deepseek.com/quick_start/',
  },
] as const;

export const VOICE_PROFILES = [
  {
    id: 'none',
    title: 'Browser voices',
    label: 'Lightest',
    memoryGiB: 0,
    cpuCores: 0,
    disk: 'No server model',
    detail:
      'Uses voices available on each learner’s device. Quality and offline availability vary.',
  },
  {
    id: 'piper-medium',
    title: 'Local · lightweight',
    label: 'CPU neural voice',
    memoryGiB: 4,
    cpuCores: 2,
    disk: '~61 MB download',
    detail: 'Piper LJ Speech medium. English US voice, generated on your server. No GPU needed.',
  },
  {
    id: 'piper-high',
    title: 'Local · enhanced',
    label: 'Larger neural voice',
    memoryGiB: 8,
    cpuCores: 4,
    disk: '~109 MB download',
    detail:
      'Piper LJ Speech high. More compute for the fuller model. Preview to compare; no GPU needed.',
  },
  {
    id: 'edge',
    title: 'Online · natural',
    label: 'No voice API key',
    memoryGiB: 2,
    cpuCores: 1,
    disk: 'No local model',
    detail: 'Microsoft Edge voices. Pronunciation text is sent to Microsoft. Internet required.',
  },
] as const;

export type MachineBudget = { memoryGiB: number; cpuCores: number; gpuMemoryGiB: number | null };

export function modelCompatibility(
  machine: MachineBudget | null,
  profile: (typeof LOCAL_MODEL_PROFILES)[number],
) {
  if (!machine) return { label: 'Check model server specs', kind: 'unknown' as const };
  if (machine.memoryGiB < profile.memoryGiB || machine.cpuCores < profile.cpuCores)
    return { label: 'Below suggested resources', kind: 'limited' as const };
  if (machine.gpuMemoryGiB !== null && machine.gpuMemoryGiB >= profile.gpuMemoryGiB)
    return { label: 'Good fit with GPU', kind: 'good' as const };
  return { label: 'Fits RAM · CPU can be slower', kind: 'possible' as const };
}

export function recommendInstallation(machine: MachineBudget): {
  mode: InstallationSettings['mode'];
  model: string;
  speech: InstallationSettings['speech'];
  reason: string;
} {
  if (machine.memoryGiB < 12 || machine.cpuCores < 4)
    return {
      mode: 'openai-compatible',
      model: '',
      speech: 'none',
      reason:
        'An API keeps model computation off this machine. Browser voices keep the server load small.',
    };
  const candidates = [...LOCAL_MODEL_PROFILES].reverse();
  const profile =
    candidates.find(
      (item) =>
        machine.memoryGiB >= item.recommendedMemoryGiB &&
        machine.cpuCores >= item.cpuCores &&
        (item.model === 'qwen3:4b' ||
          (machine.gpuMemoryGiB ?? 0) >= item.gpuMemoryGiB ||
          machine.cpuCores >= 8),
    ) ?? LOCAL_MODEL_PROFILES[0];
  return {
    mode: 'ollama',
    model: profile.model,
    speech: machine.memoryGiB >= 24 && machine.cpuCores >= 6 ? 'piper-high' : 'piper-medium',
    reason:
      'Local inference is a reasonable starting point for this budget. GPU acceleration improves speed; CPU-only generation can take longer.',
  };
}
