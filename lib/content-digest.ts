// Content checksums are not signatures or a guarantee about who created a file.
// Keep the fallback usable on local HTTP, where SubtleCrypto is unavailable.
const constants = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const rotate = (n: number, bits: number) => (n >>> bits) | (n << (32 - bits));
class Sha256 {
  private h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  private words = new Uint32Array(64);
  private tail = new Uint8Array(64);
  private used = 0;
  private total = 0;
  private block(bytes: Uint8Array) {
    const words = this.words,
      view = new DataView(bytes.buffer, bytes.byteOffset, 64);
    for (let i = 0; i < 16; i++) words[i] = view.getUint32(i * 4);
    for (let i = 16; i < 64; i++) {
      const x = words[i - 15],
        y = words[i - 2];
      words[i] =
        words[i - 16] +
        (rotate(x, 7) ^ rotate(x, 18) ^ (x >>> 3)) +
        words[i - 7] +
        (rotate(y, 17) ^ rotate(y, 19) ^ (y >>> 10));
    }
    let [a, b, c, d, e, f, g, hh] = this.h;
    for (let i = 0; i < 64; i++) {
      const first =
        (hh +
          (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) +
          ((e & f) ^ (~e & g)) +
          constants[i] +
          words[i]) >>>
        0;
      const second =
        ((rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + first) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (first + second) >>> 0;
    }
    for (const [i, value] of [a, b, c, d, e, f, g, hh].entries()) this.h[i] += value;
  }
  update(bytes: Uint8Array) {
    this.total += bytes.length;
    let offset = 0;
    if (this.used) {
      const count = Math.min(64 - this.used, bytes.length);
      this.tail.set(bytes.subarray(0, count), this.used);
      this.used += count;
      offset = count;
      if (this.used === 64) {
        this.block(this.tail);
        this.used = 0;
      }
    }
    for (; offset + 64 <= bytes.length; offset += 64)
      this.block(bytes.subarray(offset, offset + 64));
    if (offset < bytes.length) {
      this.tail.set(bytes.subarray(offset), this.used);
      this.used += bytes.length - offset;
    }
  }
  finish() {
    const tail = new Uint8Array(this.used < 56 ? 64 : 128);
    tail.set(this.tail.subarray(0, this.used));
    tail[this.used] = 128;
    const view = new DataView(tail.buffer);
    view.setUint32(tail.length - 8, Math.floor(this.total / 0x20000000));
    view.setUint32(tail.length - 4, (this.total * 8) >>> 0);
    for (let offset = 0; offset < tail.length; offset += 64)
      this.block(tail.subarray(offset, offset + 64));
    return Array.from(this.h, (v) => v.toString(16).padStart(8, '0')).join('');
  }
}
const check = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new DOMException('Abgebrochen', 'AbortError');
};
export async function contentDigest(bytes: Uint8Array, signal?: AbortSignal) {
  check(signal);
  if (globalThis.crypto?.subtle) {
    const result = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
    check(signal);
    return Array.from(new Uint8Array(result), (v) => v.toString(16).padStart(2, '0')).join('');
  }
  const hash = new Sha256();
  for (let offset = 0; offset < bytes.length; offset += 1024 * 1024) {
    check(signal);
    hash.update(bytes.subarray(offset, offset + 1024 * 1024));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  check(signal);
  return hash.finish();
}
// Bounded memory for large local model files; callers run this in a disposable worker.
export async function contentDigestBlob(blob: Blob, signal?: AbortSignal) {
  const hash = new Sha256();
  for (let offset = 0; offset < blob.size; offset += 1024 * 1024) {
    check(signal);
    hash.update(new Uint8Array(await blob.slice(offset, offset + 1024 * 1024).arrayBuffer()));
  }
  check(signal);
  return hash.finish();
}
