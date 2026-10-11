import { contentDigestBlob } from '../lib/content-digest';
self.onmessage = async ({ data }: { data: Blob }) => {
  try {
    self.postMessage({ digest: await contentDigestBlob(data) });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : 'Modellprüfung fehlgeschlagen.',
    });
  }
};
