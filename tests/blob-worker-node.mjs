import assert from 'node:assert/strict';
import { resolveObjectURL } from 'node:buffer';
import { Worker as NodeWorker } from 'node:worker_threads';

// Run the browser bundle's actual Blob worker code in a separate Node thread.
// pdfmake's PNG decoder uses this browser API; jsdom does not implement it.
export function installBlobWorkerRuntime() {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  const active = new Set();
  const terminations = [];
  let created = 0;
  class BlobWorker {
    onmessage = null;
    onerror = null;
    #ready;
    #terminated = false;

    constructor(url) {
      const blob = resolveObjectURL(String(url));
      assert(blob, `The test runtime only accepts local Blob workers: ${url}`);
      created++;
      active.add(this);
      this.#ready = blob.text().then(code => {
        if (this.#terminated) return undefined;
        const worker = new NodeWorker(`
          const { parentPort } = require('node:worker_threads');
          globalThis.self = globalThis;
          globalThis.onmessage = null;
          globalThis.postMessage = (data, transfer) => parentPort.postMessage(data, transfer);
          globalThis.addEventListener = (type, listener) => {
            if (type === 'error') process.on('uncaughtException', error => listener({ error }));
            else if (type === 'message') parentPort.on('message', data => listener({ data }));
            else throw new Error('Unsupported worker event: ' + type);
          };
          parentPort.on('message', data => globalThis.onmessage?.({ data }));
          ${code}
        `, { eval: true });
        worker.on('message', data => this.onmessage?.({ data }));
        worker.on('error', error => this.#fail(error));
        worker.on('exit', () => active.delete(this));
        return worker;
      });
    }

    #fail(error) {
      if (this.onerror) this.onerror({ error, message: error.message });
      else queueMicrotask(() => { throw error; });
    }

    postMessage(data, transfer) {
      this.#ready.then(worker => {
        if (!this.#terminated) worker?.postMessage(data, transfer);
      }).catch(error => this.#fail(error));
    }

    terminate() {
      this.#terminated = true;
      const done = this.#ready.then(worker => worker?.terminate()).finally(() => active.delete(this));
      terminations.push(done);
      return done;
    }
  }
  Object.defineProperty(globalThis, 'Worker', { value: BlobWorker, configurable: true, writable: true });
  return {
    get created() { return created; },
    async restore() {
      await Promise.all(terminations);
      const remaining = [...active];
      await Promise.all(remaining.map(worker => worker.terminate()));
      if (previous) Object.defineProperty(globalThis, 'Worker', previous);
      else delete globalThis.Worker;
      assert.equal(remaining.length, 0, 'PNG decoding must terminate its workers');
    },
  };
}
