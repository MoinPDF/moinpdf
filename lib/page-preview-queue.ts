type PreviewJob = {
  run: () => Promise<void>;
  signal: AbortSignal;
  priority: () => number;
  remove: () => void;
};
const pending: PreviewJob[] = [];
let running = false;

/** One renderer at a time, with visible pages ahead of offscreen preparation. */
export function queuePagePreview(
  run: () => Promise<void>,
  signal: AbortSignal,
  priority: () => number,
) {
  if (signal.aborted) return;
  const job: PreviewJob = {
    run,
    signal,
    priority,
    remove: () => {
      const index = pending.indexOf(job);
      if (index >= 0) pending.splice(index, 1);
    },
  };
  pending.push(job);
  signal.addEventListener('abort', job.remove, { once: true });
  queueMicrotask(() => void drain());
}
async function drain() {
  if (running) return;
  running = true;
  try {
    while (pending.length) {
      pending.sort((a, b) => b.priority() - a.priority());
      const job = pending.shift()!;
      job.signal.removeEventListener('abort', job.remove);
      if (!job.signal.aborted) await job.run().catch(() => {});
    }
  } finally {
    running = false;
  }
}
