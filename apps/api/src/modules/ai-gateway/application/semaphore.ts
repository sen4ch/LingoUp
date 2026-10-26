/** Counting semaphore that bounds concurrent AI calls per API instance. */
export class Semaphore {
  private available: number;
  private readonly waiters: (() => void)[] = [];

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1)
      throw new Error('Semaphore capacity must be >= 1');
    this.available = capacity;
  }

  /** Resolves with a release function; rejects if the signal aborts while waiting. */
  acquire(signal: AbortSignal): Promise<() => void> {
    if (signal.aborted) return Promise.reject(signal.reason as Error);
    if (this.available > 0) {
      this.available--;
      return Promise.resolve(this.releaser());
    }
    return new Promise((resolve, reject) => {
      const grant = () => {
        signal.removeEventListener('abort', onAbort);
        resolve(this.releaser());
      };
      const onAbort = () => {
        const index = this.waiters.indexOf(grant);
        if (index >= 0) this.waiters.splice(index, 1);
        reject(signal.reason as Error);
      };
      signal.addEventListener('abort', onAbort, { once: true });
      this.waiters.push(grant);
    });
  }

  get pending(): number {
    return this.waiters.length;
  }

  private releaser(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = this.waiters.shift();
      if (next) next();
      else this.available++;
    };
  }
}
