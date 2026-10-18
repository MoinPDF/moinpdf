import type { ServerTool, ExportFile } from './advanced-types';
declare const __MOINPDF_SELF_HOSTED__: boolean;
export const integratedDocumentServer =
  typeof __MOINPDF_SELF_HOSTED__ !== 'undefined' && __MOINPDF_SELF_HOSTED__
    ? '/api/documents'
    : null;
export const integratedWebsiteServer = integratedDocumentServer ? '/api/website' : null;
export type ServerCapabilities = {
  apiVersion: 1;
  jobQueue?: { operations: string[]; retentionSeconds: number; timeoutSeconds: number };
  service: string;
  translationService?: string | null;
  translationStatus?: 'ready' | 'starting' | 'disabled';
  capabilities: Record<string, boolean>;
  versions?: Record<string, string>;
  signatureLevels?: Record<string, boolean>;
  audioVoices?: { id: string; label: string; language: string }[];
  limits?: { maxBytes: number; audioCharacters?: number; audioSections?: number };
};
export function documentServerUrl(input: string) {
  if (integratedDocumentServer && input === integratedDocumentServer) return input;
  if (integratedWebsiteServer && input === integratedWebsiteServer) return input;
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error('Bitte eine vollständige Serveradresse eingeben.');
  }
  if (url.username || url.password || url.search || url.hash)
    throw new Error('Serveradresse ohne Zugangsdaten, Suchparameter oder Fragment eingeben.');
  if (
    url.protocol !== 'https:' &&
    !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  )
    throw new Error('Für den Dokumentenserver bitte HTTPS verwenden.');
  return url.href.replace(/\/$/, '');
}
class ServerResponseError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
async function call<T>(
  base: string,
  token: string,
  path: string,
  signal: AbortSignal,
  read: (response: Response) => Promise<T>,
  body?: FormData,
  requestOptions: { method?: string; headers?: Record<string, string>; download?: boolean } = {},
): Promise<T> {
  const integrated =
    (!!integratedDocumentServer && base === integratedDocumentServer) ||
    (!!integratedWebsiteServer && base === integratedWebsiteServer);
  if (!integrated && !token.trim())
    throw new Error('Bitte den API-Schlüssel deines Dokumentenservers eingeben.');
  const headers: Record<string, string> = integrated
    ? { 'X-MoinPDF-Client': 'web' }
    : { Authorization: `Bearer ${token.trim()}` };
  Object.assign(headers, requestOptions.headers);
  signal.throwIfAborted();
  const request = new AbortController(),
    cancel = () => request.abort(signal.reason);
  signal.addEventListener('abort', cancel, { once: true });
  let timedOut = false;
  const timer = setTimeout(
    () => {
      timedOut = true;
      request.abort();
    },
    body || requestOptions.download ? 180000 : 12000,
  );
  try {
    const response = await fetch(documentServerUrl(base) + path, {
      method: requestOptions.method || (body ? 'POST' : 'GET'),
      headers,
      body,
      signal: request.signal,
      credentials: integrated ? 'same-origin' : 'omit',
      redirect: 'error',
    });
    if (!response.ok) {
      const payload = (await response.json().catch((error) => {
        if (request.signal.aborted) throw error;
        return null;
      })) as { detail?: unknown } | null;
      throw new ServerResponseError(
        typeof payload?.detail === 'string'
          ? payload.detail
          : response.status === 401
            ? 'Der API-Schlüssel wurde nicht akzeptiert.'
            : `Der Server meldet Fehler ${response.status}.`,
        response.status,
      );
    }
    return await read(response);
  } catch (e) {
    if (signal.aborted) throw signal.reason ?? e;
    if (timedOut)
      throw new Error(
        body
          ? 'Die Verarbeitung dauert zu lange. Bitte versuche es mit einer kleineren Datei erneut.'
          : 'Die Funktion antwortet gerade nicht. Bitte versuche es gleich noch einmal.',
      );
    if (e instanceof ServerResponseError) throw e;
    throw new Error('Die Verbindung wurde unterbrochen. Bitte versuche es gleich noch einmal.');
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', cancel);
  }
}
export async function serverCapabilities(base: string, token: string, signal: AbortSignal) {
  const v = (await call(base, token, '/v1/capabilities', signal, (r) =>
    r.json(),
  )) as Partial<ServerCapabilities>;
  if (v.apiVersion !== 1 || !v.capabilities)
    throw new Error('Dieser Server unterstützt die benötigte MoinPDF-Schnittstelle nicht.');
  return v as ServerCapabilities;
}
export const serverCapabilityKey: Record<ServerTool, string> = {
  'svg-export': 'svg',
  'font-outlines': 'vectorRewrite',
  'flatten-layers': 'vectorRewrite',
  'pdf-audio': 'speech',
  'optimize-pdf': 'optimize',
  'ebook-pdf': 'ebook',
  'pdf-powerpoint': 'powerpoint',
  'html-pdf': 'html',
  'auto-orient': 'orient',
  'book-dewarp': 'dewarp',
  'form-detect': 'formDetect',
  'redaction-check': 'documentChecks',
  'print-check': 'documentChecks',
  'accessibility-check': 'documentChecks',
  'translate-pdf': 'translate',
  'zugferd-create': 'zugferd',
  'word-mail-merge': 'wordMerge',
  'pdf-word': 'pdfWord',
  'email-pdf': 'email',
  'office-pdf': 'office',
  pdfa: 'pdfa',
  'xrechnung-validate': 'xrechnung',
  'certificate-sign': 'signatures',
};
export async function runServerJob(
  base: string,
  token: string,
  path: string,
  body: FormData,
  signal: AbortSignal,
): Promise<ExportFile> {
  const { blob, headers } = await call(
    base,
    token,
    path,
    signal,
    async (r) => ({ blob: await r.blob(), headers: r.headers }),
    body,
  );
  return serverResult(blob, headers);
}

function serverResult(blob: Blob, headers: Headers): ExportFile {
  const disposition = headers.get('content-disposition') || '',
    encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1],
    plain = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  let name = 'Ergebnis';
  try {
    name = encoded ? decodeURIComponent(encoded) : plain || name;
  } catch {}
  name = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
  const type = blob.type.toLowerCase(),
    kind = type.includes('pdf') ? 'pdf' : type.includes('zip') ? 'zip' : 'data';
  return {
    blob,
    filename: name,
    kind,
    pages: 0,
    note: decodeServerNote(headers.get('x-moinpdf-note')),
  };
}

function decodeServerNote(value: string | null) {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export type BackgroundJob = {
  id: string;
  base: string;
  ticket: string;
  operation: string;
  name: string;
  created: number;
  expires: number;
  status: 'uploading' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  error?: string;
};
const jobStorage = 'moinpdf.background-jobs.v1';
let memoryJobs: BackgroundJob[] = [];
export function storedServerJobs(): BackgroundJob[] {
  try {
    const data = JSON.parse(localStorage.getItem(jobStorage) || '[]');
    if (Array.isArray(data))
      memoryJobs = data
        .filter(
          (j) =>
            typeof j.id === 'string' &&
            /^[a-f0-9]{32}$/.test(j.id) &&
            typeof j.ticket === 'string' &&
            /^[a-f0-9]{64}$/.test(j.ticket) &&
            typeof j.base === 'string' &&
            typeof j.name === 'string' &&
            j.expires > Date.now() / 1000,
        )
        .slice(-32);
  } catch {
    /* The live queue remains usable when browser storage is disabled. */
  }
  return memoryJobs;
}
function storeServerJob(job: BackgroundJob, remove = false) {
  memoryJobs = [
    ...storedServerJobs().filter((j) => j.id !== job.id),
    ...(remove ? [] : [job]),
  ].slice(-32);
  try {
    localStorage.setItem(jobStorage, JSON.stringify(memoryJobs));
  } catch {
    /* Keep the ticket in memory. */
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('moinpdf-jobs'));
}
export async function inspectServerJob(job: BackgroundJob, token: string, signal: AbortSignal) {
  const status = (await call(
    job.base,
    token,
    `/v1/jobs/${job.id}`,
    signal,
    (r) => r.json(),
    undefined,
    { headers: { 'X-MoinPDF-Job-Ticket': job.ticket } },
  )) as Pick<BackgroundJob, 'status' | 'error' | 'expires'>;
  const next = { ...job, ...status };
  storeServerJob(next);
  return next;
}
export async function cancelServerJob(job: BackgroundJob, token: string, remove = false) {
  try {
    await call(
      job.base,
      token,
      `/v1/jobs/${job.id}/${remove ? 'delete' : 'cancel'}`,
      new AbortController().signal,
      (r) => r.json(),
      undefined,
      { method: 'POST', headers: { 'X-MoinPDF-Job-Ticket': job.ticket } },
    );
  } catch (error) {
    if (!(remove && error instanceof ServerResponseError && error.status === 404)) throw error;
  }
  if (remove) storeServerJob(job, true);
  else await inspectServerJob(job, token, new AbortController().signal);
}
export function forgetServerJob(job: BackgroundJob) {
  storeServerJob(job, true);
}
function pollDelay(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const stop = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', stop);
      resolve();
    }, 1500);
    signal.addEventListener('abort', stop, { once: true });
  });
}
export async function resumeServerJob(
  job: BackgroundJob,
  token: string,
  signal: AbortSignal,
  report?: (message: string) => void,
): Promise<ExportFile> {
  try {
    for (;;) {
      const next = await inspectServerJob(job, token, signal);
      if (next.status === 'failed')
        throw new Error(next.error || 'Die Verarbeitung ist fehlgeschlagen.');
      if (next.status === 'cancelled') throw new Error('Auftrag abgebrochen.');
      if (next.status === 'completed') {
        const result = await call(
          job.base,
          token,
          `/v1/jobs/${job.id}/result`,
          signal,
          async (r) => serverResult(await r.blob(), r.headers),
          undefined,
          { headers: { 'X-MoinPDF-Job-Ticket': job.ticket }, download: true },
        );
        return result;
      }
      report?.(
        next.status === 'queued'
          ? 'Auftrag wartet auf einen freien Platz …'
          : 'Auftrag wird verarbeitet. Du kannst ihn im Hintergrund fortsetzen.',
      );
      await pollDelay(signal);
    }
  } catch (error) {
    if (signal.aborted && signal.reason !== 'detach')
      await cancelServerJob(job, token).catch(() => {});
    throw error;
  }
}
export async function runQueuedServerJob(
  base: string,
  token: string,
  path: string,
  body: FormData,
  signal: AbortSignal,
  report?: (message: string) => void,
): Promise<ExportFile> {
  const ticket = Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) =>
    n.toString(16).padStart(2, '0'),
  ).join('');
  const id = ticket.slice(0, 32);
  const input = body.get('file');
  const job: BackgroundJob = {
    id,
    base,
    ticket,
    operation: path,
    name: input instanceof File ? input.name : 'Dokument',
    created: Date.now() / 1000,
    expires: Date.now() / 1000 + 86400,
    status: 'uploading',
  };
  // Persist the lookup ticket before uploading. Lost HTTP responses cannot
  // strand an accepted server job, and refreshing never resubmits the document.
  storeServerJob(job);
  const submitted = new FormData();
  for (const [key, value] of body) submitted.append(key, value);
  submitted.append('operation', path);
  report?.('Datei für den Hintergrundauftrag übertragen …');
  try {
    const status = (await call(base, token, '/v1/jobs', signal, (r) => r.json(), submitted, {
      headers: { 'X-MoinPDF-Job-Ticket': ticket },
    })) as Partial<BackgroundJob>;
    storeServerJob({ ...job, ...status });
  } catch (error) {
    if (error instanceof ServerResponseError) storeServerJob(job, true);
    if (signal.aborted && signal.reason !== 'detach')
      await cancelServerJob(job, token).catch(() => {});
    throw error;
  }
  return resumeServerJob(job, token, signal, report);
}
