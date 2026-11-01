import { availableParallelism, cpus, freemem, totalmem } from 'node:os';
import { readFileSync } from 'node:fs';
import { statfs } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { InstallationHardware } from '@lingoup/contracts';

const GiB = 1024 ** 3;
export function containerResources(
  hostMemory: number,
  hostCpus: number,
  read: (path: string) => string | null,
) {
  const limit = Number(
    read('/sys/fs/cgroup/memory.max') ?? read('/sys/fs/cgroup/memory/memory.limit_in_bytes'),
  );
  const usedRaw =
    read('/sys/fs/cgroup/memory.current') ?? read('/sys/fs/cgroup/memory/memory.usage_in_bytes');
  const used = usedRaw === null ? null : Number(usedRaw);
  const memory = limit > 0 && Number.isFinite(limit) ? Math.min(limit, hostMemory) : hostMemory;
  const cpuMax = read('/sys/fs/cgroup/cpu.max')?.trim().split(/\s+/);
  const quota = Number(cpuMax?.[0] ?? read('/sys/fs/cgroup/cpu/cpu.cfs_quota_us'));
  const period = Number(cpuMax?.[1] ?? read('/sys/fs/cgroup/cpu/cpu.cfs_period_us'));
  const cores = quota > 0 && period > 0 ? Math.min(hostCpus, quota / period) : hostCpus;
  return { memory, cores, used, limited: memory < hostMemory || cores < hostCpus };
}

export async function detectHardware(directory: string): Promise<InstallationHardware> {
  const read = (path: string) => {
    try {
      return readFileSync(path, 'utf8').trim();
    } catch {
      return null;
    }
  };
  const resources = containerResources(totalmem(), availableParallelism(), read);
  let diskFreeGiB: number | null = null;
  let gpu: InstallationHardware['gpu'] = null;
  try {
    const disk = await statfs(directory);
    diskFreeGiB = (disk.bavail * disk.bsize) / GiB;
  } catch {
    /* Storage may not expose statistics. */
  }
  try {
    const { stdout } = await promisify(execFile)(
      'nvidia-smi',
      ['--query-gpu=name,memory.total', '--format=csv,noheader,nounits'],
      { timeout: 2000, maxBuffer: 8192 },
    );
    // Single-device capacity; do not assume multiple GPUs can pool their memory.
    const devices = stdout
      .trim()
      .split('\n')
      .map((line) => {
        const fields = line.split(',');
        return { name: fields[0]?.trim() ?? 'NVIDIA GPU', memoryGiB: Number(fields[1]) / 1024 };
      })
      .filter((device) => Number.isFinite(device.memoryGiB));
    gpu = devices.sort((a, b) => b.memoryGiB - a.memoryGiB)[0] ?? null;
  } catch {
    /* Unknown means not exposed here, rather than no GPU on the host. */
  }
  const available =
    resources.memory < totalmem() && resources.used !== null
      ? Math.max(0, resources.memory - resources.used)
      : Math.min(freemem(), resources.memory);
  return {
    memoryGiB: resources.memory / GiB,
    availableMemoryGiB: available / GiB,
    cpuCores: resources.cores,
    cpuModel: cpus()[0]?.model ?? 'Unknown CPU',
    diskFreeGiB,
    gpu,
    containerLimited: resources.limited,
    scope: 'application-server',
  };
}
