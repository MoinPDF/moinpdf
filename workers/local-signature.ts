import { signPdfLocally } from '../lib/local-signature-core';
self.onmessage = async ({ data }) => {
  try {
    const bytes = await signPdfLocally(data.bytes, data.certificate, data.password);
    self.postMessage({ bytes }, { transfer: [bytes.buffer] });
  } catch (e) {
    self.postMessage({
      error: e instanceof Error ? e.message : 'Die Signatur konnte nicht erstellt werden.',
    });
  } finally {
    data.bytes.fill(0);
    data.certificate.fill(0);
    data.password = '';
    self.close();
  }
};
