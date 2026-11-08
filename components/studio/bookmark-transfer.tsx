'use client';
import { useRef, useState } from 'react';
import type { Bookmark } from '@/lib/document-tools';
import { importBookmarks, exportBookmarks } from '@/lib/bookmark-transfer';
import { downloadBlob } from '@/lib/pdf-engine';
import { ui } from '@/lib/ui-language';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function BookmarkTransfer({
  bookmarks,
  pages,
  locked,
  onApply,
}: {
  bookmarks: Bookmark[];
  pages: number;
  locked: boolean;
  onApply: (bookmarks: Bookmark[]) => void;
}) {
  const [pending, setPending] = useState<Bookmark[] | null>(null);
  const [loading, setLoading] = useState(false);
  const request = useRef(0);
  async function read(file?: File) {
    const id = ++request.current;
    setPending(null);
    if (!file) return;
    setLoading(true);
    try {
      if (file.size > 2_000_000 || !/\.(json|csv)$/i.test(file.name))
        throw new Error('Bitte eine CSV- oder JSON-Datei mit höchstens 2 MB auswählen.');
      const items = importBookmarks(
        await file.text(),
        /\.json$/i.test(file.name) ? 'json' : 'csv',
        pages,
      );
      if (id === request.current) setPending(items);
    } catch (e) {
      if (id === request.current)
        toast.error(ui(e instanceof Error ? e.message : 'Import fehlgeschlagen.'));
    } finally {
      if (id === request.current) setLoading(false);
    }
  }
  function save(format: 'csv' | 'json') {
    try {
      downloadBlob(
        new Blob([exportBookmarks(bookmarks, format)], {
          type: format === 'json' ? 'application/json' : 'text/csv;charset=utf-8',
        }),
        `Lesezeichen.${format}`,
      );
    } catch (e) {
      toast.error(ui(e instanceof Error ? e.message : 'Export fehlgeschlagen.'));
    }
  }
  return (
    <details className="bookmark-transfer">
      <summary>{ui('Lesezeichen importieren / exportieren')}</summary>
      <p className="fine-note">
        {ui(
          'CSV: title, page, level. Seiten und Ebenen beginnen bei 1. Importierte Ziele zeigen auf die ganze Seite; vorhandene Lesezeichen bleiben bis zur Übernahme erhalten.',
        )}
      </p>
      <label className="field">
        <span>{ui('Lesezeichendatei')}</span>
        <input
          type="file"
          accept=".csv,.json"
          disabled={locked || loading}
          onChange={(e) => {
            void read(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </label>
      {pending && (
        <div>
          <p>
            {pending.length} {ui('Lesezeichen vorbereitet')}
          </p>
          <ol className="bookmark-import-preview">
            {pending.slice(0, 20).map((b) => (
              <li key={b.id} style={{ marginLeft: Math.min(b.depth, 5) * 8 }}>
                {b.title} · {ui('Seite')} {b.page! + 1}
              </li>
            ))}
          </ol>
          {pending.length > 20 && (
            <p className="fine-note">{ui('Vorschau zeigt die ersten 20 Einträge.')}</p>
          )}
          <div className="bookmark-transfer-actions">
            <Button
              disabled={locked || bookmarks.length + pending.length > 1000}
              onClick={() => {
                onApply([...bookmarks, ...pending]);
                setPending(null);
              }}
            >
              {ui('Lesezeichen ergänzen')}
            </Button>
            <Button
              variant="outline"
              disabled={locked}
              onClick={() => {
                onApply(pending);
                setPending(null);
              }}
            >
              {ui('Vorhandene Lesezeichen ersetzen')}
            </Button>
            <Button variant="ghost" disabled={locked} onClick={() => setPending(null)}>
              {ui('Abbrechen')}
            </Button>
          </div>
        </div>
      )}
      <div className="bookmark-transfer-actions">
        <Button
          variant="outline"
          disabled={locked || !bookmarks.length}
          onClick={() => save('csv')}
        >
          {ui('CSV herunterladen')}
        </Button>
        <Button
          variant="outline"
          disabled={locked || !bookmarks.length}
          onClick={() => save('json')}
        >
          {ui('JSON herunterladen')}
        </Button>
      </div>
    </details>
  );
}
