import type { ServerTool, ExportFile } from './advanced-types';
declare const __MOINPDF_SELF_HOSTED__: boolean;
export const integratedDocumentServer =
  typeof __MOINPDF_SELF_HOSTED__ !== 'undefined' && __MOINPDF_SELF_HOSTED__
    ? '/api/documents'
    : null;
export const integratedWebsiteServer = integratedDocumentServer ? '/api/website' : null;
export type ServerCapabilities = {
  apiVersion: 1;
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
class ServerResponseError extends Error {}
async function call<T>(
  base: string,
  token: string,
  path: string,
  signal: AbortSignal,
  read: (response: Response) => Promise<T>,
  body?: FormData,
): Promise<T> {
  const integrated =
    (!!integratedDocumentServer && base === integratedDocumentServer) ||
    (!!integratedWebsiteServer && base === integratedWebsiteServer);
  if (!integrated && !token.trim())
    throw new Error('Bitte den API-Schlüssel deines Dokumentenservers eingeben.');
  const headers: Record<string, string> = integrated
    ? { 'X-MoinPDF-Client': 'web' }
    : { Authorization: `Bearer ${token.trim()}` };
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
    body ? 180000 : 12000,
  );
  try {
    const response = await fetch(documentServerUrl(base) + path, {
      method: body ? 'POST' : 'GET',
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
    ),
    disposition = headers.get('content-disposition') || '',
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
