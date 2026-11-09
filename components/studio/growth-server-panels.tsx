'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from './appearance';
import { ui } from '@/lib/ui-language';
import {
  NumberField,
  Field,
  Text,
  Tick,
  PageSelect,
  PageStage,
  RectFields,
  type PanelProps,
} from './advanced-shared';
import { ServerConnection } from './growth-panels';
import { integratedDocumentServer, runServerJob } from '@/lib/document-server';
import { pdfBlob } from '@/lib/pdf-engine';
import type { Rect } from '@/lib/studio-engine';
import { correctedOcr } from '@/lib/evidence-engine';
import { groupWords } from '@/lib/evidence-model';
type HandLine = { page: number; rect: Rect; text: string; checked: boolean };
export function HandwritingPanel({ source, busy, run }: PanelProps) {
  useLanguage();
  const [base, setBase] = useState(integratedDocumentServer || ''),
    [token, setToken] = useState(''),
    [page, setPage] = useState(0),
    [rect, setRect] = useState<Rect>({ x: 0.1, y: 0.1, w: 0.6, h: 0.06 }),
    [lines, setLines] = useState<HandLine[]>([]);
  return (
    <div className="century-columns">
      <section className="advanced-card">
        <h2>{ui('Handschrift zeilenweise erkennen')}</h2>
        <p>
          {ui(
            'Eine moderne deutsche Handschriftzeile markieren. Erkennung läuft auf dem eigenen Dokumentenserver. Historische Schrift, vollständige Seiten und mehrere Zeilen in einem Bereich werden nicht unterstützt.',
          )}
        </p>
        <ServerConnection base={base} token={token} setBase={setBase} setToken={setToken} />
        <RectFields rect={rect} onChange={setRect} />
        <Button
          disabled={busy || !base || (!integratedDocumentServer && !token) || lines.length >= 50}
          onClick={() =>
            run(async (ctx) => {
              const body = new FormData();
              body.append('file', pdfBlob(source.bytes), source.name);
              body.append('options', JSON.stringify({ lines: [{ page, rect }] }));
              const result = await runServerJob(
                base,
                token,
                '/v1/documents/handwriting',
                body,
                ctx.signal,
              );
              if (result.blob.size > 100000) throw new Error('Die Handschriftausgabe ist zu groß.');
              const data = JSON.parse(await result.blob.text());
              if (
                data.engine !== 'naeyn/de-htr-web-v2' ||
                !Array.isArray(data.lines) ||
                data.lines.length !== 1 ||
                typeof data.lines[0].text !== 'string' ||
                data.lines[0].text.length > 2000
              )
                throw new Error('Ungültige Handschriftausgabe.');
              if (!data.lines[0].text.trim())
                throw new Error('In diesem Bereich wurde keine Handschrift erkannt.');
              setLines([
                ...lines,
                { page, rect: { ...rect }, text: data.lines[0].text, checked: false },
              ]);
            })
          }
        >
          {ui('Markierte Zeile erkennen')}
        </Button>
        {lines.map((l, i) => (
          <article className="evidence-finding" key={i}>
            <Button
              variant="outline"
              onClick={() => {
                setPage(l.page);
                setRect(l.rect);
              }}
            >
              {ui('Original ansehen')} · {l.page + 1}
            </Button>
            <Text
              label="Erkannten Text korrigieren"
              value={l.text}
              onChange={(text) =>
                setLines(lines.map((v, n) => (n === i ? { ...v, text, checked: false } : v)))
              }
            />
            <Tick
              label="Diese Zeile ist am Original geprüft."
              value={l.checked}
              onChange={(checked) =>
                setLines(lines.map((v, n) => (n === i ? { ...v, checked } : v)))
              }
            />
            <Button variant="ghost" onClick={() => setLines(lines.filter((_, n) => n !== i))}>
              {ui('Zeile entfernen')}
            </Button>
          </article>
        ))}
        <p className="fine-note">
          {ui(
            'Nur geprüfte Zeilen werden exportiert. Die PDF erhält neue Seitenbilder und den bestätigten Suchtext. Vorhandener Suchtext, Links, Formulare und Anlagen werden nicht übernommen.',
          )}
        </p>
        <Button
          disabled={busy || !lines.some((l) => l.checked && l.text.trim())}
          onClick={() =>
            run(async () => ({
              blob: new Blob(
                [
                  lines
                    .filter((l) => l.checked)
                    .map((l) => `${ui('Seite')} ${l.page + 1}: ${l.text}`)
                    .join('\n'),
                ],
                { type: 'text/plain;charset=utf-8' },
              ),
              filename: 'Handschrift-geprueft.txt',
              kind: 'data',
              pages: 0,
            }))
          }
        >
          {ui('Geprüften Text exportieren')}
        </Button>
        <Button
          disabled={busy || !lines.some((l) => l.checked && l.text.trim())}
          onClick={() =>
            run((ctx) => {
              const pages = Array.from({ length: source.pdf.numPages }, (_, i) => {
                const words = lines
                  .filter((l) => l.checked && l.page === i && l.text.trim())
                  .map((l, n) => ({ id: String(n), text: l.text, ...l.rect }));
                return groupWords({
                  sourceId: source.id,
                  name: source.name,
                  page: i,
                  mode: 'ocr',
                  words,
                });
              });
              return correctedOcr(source, pages, {}, ctx);
            })
          }
        >
          {ui('PDF mit geprüftem Suchtext erstellen')}
        </Button>
      </section>
      <section className="advanced-card">
        <PageSelect source={source} page={page} onChange={setPage} />
        <PageStage source={source} page={page} rects={[rect]} onRect={setRect} />
      </section>
    </div>
  );
}
export function PdfxPanel({ source, busy, run }: PanelProps) {
  useLanguage();
  const [base, setBase] = useState(integratedDocumentServer || ''),
    [token, setToken] = useState(''),
    [icc, setIcc] = useState<File>(),
    [trim, setTrim] = useState(0),
    [allow, setAllow] = useState(false),
    [reviewed, setReviewed] = useState(false);
  return (
    <section className="advanced-card">
      <h2>{ui('PDF/X-3 für die Druckerei vorbereiten')}</h2>
      <p>
        {ui(
          'PDF/X-3:2002 mit eingebettetem CMYK-Profil und technischen Teilprüfungen. Keine vollständige ISO-Konformitätsprüfung. Die Druckerei muss Profil, Farben und Beschnitt freigeben.',
        )}
      </p>
      <ServerConnection base={base} token={token} setBase={setBase} setToken={setToken} />
      <Field label="ICC-Druckerprofil (optional)">
        <input
          type="file"
          accept=".icc,.icm"
          onChange={(e) => {
            setIcc(e.target.files?.[0]);
            setReviewed(false);
          }}
        />
      </Field>
      <p className="fine-note">
        {ui(
          'Ohne eigenes Profil wird das Artifex-CMYK-Standardprofil verwendet, kein zugesichertes FOGRA-Profil. Ein Profil der Druckerei ist vorzuziehen.',
        )}
      </p>
      <NumberField
        label="Beschnitt innerhalb der Seite (mm)"
        value={trim}
        onChange={(v) => {
          setTrim(v);
          setReviewed(false);
        }}
        min={0}
        max={20}
        step={0.5}
      />
      <Tick
        label="Fehlende Schriften dürfen ersetzt werden."
        value={allow}
        onChange={(v) => {
          setAllow(v);
          setReviewed(false);
        }}
      />
      <p className="fine-note">
        {ui(
          'Farben können sich ändern, Transparenzen können gerastert werden. Fehlender Randinhalt wird nicht ergänzt. Links, Formulare, Anmerkungen und Anlagen entfallen.',
        )}
      </p>
      <Tick
        label="Ich habe Druckprofil und Endformat mit der Druckerei abgestimmt."
        value={reviewed}
        onChange={setReviewed}
      />
      <Button
        disabled={busy || !reviewed || !base || (!integratedDocumentServer && !token)}
        onClick={() =>
          run(async (ctx) => {
            if (icc && icc.size > 4 * 1024 * 1024)
              throw new Error('Das ICC-Profil darf höchstens 4 MB groß sein.');
            const body = new FormData();
            body.append('file', pdfBlob(source.bytes), source.name);
            body.append(
              'options',
              JSON.stringify({ trimInsetMm: trim, allowFontSubstitution: allow }),
            );
            if (icc) body.append('icc', icc, icc.name);
            const result = await runServerJob(base, token, '/v1/print-pdfx', body, ctx.signal);
            return {
              ...result,
              filename: 'PDFX3-mit-technischer-Pruefung.zip',
              kind: 'zip',
              pages: 0,
              note: ui(
                'Druckdatei und unabhängiger technischer Teilprüfbericht sind enthalten. Eine vollständige PDF/X-ISO-Konformität wird nicht bestätigt.',
              ),
            };
          })
        }
      >
        {ui('Druckdatei mit Teilprüfbericht erstellen')}
      </Button>
    </section>
  );
}
