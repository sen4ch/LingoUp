import { describe, expect, it } from 'vitest';
import {
  InstallationSettingsSchema,
  LOCAL_MODEL_PROFILES,
  modelCompatibility,
  recommendInstallation,
} from '@lingoup/contracts';
import { containerResources } from './hardware.js';

const GiB = 1024 ** 3;
const readFiles = (files: Record<string, string>) => (path: string) => files[path] ?? null;
describe('hardware budgets and advice', () => {
  it('uses cgroup v2 memory and fractional CPU quotas rather than the physical host totals', () => {
    expect(
      containerResources(
        64 * GiB,
        16,
        readFiles({
          '/sys/fs/cgroup/memory.max': String(8 * GiB),
          '/sys/fs/cgroup/memory.current': String(2 * GiB),
          '/sys/fs/cgroup/cpu.max': '150000 100000',
        }),
      ),
    ).toMatchObject({ memory: 8 * GiB, used: 2 * GiB, cores: 1.5, limited: true });
  });
  it('handles unlimited v2 and legacy v1 without confusing missing values with zero RAM', () => {
    expect(
      containerResources(
        32 * GiB,
        8,
        readFiles({ '/sys/fs/cgroup/memory.max': 'max', '/sys/fs/cgroup/cpu.max': 'max 100000' }),
      ),
    ).toMatchObject({ memory: 32 * GiB, cores: 8, used: null, limited: false });
    expect(
      containerResources(
        32 * GiB,
        8,
        readFiles({
          '/sys/fs/cgroup/memory/memory.limit_in_bytes': String(4 * GiB),
          '/sys/fs/cgroup/cpu/cpu.cfs_quota_us': '200000',
          '/sys/fs/cgroup/cpu/cpu.cfs_period_us': '100000',
        }),
      ),
    ).toMatchObject({ memory: 4 * GiB, cores: 2 });
  });
  it('suggests API for weak machines and a local model for stronger machines', () => {
    expect(recommendInstallation({ memoryGiB: 8, cpuCores: 2, gpuMemoryGiB: null }).mode).toBe(
      'openai-compatible',
    );
    expect(recommendInstallation({ memoryGiB: 16, cpuCores: 4, gpuMemoryGiB: null })).toMatchObject(
      { mode: 'ollama', model: 'qwen3:4b', speech: 'piper-medium' },
    );
    expect(recommendInstallation({ memoryGiB: 64, cpuCores: 16, gpuMemoryGiB: 24 })).toMatchObject({
      mode: 'ollama',
      model: 'qwen3:14b',
      speech: 'piper-high',
    });
  });
  it('does not claim GPU acceleration or compatibility when hardware is unknown', () => {
    expect(modelCompatibility(null, LOCAL_MODEL_PROFILES[0]).kind).toBe('unknown');
    expect(
      modelCompatibility(
        { memoryGiB: 16, cpuCores: 4, gpuMemoryGiB: null },
        LOCAL_MODEL_PROFILES[0],
      ).kind,
    ).toBe('possible');
    expect(
      modelCompatibility({ memoryGiB: 8, cpuCores: 2, gpuMemoryGiB: 24 }, LOCAL_MODEL_PROFILES[2])
        .kind,
    ).toBe('limited');
  });
  it('keeps cloud providers external and accepts local voice choices independently of LLM mode', () => {
    expect(
      InstallationSettingsSchema.safeParse({
        mode: 'openai-compatible',
        apiProvider: 'openai',
        dataLocality: 'local',
      }).success,
    ).toBe(false);
    expect(InstallationSettingsSchema.parse({ mode: 'basic', speech: 'piper-high' }).speech).toBe(
      'piper-high',
    );
  });
});
