'use client';
import { useMemo, useState } from 'react';
import {
  Search,
  ScanText,
  Copy,
  File,
  Maximize,
  Check,
  LoaderCircle,
  FileSearch,
  Layers,
  Eye,
  SquareCheck,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  duplicateGroups,
  findPages,
  excerpt,
  searchTerms,
  type PageIndex,
} from '@/lib/document-check';
import type { PageItem } from '@/lib/pdf-engine';
import type { DocumentIndex } from './use-document-index';
type Filter = 'all' | 'scan' | 'blank' | 'duplicates' | 'formats';
export function DocumentCheck({
  index,
  pages,
  locked,
  editedPageIds,
  language,
  onOpen,
  onSelect,
  onCollect,
  onTool,
}: {
  index: DocumentIndex;
  pages: PageItem[];
  locked: boolean;
  editedPageIds: string[];
  language: string;
  onOpen: (id: string) => void;
  onSelect: (ids: string[], exclude?: boolean) => void;
  onCollect: (ids: string[]) => void;
  onTool: (tool: 'ocr' | 'resize') => void;
}) {
  const [query, setQuery] = useState(''),
    [filter, setFilter] = useState<Filter>('all'),
    [limit, setLimit] = useState(30);
  const { rows, checking, ocrBusy } = index,
    selected = new Set(pages.filter((p) => p.selected).map((p) => p.id)),
    edited = new Set(editedPageIds);
  const duplicates = useMemo(
    () => duplicateGroups(rows.filter((r) => !editedPageIds.includes(r.pageId))),
    [rows, editedPageIds.join('|')],
  );
  const duplicateIds = new Set(duplicates.flatMap((g) => g.map((p) => p.pageId))),
    blanks = rows.filter((r) => r.blank && !edited.has(r.pageId)),
    scans = rows.filter((r) => r.needsOcr),
    pending = scans.filter((r) => !r.ocrDone && !r.error);
  const formats = [...new Set(rows.filter((r) => !r.error).map((r) => r.format))],
    matches = findPages(rows, query),
    isSearch = searchTerms(query).length > 0;
  const shown = isSearch
    ? matches
    : filter === 'scan'
      ? scans
      : filter === 'blank'
        ? blanks
        : filter === 'duplicates'
          ? rows.filter((r) => duplicateIds.has(r.pageId))
          : rows;
  const extras = duplicates
      .flatMap((group) => group.filter((p) => selected.has(p.pageId)).slice(1))
      .map((p) => p.pageId),
    errors = rows.filter((r) => r.error);
  function changeFilter(next: Filter) {
    setFilter(next);
    setQuery('');
    setLimit(30);
  }
  const filters = [
    { id: 'all', label: 'Alle Seiten', value: pages.length, icon: Layers },
    { id: 'scan', label: 'Scan-Seiten', value: scans.length, icon: ScanText },
    { id: 'blank', label: 'Möglicherweise leer', value: blanks.length, icon: File },
    {
      id: 'duplicates',
      label: 'Optisch gleiche Seiten',
      value: duplicates.reduce((n, g) => n + g.length - 1, 0),
      icon: Copy,
    },
    { id: 'formats', label: 'Seitenformate', value: formats.length, icon: Maximize },
  ] as const;
  return (
    <div className="document-check">
      <div className="check-status" role="status">
        {checking ? (
          <>
            <LoaderCircle className="spin" size={16} />
            {rows.length} von {pages.length} Seiten geprüft
          </>
        ) : (
          <>
            <Check size={16} />
            {rows.length - errors.length} von {pages.length} Seiten geprüft
          </>
        )}
        <span>
          <ShieldCheck size={14} />
          Auf deinem Gerät
        </span>
      </div>
      <section className="page-finder">
        <div className="finder-heading">
          <FileSearch size={26} strokeWidth={1.4} />
          <div>
            <h2>Fundstellen sammeln</h2>
            <p>Alle geöffneten PDFs durchsuchen. Passende Seiten als ein Dokument speichern.</p>
          </div>
        </div>
        <div className="finder-search">
          <Search size={19} />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(30);
            }}
            placeholder="Wonach suchst du?"
            aria-label="Alle Dokumente durchsuchen"
          />
          <span>{isSearch ? `${matches.length} Trefferseiten` : ''}</span>
        </div>
        <p className="finder-example">
          Zum Beispiel „Rechnung“ oder „Fahrtkosten, Bewirtung“. Ein passender Begriff genügt.
        </p>
        {pending.length > 0 && !ocrBusy && (
          <div className="scan-search-notice">
            <span>
              <ScanText size={17} />
              {pending.length} {pending.length === 1 ? 'Seite braucht' : 'Seiten brauchen'} noch
              Texterkennung für die Suche.
            </span>
            <Button
              variant="outline"
              disabled={locked || checking}
              onClick={() => void index.recognize(language)}
            >
              Scans für die Suche erkennen
            </Button>
          </div>
        )}
        {ocrBusy && (
          <div className="index-progress" aria-live="polite">
            <div>
              <span>
                <LoaderCircle size={16} className="spin" />
                {index.progress.label}
              </span>
              <Button variant="ghost" onClick={index.cancel}>
                Abbrechen
              </Button>
            </div>
            <Progress value={index.progress.percent} aria-label="Texterkennung für die Suche" />
          </div>
        )}
        {index.error && (
          <p className="check-error" role="alert">
            {index.error}
          </p>
        )}
        {editedPageIds.length > 0 && (
          <p className="check-caveat">
            Suche und Check beziehen sich auf die importierten Seiten. Für eine Prüfung deiner
            Änderungen das Ergebnis anwenden und weiterbearbeiten.
          </p>
        )}
      </section>
      <div className="check-filters" aria-label="Dokumentencheck filtern">
        {filters.map((f) => (
          <button
            key={f.id}
            aria-pressed={!isSearch && filter === f.id}
            onClick={() => changeFilter(f.id)}
          >
            <f.icon size={17} />
            <strong>{f.value}</strong>
            <span>{f.label}</span>
          </button>
        ))}
      </div>
      <div className="check-results-heading">
        <h3>
          {isSearch
            ? `${matches.length} ${matches.length === 1 ? 'passende Seite' : 'passende Seiten'}`
            : filters.find((f) => f.id === filter)?.label}
        </h3>
        {isSearch && matches.length > 0 && (
          <Button
            variant="ghost"
            disabled={locked}
            onClick={() => onSelect(matches.map((r) => r.pageId))}
          >
            <SquareCheck size={16} />
            Treffer auswählen
          </Button>
        )}
      </div>
      {query.trim() && !isSearch && (
        <p className="check-caveat">Bitte mindestens zwei Zeichen pro Suchbegriff eingeben.</p>
      )}
      {!isSearch && filter === 'blank' && (
        <div className="check-advice">
          <p>
            Vermutlich leere Seiten anhand von Text und Seitenbild. Bitte vor dem Abwählen ansehen.
            Es wird nichts gelöscht.
          </p>
          <Button
            variant="outline"
            disabled={locked || !blanks.some((r) => selected.has(r.pageId))}
            onClick={() =>
              onSelect(
                blanks.map((r) => r.pageId),
                true,
              )
            }
          >
            Leere Seiten abwählen
          </Button>
        </div>
      )}
      {!isSearch && filter === 'duplicates' && (
        <div className="check-advice">
          <p>
            Gleiche Vorschau und gleiche Seitengröße. Kleine Unterschiede können in der Vorschau
            fehlen. Je Gruppe bleibt die erste ausgewählte Seite erhalten.
          </p>
          <Button
            variant="outline"
            disabled={locked || !extras.length}
            onClick={() => onSelect(extras, true)}
          >
            Doppelte abwählen
          </Button>
        </div>
      )}
      {!isSearch && filter === 'scan' && (
        <div className="check-advice">
          <p>
            Seiten mit wenig oder ohne kopierbaren Text. OCR kann sie für die Suche erschließen oder
            über „OCR & Text“ als durchsuchbare PDF speichern.
          </p>
          <Button
            variant="outline"
            disabled={locked || !scans.length}
            onClick={() => onTool('ocr')}
          >
            OCR-Werkzeug öffnen
          </Button>
        </div>
      )}
      {!isSearch && filter === 'formats' && (
        <div className="check-advice">
          <p>
            {formats.join(' · ') || 'Seiten werden geprüft.'}
            {formats.length > 1
              ? ' — Für ein einheitliches Dokument kannst du die Seiten auf ein gemeinsames Papierformat bringen.'
              : ''}
          </p>
          <Button
            variant="outline"
            disabled={locked || !rows.length}
            onClick={() => onTool('resize')}
          >
            Seitenformat vereinheitlichen
          </Button>
        </div>
      )}
      {errors.length > 0 && (
        <p className="check-caveat">
          {errors.length} {errors.length === 1 ? 'Seite konnte' : 'Seiten konnten'} nicht geprüft
          werden und sind möglicherweise nicht in den Suchtreffern enthalten.
        </p>
      )}
      {!shown.length && !checking ? (
        <div className="check-empty">
          <FileSearch size={34} strokeWidth={1.25} />
          <p>
            {isSearch
              ? 'Keine passenden Textstellen gefunden.'
              : filter === 'blank'
                ? 'Keine möglicherweise leeren Seiten gefunden.'
                : filter === 'duplicates'
                  ? 'Keine optisch gleichen Seiten gefunden.'
                  : 'Keine passenden Seiten.'}
          </p>
          {isSearch && pending.length > 0 && (
            <span>Erkenne die Scan-Seiten, um sie in die Suche einzubeziehen.</span>
          )}
        </div>
      ) : (
        <div className="check-page-list">
          {shown.slice(0, limit).map((row) => (
            <article
              className={`check-page-row ${selected.has(row.pageId) ? '' : 'excluded'}`}
              key={row.pageId}
            >
              <button
                className="check-thumbnail"
                disabled={locked}
                onClick={() => onOpen(row.pageId)}
                aria-label={`Arbeitsseite ${row.position + 1} ansehen`}
              >
                {row.preview ? <img src={row.preview} alt="" loading="lazy" /> : <File size={23} />}
              </button>
              <div className="check-page-info">
                <div>
                  <strong>Seite {row.position + 1}</strong>
                  <span>{row.format}</span>
                </div>
                <p className="check-source" title={row.name}>
                  {row.name} · Originalseite {row.originalIndex + 1}
                </p>
                {isSearch ? (
                  <p className="match-excerpt">{excerpt(row.text, query)}</p>
                ) : (
                  <p className="page-index-label">
                    {row.error ||
                      (edited.has(row.pageId)
                        ? 'Visuelle Änderungen vorgemerkt'
                        : row.blank
                          ? 'Möglicherweise leer'
                          : row.ocrDone
                            ? row.text.trim()
                              ? 'Scan für die Suche erkannt'
                              : 'OCR abgeschlossen, kein Text erkannt'
                            : row.needsOcr
                              ? 'Scan · Texterkennung möglich'
                              : 'Text direkt durchsuchbar')}
                    {!selected.has(row.pageId) && ' · Nicht ausgewählt'}
                  </p>
                )}
                {duplicateIds.has(row.pageId) && !isSearch && (
                  <small className="duplicate-note">
                    Gleiche Vorschau:{' '}
                    {duplicates
                      .find((g) => g.some((p) => p.pageId === row.pageId))
                      ?.filter((p) => p.pageId !== row.pageId)
                      .map((p) => `Seite ${p.position + 1}`)
                      .join(', ')}
                  </small>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpen(row.pageId)}
                disabled={locked}
                aria-label={`Arbeitsseite ${row.position + 1} öffnen`}
              >
                <Eye size={18} />
              </Button>
            </article>
          ))}
        </div>
      )}
      {shown.length > limit && (
        <Button
          className="show-more-pages"
          variant="outline"
          onClick={() => setLimit((v) => v + 30)}
        >
          Weitere Seiten anzeigen ({shown.length - limit})
        </Button>
      )}
      {isSearch && (
        <div className="collect-actions">
          <span>
            {matches.length} Trefferseiten aus {new Set(matches.map((r) => r.sourceId)).size}{' '}
            Dateien{pending.length > 0 ? ' · Suche noch unvollständig' : ''}
          </span>
          <Button
            disabled={locked || checking || !matches.length}
            onClick={() => onCollect(matches.map((r) => r.pageId))}
          >
            <Layers size={17} />
            Treffer-PDF erstellen
          </Button>
        </div>
      )}
    </div>
  );
}
