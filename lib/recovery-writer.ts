export type RecoveryStatus = {
  phase: 'idle' | 'restore' | 'pending' | 'saving' | 'saved' | 'error';
  updated?: number;
};

/** One write at a time, retaining only the newest waiting snapshot. A saved
 * indicator always describes the current revision, never an older write. */
export function createRecoveryWriter<T>(
  write: (value: T) => Promise<unknown>,
  report: (status: RecoveryStatus) => void,
  delay = 1200,
) {
  let revision = 0;
  let pending: { revision: number; value: T } | undefined;
  let running: Promise<void> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stopTimer = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  function flush(): Promise<void> {
    stopTimer();
    if (running) return running;
    if (!pending) return Promise.resolve();
    running = Promise.resolve()
      .then(async () => {
        while (pending) {
          const next = pending;
          pending = undefined;
          report({ phase: 'saving' });
          try {
            await write(next.value);
            if (next.revision === revision) report({ phase: 'saved', updated: Date.now() });
          } catch {
            if (next.revision === revision) report({ phase: 'error' });
          }
        }
      })
      .finally(() => {
        running = undefined;
        // A status listener may have queued another snapshot at completion.
        if (pending) void flush();
      });
    return running;
  }
  return {
    schedule(value: T) {
      pending = { revision: ++revision, value };
      report({ phase: 'pending' });
      stopTimer();
      timer = setTimeout(() => void flush(), delay);
    },
    flush,
    cancel() {
      revision++;
      pending = undefined;
      stopTimer();
      return running || Promise.resolve();
    },
  };
}
