import type { Wllama } from '@wllama/wllama/esm/index.js';
import type { RunContext } from './advanced-types';
import { abortable } from './pdf-engine';
import { assistantExamples } from './grounded-assistant';
export const localModelInfo = {
  name: 'Qwen2.5 0.5B Instruct',
  revision: '9217f5db79a29953eb74d5343926648285ec7e67',
  filename: 'qwen2.5-0.5b-instruct-q4_0.gguf',
  bytes: 428730208,
  digest: '7671c0c304e6ce5a7fc577bcb12aba01e2c155cc2efd29b2213c95b18edaf6ed',
  url: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/9217f5db79a29953eb74d5343926648285ec7e67/qwen2.5-0.5b-instruct-q4_0.gguf',
};
const verified = new WeakSet<Blob>();
export async function verifyLocalModel(file: Blob, signal: AbortSignal) {
  signal.throwIfAborted();
  if (file.size !== localModelInfo.bytes)
    throw new Error(
      `Bitte die Modelldatei „${localModelInfo.filename}“ mit 428.730.208 Bytes auswählen.`,
    );
  if (verified.has(file)) return;
  const digest = await new Promise<string>((resolve, reject) => {
    const worker = new Worker(new URL('../workers/model-checksum.ts', import.meta.url), {
      type: 'module',
    });
    const cleanup = () => {
      worker.terminate();
      signal.removeEventListener('abort', abort);
      clearTimeout(timer);
    };
    const abort = () => {
      cleanup();
      reject(new DOMException('Abgebrochen', 'AbortError'));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Die Modellprüfung hat das Zeitlimit überschritten.'));
    }, 120000);
    signal.addEventListener('abort', abort, { once: true });
    worker.onerror = () => {
      cleanup();
      reject(new Error('Der Modellprüfer konnte nicht gestartet werden.'));
    };
    worker.onmessage = ({ data }) => {
      cleanup();
      if (data.error) reject(new Error(data.error));
      else resolve(data.digest);
    };
    worker.postMessage(file);
  });
  if (digest !== localModelInfo.digest)
    throw new Error(
      'Die Modelldatei stimmt nicht mit dem geprüften Modell überein oder ist beschädigt.',
    );
  verified.add(file);
}
export class LocalDocumentModel {
  private engine: Wllama | null = null;
  private loading = false;
  async load(file: Blob, ctx: RunContext) {
    if (this.engine) return;
    if (this.loading) throw new Error('Das Modell wird bereits geladen.');
    this.loading = true;
    try {
      ctx.report({ percent: 5, label: 'Lokale Modelldatei prüfen' });
      await verifyLocalModel(file, ctx.signal);
      const { Wllama } = await import('@wllama/wllama/esm/index.js');
      ctx.signal.throwIfAborted();
      const quiet = () => {};
      const engine = new Wllama(
        { default: '/vendor/llm/wllama.wasm' },
        {
          allowOffline: true,
          suppressNativeLog: true,
          logger: { debug: quiet, log: quiet, warn: quiet, error: quiet },
        },
      );
      engine.setCompat(null);
      this.engine = engine;
      const abort = () => {
        void this.close();
      };
      ctx.signal.addEventListener('abort', abort, { once: true });
      try {
        ctx.report({ percent: 15, label: 'Sprachmodell auf diesem Gerät laden' });
        await abortable(
          engine.loadModel([file], {
            n_gpu_layers: 0,
            n_threads: 1,
            n_ctx: 4096,
            n_batch: 128,
            n_ubatch: 64,
          }),
          ctx.signal,
        );
      } finally {
        ctx.signal.removeEventListener('abort', abort);
      }
    } catch (error) {
      await this.close();
      throw error;
    } finally {
      this.loading = false;
    }
  }
  async answer(system: string, user: string, schema: unknown, signal: AbortSignal) {
    signal.throwIfAborted();
    if (!this.engine) throw new Error('Das lokale Modell ist nicht geladen.');
    const engine = this.engine,
      abort = () => {
        void this.close();
      };
    signal.addEventListener('abort', abort, { once: true });
    try {
      const response = await abortable(
        engine.createChatCompletion({
          messages: [
            { role: 'system', content: system },
            ...assistantExamples,
            { role: 'user', content: user },
          ],
          temperature: 0,
          max_tokens: 320,
          abortSignal: signal,
          response_format: {
            type: 'json_schema',
            json_schema: { name: 'grounded_answer', schema, strict: true },
          },
          cache_prompt: false,
        }),
        signal,
      );
      return response.choices[0]?.message.content || '';
    } finally {
      signal.removeEventListener('abort', abort);
    }
  }
  async close() {
    const engine = this.engine;
    this.engine = null;
    if (engine) await engine.exit().catch(() => {});
  }
}
