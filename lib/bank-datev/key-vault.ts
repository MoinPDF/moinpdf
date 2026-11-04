// Only the encrypted envelope is persisted. The passphrase and unlocked key stay in memory.
const slot = 'moinpdf.datev.personal.v1';
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const decode = (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
async function derive(passphrase: string, salt: Uint8Array<ArrayBuffer>) {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}
export const personalKeyFormat = /^sk-[A-Za-z0-9_-]{12,500}$/;
export function hasSavedKey() {
  try {
    return !!localStorage.getItem(slot);
  } catch {
    return false;
  }
}
export async function saveKey(key: string, passphrase: string) {
  if (!personalKeyFormat.test(key) || passphrase.length < 12) throw Error();
  const salt = crypto.getRandomValues(new Uint8Array(16)),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await derive(passphrase, salt),
    new TextEncoder().encode(key),
  );
  localStorage.setItem(
    slot,
    JSON.stringify([encode(salt), encode(iv), encode(new Uint8Array(cipher))]),
  );
}
export async function unlockKey(passphrase: string) {
  const data = localStorage.getItem(slot);
  if (!data || data.length > 1500) throw Error();
  const [salt, iv, cipher] = JSON.parse(data).map(decode);
  if (salt.length !== 16 || iv.length !== 12) throw Error();
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    await derive(passphrase, salt),
    cipher,
  );
  const key = new TextDecoder().decode(plain);
  if (!personalKeyFormat.test(key)) throw Error();
  return key;
}
export const forgetKey = () => localStorage.removeItem(slot);
