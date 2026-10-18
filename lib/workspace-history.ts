import type { Source } from './pdf-engine';
import type { ProjectSnapshot } from './local-projects';

export const snapshotSourceIds = (snapshot: ProjectSnapshot) =>
  snapshot.sourceIds || [...new Set(snapshot.pages.map((p) => p.sourceId))];
export function workspaceSources(
  current: Source[],
  archived: Source[],
  history: ProjectSnapshot[],
  future: ProjectSnapshot[],
) {
  const ids = new Set([
    ...current.map((s) => s.id),
    ...[...history, ...future].flatMap(snapshotSourceIds),
  ]);
  return [
    ...new Map(
      [...current, ...archived].filter((s) => ids.has(s.id)).map((s) => [s.id, s]),
    ).values(),
  ];
}
export function boundedHistory(history: ProjectSnapshot[], current: Source[], pool: Source[]) {
  const ids = new Set(current.map((s) => s.id));
  const retained: ProjectSnapshot[] = [];
  for (const snapshot of history.slice(-30).reverse()) {
    for (const id of snapshotSourceIds(snapshot)) ids.add(id);
    if (
      pool
        .filter((s) => ids.has(s.id))
        .reduce((n, s) => n + s.bytes.length + (s.invoiceOriginal?.bytes.length || 0), 0) >
        240 * 1024 ** 2 ||
      ids.size > 600
    )
      break;
    retained.unshift(snapshot);
  }
  return retained;
}
