'use client';
import { Button } from '@/components/ui/button';
import { ui } from '@/lib/ui-language';
import { useLanguage } from './appearance';
import type { PanelProps } from './advanced-shared';
export function TimestampPanel({ source, busy, run }: PanelProps) {
  useLanguage();
  return (
    <section className="advanced-card">
      <h2>{ui('PDF mit Zeitstempel versehen')}</h2>
      <p>
        {ui(
          'Erstellt einen RFC-3161-Dokumentzeitstempel ohne persönliches Signaturzertifikat. Nur der SHA-256-Prüfwert wird an FreeTSA gesendet; die PDF bleibt im Browser.',
        )}
      </p>
      <p className="fine-note">
        {ui(
          'Geprüft werden Signatur, Zertifikatsbindung, Verwendungszweck, Prüfwert und Anfragezuordnung. Vertrauen in die Zertifikatskette und Widerruf werden nicht bestätigt. Bereits signierte PDFs und XFA bleiben unverändert und werden abgewiesen.',
        )}
      </p>
      <Button
        disabled={busy}
        onClick={() =>
          run(async (ctx) => {
            const { timestampPdf } = await import('@/lib/pdf-timestamp');
            const result = await timestampPdf(
              source.bytes,
              async (body) => {
                const response = await fetch('/api/timestamp', {
                  method: 'POST',
                  headers: {
                    'X-MoinPDF-Client': 'web',
                    'Content-Type': 'application/timestamp-query',
                  },
                  body,
                  signal: AbortSignal.any([ctx.signal, AbortSignal.timeout(30000)]),
                  redirect: 'error',
                });
                if (!response.ok)
                  throw new Error('Der Zeitstempeldienst ist gerade nicht erreichbar.');
                return response.arrayBuffer();
              },
              ctx.signal,
            );
            return {
              blob: new Blob([result.bytes.slice()], { type: 'application/pdf' }),
              filename: source.name.replace(/\.pdf$/i, '') + '-Zeitstempel.pdf',
              kind: 'pdf',
              pages: source.pdf.numPages,
              note: ui('Zeitstempel erstellt: ') + result.time,
            };
          })
        }
      >
        {ui('Zeitstempel anfordern')}
      </Button>
    </section>
  );
}
