import type { Source } from './pdf-engine';
import type { RunContext } from './advanced-types';
import { serverCapabilities, runServerJob } from './document-server';
export async function runFormatExport(
  source: Source,
  format: 'azw3' | 'cbr',
  options: Record<string, unknown>,
  base: string,
  token: string,
  ctx: RunContext,
) {
  const capabilities = await serverCapabilities(base, token, ctx.signal);
  if (!capabilities.capabilities[format === 'cbr' ? 'formatCbr' : 'formatAzw3'])
    throw new Error(
      format === 'cbr'
        ? 'CBR-Erstellung benötigt einen separat installierten und passend lizenzierten RAR-Konverter.'
        : 'Der Server unterstützt den AZW3-Export noch nicht. Bitte den Dokumentenserver aktualisieren.',
    );
  const body = new FormData();
  body.append(
    'file',
    new Blob([new Uint8Array(source.bytes)], { type: 'application/pdf' }),
    source.name,
  );
  body.append('options', JSON.stringify(options));
  ctx.report({ percent: 20, label: 'Deine Datei wird verarbeitet …' });
  return runServerJob(base, token, '/v1/formats/' + format, body, ctx.signal);
}
