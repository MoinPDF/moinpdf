export function deviceBudget(
  device: { deviceMemory?: number; hardwareConcurrency?: number } = typeof navigator === 'undefined'
    ? {}
    : navigator,
) {
  const ample = (device.deviceMemory ?? 4) >= 8 && (device.hardwareConcurrency ?? 4) >= 8;
  return { ocrWorkers: ample ? 2 : 1, previewRetentionMs: ample ? 10000 : 1500 };
}
/** Abortable FIFO lease. A cancelled waiter never consumes a worker slot. */
export function createResourcePool(limit: number) {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('Invalid resource limit');
  let active = 0;
  const queue: {
    signal: AbortSignal;
    resolve: (release: () => void) => void;
    reject: (e: unknown) => void;
    abort: () => void;
  }[] = [];
  const drain = () => {
    while (active < limit && queue.length) {
      const next = queue.shift()!;
      next.signal.removeEventListener('abort', next.abort);
      if (next.signal.aborted) {
        next.reject(next.signal.reason);
        continue;
      }
      active++;
      let released = false;
      next.resolve(() => {
        if (!released) {
          released = true;
          active--;
          drain();
        }
      });
    }
  };
  return (signal: AbortSignal) =>
    new Promise<() => void>((resolve, reject) => {
      if (signal.aborted) {
        reject(signal.reason);
        return;
      }
      const waiter = { signal, resolve, reject, abort: () => {} };
      waiter.abort = () => {
        const index = queue.indexOf(waiter);
        if (index !== -1) queue.splice(index, 1);
        reject(signal.reason);
      };
      signal.addEventListener('abort', waiter.abort, { once: true });
      queue.push(waiter);
      drain();
    });
}
let ocrPool: ReturnType<typeof createResourcePool> | undefined;
export function acquireOcrWorker(signal: AbortSignal) {
  ocrPool ??= createResourcePool(deviceBudget().ocrWorkers);
  return ocrPool(signal);
}
