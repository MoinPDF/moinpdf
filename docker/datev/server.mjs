import { createServer } from 'node:http';
import { timingSafeEqual, createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

import { Readable } from 'node:stream';
import { createDatevHandler } from './handler.mjs';

const hash = (value) => createHash('sha256').update(value).digest();
export function createDatevServer(env = process.env, requestOpenAI = fetch) {
  const token = env.MOINPDF_DATEV_ACCESS_TOKEN || '';
  const handle = createDatevHandler(
    {
      ownerKey: token.length >= 20 ? env.OPENAI_API_KEY?.trim() : '',
      authorize: (value) => timingSafeEqual(hash(value), hash(token)),
      model: env.OPENAI_MODEL || 'gpt-5-mini',
    },
    requestOpenAI,
  );
  return createServer({ requestTimeout: 15000, headersTimeout: 10000 }, async (req, res) => {
    const controller = new AbortController();
    res.once('close', () => controller.abort());
    try {
      const scheme = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      const url = new URL(req.url, scheme + '://' + req.headers.host);
      if (!req.url.startsWith('/') || req.url.startsWith('//')) throw Error();
      const request = new Request(url, {
        method: req.method,
        headers: req.headers,
        signal: controller.signal,
        ...(req.method === 'POST' && { body: Readable.toWeb(req), duplex: 'half' }),
      });
      const response = await handle(request);
      if (res.destroyed) return;
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(await response.text());
    } catch {
      if (!res.destroyed) {
        res.writeHead(400, { 'Cache-Control': 'no-store' });
        res.end();
      }
    }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createDatevServer().listen(8766, process.env.MOINPDF_DATEV_BIND || '127.0.0.1');
}
