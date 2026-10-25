/** Versioned, authenticated envelope for project snapshots and archives.
 * AES-GCM authenticates the header and each chunk's position. No plaintext is
 * returned until every chunk passes authentication. Keys are never persisted.
 */
const magic = new TextEncoder().encode('MOINPDF-ENCRYPTED\n');
const headerSize = 64;
const chunkSize = 4 * 1024 * 1024;
const iterations = 600_000;
const maxPlaintext = 1300 * 1024 * 1024 + 64;
const invalid = () => new Error('Passwort falsch oder Projektdatei beschädigt.');
export function projectEncryptionAvailable() {
  return typeof crypto !== 'undefined' && !!crypto.subtle;
}
export async function isEncryptedProject(file: Blob) {
  const bytes = new Uint8Array(await file.slice(0, magic.length).arrayBuffer());
  return magic.every((b, i) => bytes[i] === b);
}
async function keyFor(password: string, salt: Uint8Array<ArrayBuffer>, usage: KeyUsage) {
  if (!projectEncryptionAvailable())
    throw new Error('Passwortschutz benötigt HTTPS oder localhost.');
  if (!password || password.length > 1024) throw invalid();
  const bytes = new TextEncoder().encode(password);
  try {
    const material = await crypto.subtle.importKey('raw', bytes, 'PBKDF2', false, ['deriveKey']);
    return await crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      [usage],
    );
  } finally {
    bytes.fill(0);
  }
}
function parameters(header: Uint8Array<ArrayBuffer>, index: number): AesGcmParams {
  const iv = new Uint8Array(12);
  iv.set(header.subarray(48, 56));
  new DataView(iv.buffer).setUint32(8, index);
  const additionalData = new Uint8Array(headerSize + 4);
  additionalData.set(header);
  new DataView(additionalData.buffer).setUint32(headerSize, index);
  return { name: 'AES-GCM', iv, additionalData, tagLength: 128 };
}
export async function encryptProject(file: Blob, password: string, signal?: AbortSignal) {
  signal?.throwIfAborted();
  if (password.length < 12 || password.length > 1024)
    throw new Error('Bitte ein Passwort mit 12 bis 1024 Zeichen verwenden.');
  if (!file.size || file.size > maxPlaintext) throw new Error('Die Projektdatei ist zu groß.');
  const header = new Uint8Array(headerSize),
    view = new DataView(header.buffer);
  header.set(magic);
  view.setUint32(20, 1);
  view.setUint32(24, file.size);
  view.setUint32(28, chunkSize);
  crypto.getRandomValues(header.subarray(32, 56));
  view.setUint32(56, iterations);
  const key = await keyFor(password, header.slice(32, 48), 'encrypt');
  const parts: BlobPart[] = [header];
  for (let offset = 0, index = 0; offset < file.size; offset += chunkSize, index++) {
    signal?.throwIfAborted();
    const plain = new Uint8Array(await file.slice(offset, offset + chunkSize).arrayBuffer());
    try {
      parts.push(await crypto.subtle.encrypt(parameters(header, index), key, plain));
    } finally {
      plain.fill(0);
    }
  }
  signal?.throwIfAborted();
  return new Blob(parts, { type: 'application/vnd.moinpdf.encrypted' });
}
export async function decryptProject(file: Blob, password: string, signal?: AbortSignal) {
  signal?.throwIfAborted();
  if (file.size < headerSize + 17) throw invalid();
  const header = new Uint8Array(await file.slice(0, headerSize).arrayBuffer());
  const view = new DataView(header.buffer),
    length = view.getUint32(24);
  if (
    !magic.every((b, i) => header[i] === b) ||
    view.getUint32(20) !== 1 ||
    view.getUint32(28) !== chunkSize ||
    view.getUint32(56) !== iterations ||
    header.subarray(magic.length, 20).some(Boolean) ||
    view.getUint32(60) !== 0 ||
    !length ||
    length > maxPlaintext ||
    file.size !== headerSize + length + Math.ceil(length / chunkSize) * 16
  )
    throw invalid();
  const key = await keyFor(password, header.slice(32, 48), 'decrypt');
  const parts: Uint8Array<ArrayBuffer>[] = [];
  try {
    for (let offset = 0, index = 0; offset < length; offset += chunkSize, index++) {
      signal?.throwIfAborted();
      const size = Math.min(chunkSize, length - offset);
      const start = headerSize + offset + index * 16;
      const encrypted = await file.slice(start, start + size + 16).arrayBuffer();
      try {
        parts.push(
          new Uint8Array(await crypto.subtle.decrypt(parameters(header, index), key, encrypted)),
        );
      } catch {
        throw invalid();
      }
    }
    signal?.throwIfAborted();
    return new Blob(parts, { type: 'application/octet-stream' });
  } finally {
    for (const part of parts) part.fill(0);
  }
}
