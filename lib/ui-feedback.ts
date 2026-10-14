/** Ephemeral UI feedback only: no file contents or persistent storage. */
export const FILE_ARRIVAL_MS = 3200;
export const RESULT_FEEDBACK_MS = 1800;

export function createFileArrivalFeedback() {
  const empty: ReadonlySet<object> = new Set();
  let snapshot = empty;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const publish = (next: ReadonlySet<object>) => {
    snapshot = next;
    listeners.forEach((listener) => listener());
  };
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => empty,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    mark(files: readonly object[]) {
      if (!files.length) return;
      clearTimeout(timer);
      publish(new Set(files));
      timer = setTimeout(() => {
        publish(empty);
        timer = undefined;
      }, FILE_ARRIVAL_MS);
    },
  };
}

export const fileArrivals = createFileArrivalFeedback();

export function contentUnderNavigation(
  scrollY: number,
  contentBottom: number,
  navTop: number,
  navHeight: number,
) {
  return navHeight > 0 && scrollY > 2 && contentBottom > navTop + 1;
}
