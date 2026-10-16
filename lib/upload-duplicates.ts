import { contentDigest } from './content-digest';
import type { Source } from './pdf-engine';

const fingerprints = new WeakMap<Source, Promise<string | undefined>>();
export function uploadFingerprint(file: File) {
  return file.arrayBuffer().then((bytes) => contentDigest(new Uint8Array(bytes)));
}
export async function duplicateSource(file: File, fingerprint: string, sources: Source[]) {
  for (const source of sources) {
    if (source.size !== file.size) continue;
    let digest = fingerprints.get(source);
    if (!digest) {
      digest = source.originalDigest
        ? Promise.resolve(source.originalDigest)
        : source.invoiceOriginal
          ? contentDigest(source.invoiceOriginal.bytes)
          : source.kind === 'pdf' && !source.wasEncrypted
            ? contentDigest(source.bytes)
            : Promise.resolve(undefined);
      fingerprints.set(source, digest);
    }
    if ((await digest) === fingerprint) return source;
  }
}
