export const TRANSFER_LIMIT = 10 * 1024 * 1024;
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const unhex = (s: string) => new Uint8Array((s.match(/../g) || []).map((x) => parseInt(x, 16)));
export const randomHex = (n: number) => hex(crypto.getRandomValues(new Uint8Array(n)));
export type TransferSession = {
  id: string;
  send: string;
  receive: string;
  expires: number;
  key: string;
};
export function transferFromHash(hash: string): TransferSession | null {
  const raw = new URLSearchParams(hash.replace(/^#/, '')).get('moin-transfer');
  if (!raw) return null;
  const [id, send, key] = raw.split('.');
  if (!/^[a-f0-9]{48}$/.test(id) || !/^[a-f0-9]{48}$/.test(send) || !/^[a-f0-9]{64}$/.test(key))
    throw new Error('Ungültiger Übertragungslink.');
  return { id, send, key, receive: '', expires: 0 };
}
export async function transferCall(
  session: TransferSession | null,
  action = '',
  init: RequestInit = {},
  signal?: AbortSignal,
) {
  const response = await fetch('/api/transfer' + (session ? '/' + session.id : '') + action, {
    ...init,
    headers: {
      'X-MoinPDF-Client': 'web',
      ...(session ? { Authorization: 'Bearer ' + (session.receive || session.send) } : {}),
      ...init.headers,
    },
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(30000)])
      : AbortSignal.timeout(30000),
    cache: 'no-store',
    redirect: 'error',
  });
  if (!response.ok)
    throw Object.assign(
      new Error(
        response.status === 410
          ? 'Die Verbindung ist abgelaufen. Bitte einen neuen QR-Code öffnen.'
          : response.status === 409
            ? 'Am PC wartet noch eine Datei auf Bestätigung.'
            : response.status === 413
              ? 'Die Datei oder die Anzahl der Übertragungen ist zu groß.'
              : 'Die Übertragung ist gerade nicht erreichbar. Bitte erneut versuchen.',
      ),
      { status: response.status },
    );
  return response;
}
export async function sealTransfer(file: File, keyHex: string, item: string) {
  if (file.size < 1 || file.size > TRANSFER_LIMIT)
    throw new Error('Bitte eine Datei mit höchstens 10 MB verwenden.');
  const metadata = new TextEncoder().encode(
    JSON.stringify({ name: file.name.slice(0, 180), type: file.type }),
  );
  const plain = new Uint8Array(4 + metadata.length + file.size);
  new DataView(plain.buffer).setUint32(0, metadata.length);
  plain.set(metadata, 4);
  plain.set(new Uint8Array(await file.arrayBuffer()), 4 + metadata.length);
  const key = await crypto.subtle.importKey('raw', unhex(keyHex), { name: 'AES-GCM' }, false, [
    'encrypt',
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(item) },
      key,
      plain,
    ),
  );
  const data = new Uint8Array(12 + encrypted.length);
  data.set(iv);
  data.set(encrypted, 12);
  return data;
}
export async function openTransfer(data: Uint8Array, keyHex: string, item: string) {
  if (data.length < 32 || data.length > TRANSFER_LIMIT + 4096)
    throw new Error('Ungültige Übertragungsgröße.');
  const key = await crypto.subtle.importKey('raw', unhex(keyHex), { name: 'AES-GCM' }, false, [
    'decrypt',
  ]);
  const plain = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: data.slice(0, 12), additionalData: new TextEncoder().encode(item) },
      key,
      data.slice(12),
    ),
  );
  const size = new DataView(plain.buffer).getUint32(0);
  if (size > 2048 || size > plain.length - 4) throw new Error('Ungültige Übertragungsdaten.');
  const meta = JSON.parse(new TextDecoder().decode(plain.subarray(4, 4 + size)));
  if (
    typeof meta.name !== 'string' ||
    typeof meta.type !== 'string' ||
    !plain.subarray(4 + size).length
  )
    throw new Error('Ungültige Übertragungsdaten.');
  return new File([plain.slice(4 + size)], meta.name.replace(/[\\/\x00-\x1f]/g, '_'), {
    type: meta.type,
  });
}
