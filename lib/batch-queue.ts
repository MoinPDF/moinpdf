import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { contentDigest } from './content-digest';
import { openSource, filenameStem, type Source } from './pdf-engine';
import {
  validateWorkflow,
  runWorkflowStep,
  conditionMatches,
  applyWorkflowAction,
  stepLabels,
  type SavedWorkflow,
} from './advanced-pipeline';
import { validateWorkflowGraph, type WorkflowGraph } from './workflow-graph';
import { uniqueNames, type RunContext, type ExportFile } from './advanced-types';
export type BatchWorkflow = SavedWorkflow | WorkflowGraph;
export const batchStepCount = (workflow: BatchWorkflow) =>
  workflow.version === 1 ? workflow.steps.length : workflow.nodes.length;
export type BatchFile = {
  name: string;
  filename: string;
  digest: string;
  step: number;
  next?: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  error?: string;
  size: number;
  pages: number;
  log: string[];
};
export type BatchQueue = {
  id: string;
  updated: number;
  workflow: BatchWorkflow;
  files: BatchFile[];
};
const MAX_STORED = 160 * 1024 * 1024;
async function db() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('moinpdf.batch.v1', 2);
    request.onupgradeneeded = () => {
      for (const name of ['queues', 'bytes', 'leases'])
        if (!request.result.objectStoreNames.contains(name))
          request.result.createObjectStore(name, name === 'queues' ? { keyPath: 'id' } : undefined);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
type BatchLease = { token: string; expires: number };
const lockedMessage = 'Dieser Stapel wird bereits in einem anderen Tab verarbeitet.';
const lostMessage =
  'Die Stapelsperre ist abgelaufen. Bitte den gespeicherten Stand erneut fortsetzen.';
async function updateLease(id: string, change: (current?: BatchLease) => BatchLease | undefined) {
  const database = await db();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction('leases', 'readwrite'),
        store = tx.objectStore('leases');
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error || new Error(lostMessage));
      const request = store.get(id);
      request.onsuccess = () => {
        try {
          const next = change(request.result as BatchLease | undefined);
          if (next) store.put(next, id);
          else store.delete(id);
        } catch (error) {
          reject(error);
          tx.abort();
        }
      };
    });
  } finally {
    database.close();
  }
}
// IndexedDB also works on local HTTP. Every checkpoint checks the token in
// the same write transaction: a suspended/expired tab cannot overwrite a new
// owner's progress even if its old PDF operation finishes later.
async function withBatchLease<T>(id: string, task: (token: string) => Promise<T>) {
  const token = Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) =>
    n.toString(16).padStart(2, '0'),
  ).join('');
  await updateLease(id, (current) => {
    if (current && current.expires > Date.now()) throw new Error(lockedMessage);
    return { token, expires: Date.now() + 60000 };
  });
  const timer = setInterval(() => {
    void updateLease(id, (current) => {
      if (current?.token !== token || current.expires <= Date.now()) throw new Error(lostMessage);
      return { token, expires: Date.now() + 60000 };
    }).catch(() => {});
  }, 15000);
  try {
    return await task(token);
  } finally {
    clearInterval(timer);
    await updateLease(id, (current) => (current?.token === token ? undefined : current)).catch(
      () => {},
    );
  }
}
function withLeaseInTransaction(
  tx: IDBTransaction,
  id: string,
  token: string,
  write: () => void,
  reject: (error: Error) => void,
) {
  const request = tx.objectStore('leases').get(id);
  request.onsuccess = () => {
    const current = request.result as BatchLease | undefined;
    if (current?.token !== token || current.expires <= Date.now()) {
      reject(new Error(lostMessage));
      tx.abort();
    } else write();
  };
}
const requestValue = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
export async function batchIdentity(
  sources: Source[],
  workflow: BatchWorkflow,
  signal?: AbortSignal,
) {
  const validated =
      workflow.version === 2 ? validateWorkflowGraph(workflow) : validateWorkflow(workflow),
    files: BatchFile[] = [];
  const names = uniqueNames(sources.map((s) => filenameStem(s.name) + '-bearbeitet.pdf'));
  for (const [index, source] of sources.entries())
    files.push({
      name: source.name,
      filename: names[index],
      digest: await contentDigest(source.bytes, signal),
      step: 0,
      status: 'pending',
      size: 0,
      pages: source.pdf.numPages,
      log: [],
    });
  const id = await contentDigest(
    new TextEncoder().encode(
      JSON.stringify({
        version: 1,
        workflow: validated,
        files: files.map((f) => [f.name, f.digest]),
      }),
    ),
    signal,
  );
  return { id, workflow: validated, files, updated: Date.now() } satisfies BatchQueue;
}
export async function loadBatch(id: string) {
  const database = await db();
  try {
    return (await requestValue(database.transaction('queues').objectStore('queues').get(id))) as
      BatchQueue | undefined;
  } finally {
    database.close();
  }
}
export async function listBatches(): Promise<BatchQueue[]> {
  const database = await db();
  try {
    return await requestValue(database.transaction('queues').objectStore('queues').getAll());
  } finally {
    database.close();
  }
}
export async function batchBytes(id: string, index: number) {
  const database = await db();
  try {
    return (await requestValue(
      database.transaction('bytes').objectStore('bytes').get(`${id}:${index}`),
    )) as Blob | undefined;
  } finally {
    database.close();
  }
}
async function saveBatch(queue: BatchQueue, token: string, index?: number, bytes?: Uint8Array) {
  const database = await db();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(['queues', 'bytes', 'leases'], 'readwrite'),
        table = tx.objectStore('queues');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () =>
        reject(tx.error || new Error('Der Stapel konnte nicht gespeichert werden.'));
      withLeaseInTransaction(
        tx,
        queue.id,
        token,
        () => {
          const request = table.getAll();
          request.onsuccess = () => {
            const stored = (request.result as BatchQueue[])
              .filter((q) => q.id !== queue.id)
              .reduce((n, q) => n + q.files.reduce((sum, f) => sum + f.size, 0), 0);
            if (stored + queue.files.reduce((n, f) => n + f.size, 0) > MAX_STORED) {
              tx.abort();
              reject(
                new Error(
                  'Die Stapelsicherung ist voll. Fertige Dateien herunterladen und den gespeicherten Stapel entfernen.',
                ),
              );
              return;
            }
            table.put({ ...queue, updated: Date.now() });
            if (index !== undefined && bytes)
              tx.objectStore('bytes').put(
                new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }),
                `${queue.id}:${index}`,
              );
          };
        },
        reject,
      );
    });
  } finally {
    database.close();
  }
}
async function deleteBatch(queue: BatchQueue, token: string) {
  const database = await db();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(['queues', 'bytes', 'leases'], 'readwrite');
      withLeaseInTransaction(
        tx,
        queue.id,
        token,
        () => {
          tx.objectStore('queues').delete(queue.id);
          queue.files.forEach((_, index) => tx.objectStore('bytes').delete(`${queue.id}:${index}`));
        },
        reject,
      );
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  } finally {
    database.close();
  }
}
export async function clearBatch(queue: BatchQueue) {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  const clear = () => withBatchLease(queue.id, (token) => deleteBatch(queue, token));
  if (!locks) return clear();
  return locks.request(`moinpdf-batch:${queue.id}`, { ifAvailable: true }, (lock) => {
    if (!lock) throw new Error(lockedMessage);
    return clear();
  });
}
async function processBatch(
  queue: BatchQueue,
  sources: Source[],
  password: string,
  ctx: RunContext,
  options: { pause: () => boolean; retry?: boolean; update: (queue: BatchQueue) => void },
  token: string,
) {
  const identity = await batchIdentity(sources, queue.workflow, ctx.signal);
  if (identity.id !== queue.id)
    throw new Error('Dateien oder Ablauf wurden geändert. Bitte einen neuen Stapel starten.');
  const state: BatchQueue = structuredClone((await loadBatch(queue.id)) || queue);
  const total = batchStepCount(state.workflow);
  const publish = () => options.update(structuredClone(state));
  await saveBatch(state, token);
  for (const [index, file] of state.files.entries()) {
    if (file.status === 'done' || (file.status === 'failed' && !options.retry)) continue;
    if (options.pause() || ctx.signal.aborted) break;
    let owned: Source | undefined;
    try {
      file.error = undefined;
      file.status = 'running';
      publish();
      const saved = file.step ? await batchBytes(state.id, index) : undefined;
      if (file.step && !saved)
        throw new Error('Der gespeicherte Zwischenstand fehlt. Bitte den Stapel neu starten.');
      let current = saved
        ? (owned = await openSource(new File([saved], file.name, { type: 'application/pdf' })))
        : sources[index];
      for (let step = file.step; step < total; step++) {
        if (options.pause() || ctx.signal.aborted) break;
        const stepContext: RunContext = {
          signal: ctx.signal,
          report: (p) =>
            ctx.report({
              percent: ((index + (step + p.percent / 100) / total) / sources.length) * 100,
              label: `${file.name} · ${step + 1}/${total} · ${p.label}`,
            }),
        };
        let result: {
          bytes: Uint8Array;
          action: string;
          protected: boolean;
          next?: string;
          done: boolean;
        };
        if (state.workflow.version === 1) {
          result = {
            ...(await runWorkflowStep(current, state.workflow.steps[step], password, stepContext)),
            done: step + 1 === total,
          };
        } else {
          const graph = state.workflow,
            node = graph.nodes.find((n) => n.id === (file.next || graph.entry))!;
          if (node.type === 'action')
            result = {
              bytes: await applyWorkflowAction(current, node.action, password, stepContext),
              action: `${node.id}: ${stepLabels[node.action.kind]}`,
              protected: node.action.kind === 'protect',
              next: node.next,
              done: false,
            };
          else if (node.type === 'condition') {
            const decision = await conditionMatches(current, node.condition, stepContext);
            result = {
              bytes: current.bytes,
              action: `${node.id}: ${decision ? 'Ja' : 'Nein'}`,
              protected: false,
              next: decision ? node.yes : node.no,
              done: false,
            };
          } else
            result = {
              bytes: current.bytes,
              action: `${node.id}: Ende`,
              protected: false,
              done: true,
            };
          result.done ||= graph.nodes.find((n) => n.id === result.next)?.type === 'end';
        }
        ctx.signal.throwIfAborted();
        const pageCount = result.protected
          ? current.pdf.numPages
          : (await PDFDocument.load(result.bytes, { updateMetadata: false })).getPageCount();
        const next: BatchFile = {
          ...file,
          step: step + 1,
          next: result.next,
          size: result.bytes.length,
          pages: pageCount,
          status: result.done ? 'done' : 'running',
          log: [...file.log, result.action],
        };
        const checkpoint = { ...state, files: state.files.map((f, i) => (i === index ? next : f)) };
        await saveBatch(checkpoint, token, index, result.bytes); // bytes and next step commit atomically
        Object.assign(file, next);
        publish();
        if (owned) {
          await owned.pdf.loadingTask.destroy();
          owned = undefined;
        }
        if (result.done) break;
        if (step + 1 < total && !options.pause() && !ctx.signal.aborted) {
          if (result.protected) throw new Error('Passwortschutz muss der letzte Schritt sein.');
          current = owned = await openSource(
            new File([new Uint8Array(result.bytes)], file.name, { type: 'application/pdf' }),
          );
        }
      }
      if (file.status === 'running') file.status = 'pending';
    } catch (error) {
      file.status = ctx.signal.aborted ? 'pending' : 'failed';
      file.error = ctx.signal.aborted ? undefined : (error as Error).message;
    } finally {
      if (owned) await owned.pdf.loadingTask.destroy();
      await saveBatch(state, token);
      publish();
    }
  }
  return state;
}
export async function resumeBatch(
  ...args: [
    BatchQueue,
    Source[],
    string,
    RunContext,
    { pause: () => boolean; retry?: boolean; update: (queue: BatchQueue) => void },
  ]
) {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  const run = () => withBatchLease(args[0].id, (token) => processBatch(...args, token));
  if (!locks) return run();
  return locks.request(`moinpdf-batch:${args[0].id}`, { ifAvailable: true }, (lock) => {
    if (!lock) throw new Error(lockedMessage);
    return run();
  });
}
export async function batchZip(queue: BatchQueue, signal: AbortSignal): Promise<ExportFile> {
  const zip = new JSZip();
  let count = 0,
    pages = 0;
  for (const [index, file] of queue.files.entries()) {
    signal.throwIfAborted();
    if (file.status !== 'done') continue;
    const data = await batchBytes(queue.id, index);
    if (!data) throw new Error('Eine Ergebnisdatei fehlt im lokalen Speicher.');
    zip.file(file.filename, await data.arrayBuffer());
    count++;
    pages += file.pages;
  }
  if (!count) throw new Error('Noch keine fertigen Dateien vorhanden.');
  zip.file(
    'MoinPDF-Ablaufprotokoll.json',
    JSON.stringify(
      {
        workflow: queue.workflow.name,
        files: queue.files.map(({ name, status, step, log, error }) => ({
          name,
          status,
          step,
          log,
          error,
        })),
      },
      null,
      2,
    ),
  );
  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' }, () =>
    signal.throwIfAborted(),
  );
  signal.throwIfAborted();
  return {
    blob,
    filename: 'MoinPDF-Stapel.zip',
    kind: 'zip',
    pages,
    note: `${count}/${queue.files.length} Dateien abgeschlossen.`,
  };
}
