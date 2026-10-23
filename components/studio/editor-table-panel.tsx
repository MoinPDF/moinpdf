'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Source, PageItem } from '@/lib/pdf-engine';
import type { Mark } from '@/lib/studio-engine';
import type { EditorTable, EditorTableOperation } from '@/lib/editor-tables';
import { readEditorTables, changeEditorTable } from '@/lib/editor-table-workspace';
import { Button } from '@/components/ui/button';
import { ui } from '@/lib/ui-language';
export function EditorTablePanel({
  source,
  page,
  marks,
  disabled,
  onReplace,
  onSelect,
  selectedMarkId,
}: {
  source: Source;
  page: PageItem;
  marks: Mark[];
  disabled: boolean;
  onReplace: (remove: string[], add: Mark[]) => void;
  onSelect: (id: string) => void;
  selectedMarkId?: string;
}) {
  const [found, setFound] = useState<EditorTable[]>([]),
    [chosen, setChosen] = useState(''),
    [row, setRow] = useState(1),
    [column, setColumn] = useState(1),
    [columnWidth, setColumnWidth] = useState(72),
    [rowEnd, setRowEnd] = useState(1),
    [columnEnd, setColumnEnd] = useState(2),
    [height, setHeight] = useState(36),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [proposal, setProposal] = useState<{ key: string; remove: string[]; add: Mark[] } | null>(
      null,
    ),
    ctrl = useRef<AbortController | null>(null);
  const key = JSON.stringify([source.id, page, marks]),
    current = useRef(key);
  current.current = key;
  useEffect(() => {
    ctrl.current?.abort();
    setFound([]);
    setChosen('');
    setError('');
    return () => ctrl.current?.abort();
  }, [source, page]);
  useEffect(() => {
    ctrl.current?.abort();
    setProposal(null);
    setBusy(false);
  }, [key]);
  const tables = useMemo(() => {
    const existing = marks.flatMap((m) => (m.nativeTable ? [m.nativeTable] : []));
    return [...existing, ...found.filter((t) => !existing.some((e) => e.id === t.id))];
  }, [marks, found]);
  const table = tables.find((t) => t.id === chosen) || tables[0];
  useEffect(() => {
    if (!table) return;
    setRow(1);
    setColumn(1);
    setRowEnd(1);
    setColumnEnd(Math.min(2, table.columns.length - 1));
    setColumnWidth(table.columns[1] - table.columns[0]);
    setHeight(table.rows[1] - table.rows[0]);
    setProposal(null);
  }, [table]);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ x: number; width: number; scale: number; latest: number } | null>(null);
  const selectedCell = marks.find((m) => m.id === selectedMarkId)?.tableCell;
  useEffect(() => {
    const active = tables.find((t) => t.id === selectedCell?.tableId);
    const cell = active?.cells.find((c) => c.id === selectedCell?.cellId);
    if (active && cell) {
      setChosen(active.id);
      setRow(cell.row + 1);
      setColumn(cell.column + 1);
      setRowEnd(cell.row + cell.rowSpan);
      setColumnEnd(cell.column + cell.columnSpan);
      setColumnWidth(active.columns[cell.column + 1] - active.columns[cell.column]);
    }
  }, [tables, selectedCell?.tableId, selectedCell?.cellId]);
  async function detect() {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setBusy(true);
    setError('');
    try {
      const result = await readEditorTables(source, page, marks, c.signal);
      c.signal.throwIfAborted();
      setFound(result);
      if (!result.length)
        setError(
          'Kein einfaches, sicher bearbeitbares Tabellenraster gefunden. Einzelne Zellentexte bleiben bearbeitbar.',
        );
    } catch (e) {
      if (!c.signal.aborted)
        setError(
          e instanceof Error ? e.message : 'Das Tabellenraster konnte nicht gelesen werden.',
        );
    } finally {
      if (!c.signal.aborted) setBusy(false);
    }
  }
  async function preview(operation: EditorTableOperation) {
    if (!table) return;
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setBusy(true);
    setError('');
    setProposal(null);
    try {
      const result = await changeEditorTable(source, page, marks, table, operation, c.signal);
      c.signal.throwIfAborted();
      if (current.current === key) setProposal({ key, ...result });
    } catch (e) {
      if (!c.signal.aborted)
        setError(
          e instanceof Error && /[äöüÄÖÜß]/.test(e.message)
            ? e.message
            : 'Die Tabellenänderung passt nicht sicher. Bitte Zellengröße, Auswahl, verbundene Zellen und benachbarte Inhalte prüfen.',
        );
    } finally {
      if (!c.signal.aborted) setBusy(false);
    }
  }
  const proposed =
    proposal?.key === key ? proposal.add.find((m) => m.nativeTable)?.nativeTable : undefined;
  return (
    <details data-editor-table className="editor-workflow-section">
      <summary>{ui('Tabelle bearbeiten')}</summary>
      <p>
        {ui(
          'Zeilen und Spalten anpassen, ergänzen oder löschen. Rechteckige Zellen verbinden und teilen. Jede Änderung zuerst prüfen und anschließend übernehmen.',
        )}
      </p>
      <Button variant="outline" disabled={disabled || busy} onClick={() => void detect()}>
        {ui('Tabellenraster prüfen')}
      </Button>
      {table && (
        <>
          <label className="field">
            <span>{ui('Tabelle')}</span>
            <select
              aria-label={ui('Tabelle')}
              value={table.id}
              disabled={disabled || busy}
              onChange={(e) => {
                setChosen(e.target.value);
                setRow(1);
                setColumn(1);
                setRowEnd(1);
                setColumnEnd(2);
                setProposal(null);
              }}
            >
              {tables.map((t, i) => (
                <option key={t.id} value={t.id}>
                  {i + 1} · {t.rows.length - 1} × {t.columns.length - 1}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{ui('Tabellenzeile')}</span>
            <input
              aria-label={ui('Tabellenzeile')}
              type="number"
              min={1}
              max={table.rows.length - 1}
              value={row}
              disabled={disabled || busy}
              onChange={(e) => {
                setRow(Number(e.target.value));
                setProposal(null);
              }}
            />
          </label>
          <label className="field">
            <span>{ui('Zeilenhöhe in Punkt')}</span>
            <input
              aria-label={ui('Zeilenhöhe in Punkt')}
              type="number"
              min={4}
              max={1000}
              value={height}
              disabled={disabled || busy}
              onChange={(e) => {
                setHeight(Number(e.target.value));
                setProposal(null);
              }}
            />
          </label>
          <Button
            variant="outline"
            disabled={disabled || busy}
            onClick={() => void preview({ kind: 'height', row: row - 1, height })}
          >
            {ui('Zeilenhöhe vorschauen')}
          </Button>
          <Button
            variant="outline"
            disabled={disabled || busy}
            onClick={() => void preview({ kind: 'insert', row, height })}
          >
            {ui('Zeile darunter vorschauen')}
          </Button>
          <label className="field">
            <span>{ui('Tabellenspalte')}</span>
            <input
              aria-label={ui('Tabellenspalte')}
              type="number"
              min={1}
              max={table.columns.length - 1}
              value={column}
              disabled={disabled || busy}
              onChange={(e) => {
                const value = Number(e.target.value);
                setColumn(value);
                setProposal(null);
                if (value >= 1 && value < table.columns.length)
                  setColumnWidth(table.columns[value] - table.columns[value - 1]);
              }}
            />
          </label>
          <label className="field">
            <span>{ui('Spaltenbreite in Punkt')}</span>
            <input
              aria-label={ui('Spaltenbreite in Punkt')}
              type="number"
              min={4}
              max={table.pageWidth}
              value={columnWidth}
              disabled={disabled || busy}
              onChange={(e) => {
                setColumnWidth(Number(e.target.value));
                setProposal(null);
              }}
            />
          </label>
          <div className="editor-table-grid-handles" ref={gridRef}>
            <p>{ui('Spaltengrenze ziehen oder mit Pfeiltasten anpassen')}</p>
            <div style={{ display: 'flex', position: 'relative', minHeight: 36 }}>
              {table.columns.slice(0, -1).map((x, i) => (
                <div
                  key={i}
                  style={{
                    position: 'relative',
                    flex: column === i + 1 ? columnWidth : table.columns[i + 1] - x,
                    border: '1px solid currentColor',
                    textAlign: 'center',
                  }}
                >
                  {i + 1}
                  <button
                    type="button"
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={ui('Spaltenbreite anpassen') + ' ' + (i + 1)}
                    aria-valuemin={4}
                    aria-valuemax={table.pageWidth}
                    aria-valuenow={column === i + 1 ? columnWidth : table.columns[i + 1] - x}
                    disabled={disabled || busy}
                    style={{
                      position: 'absolute',
                      right: -8,
                      top: 0,
                      height: 36,
                      width: 16,
                      touchAction: 'none',
                      cursor: 'col-resize',
                      zIndex: 1,
                    }}
                    onPointerDown={(e) => {
                      if (disabled || busy) return;
                      e.preventDefault();
                      e.currentTarget.setPointerCapture(e.pointerId);
                      const width = table.columns[i + 1] - x;
                      setColumn(i + 1);
                      setColumnWidth(width);
                      setProposal(null);
                      drag.current = {
                        x: e.clientX,
                        width,
                        latest: width,
                        scale:
                          (gridRef.current?.getBoundingClientRect().width || 300) /
                          (table.columns.at(-1)! - table.columns[0]),
                      };
                    }}
                    onPointerMove={(e) => {
                      if (!drag.current) return;
                      drag.current.latest = Math.round(
                        Math.max(
                          4,
                          Math.min(
                            table.pageWidth,
                            drag.current.width + (e.clientX - drag.current.x) / drag.current.scale,
                          ),
                        ),
                      );
                      setColumnWidth(drag.current.latest);
                    }}
                    onPointerCancel={() => {
                      drag.current = null;
                    }}
                    onPointerUp={() => {
                      if (!drag.current) return;
                      const width = drag.current.latest;
                      drag.current = null;
                      void preview({ kind: 'width', column: i, width });
                    }}
                    onKeyDown={(e) => {
                      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
                      e.preventDefault();
                      const width = Math.max(
                        4,
                        (column === i + 1 ? columnWidth : table.columns[i + 1] - x) +
                          (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 10 : 1),
                      );
                      setColumn(i + 1);
                      setColumnWidth(width);
                      setProposal(null);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="editor-table-actions">
            <Button
              variant="outline"
              disabled={disabled || busy}
              onClick={() =>
                void preview({ kind: 'width', column: column - 1, width: columnWidth })
              }
            >
              {ui('Spaltenbreite vorschauen')}
            </Button>
            <Button
              variant="outline"
              disabled={disabled || busy}
              onClick={() => void preview({ kind: 'insert-column', column, width: columnWidth })}
            >
              {ui('Spalte rechts einfügen')}
            </Button>
            <Button
              variant="outline"
              disabled={disabled || busy || table.rows.length <= 2}
              onClick={() => void preview({ kind: 'delete-row', row: row - 1 })}
            >
              {ui('Zeile löschen vorschauen')}
            </Button>
            <Button
              variant="outline"
              disabled={disabled || busy || table.columns.length <= 2}
              onClick={() => void preview({ kind: 'delete-column', column: column - 1 })}
            >
              {ui('Spalte löschen vorschauen')}
            </Button>
          </div>
          <label className="field">
            <span>{ui('Verbinden bis Zeile')}</span>
            <input
              aria-label={ui('Verbinden bis Zeile')}
              type="number"
              min={row}
              max={table.rows.length - 1}
              value={rowEnd}
              disabled={disabled || busy}
              onChange={(e) => {
                setRowEnd(Number(e.target.value));
                setProposal(null);
              }}
            />
          </label>
          <label className="field">
            <span>{ui('Verbinden bis Spalte')}</span>
            <input
              aria-label={ui('Verbinden bis Spalte')}
              type="number"
              min={column}
              max={table.columns.length - 1}
              value={columnEnd}
              disabled={disabled || busy}
              onChange={(e) => {
                setColumnEnd(Number(e.target.value));
                setProposal(null);
              }}
            />
          </label>
          <Button
            variant="outline"
            disabled={disabled || busy}
            onClick={() =>
              void preview({
                kind: 'merge',
                row: row - 1,
                column: column - 1,
                rowEnd: rowEnd - 1,
                columnEnd: columnEnd - 1,
              })
            }
          >
            {ui('Zellen verbinden vorschauen')}
          </Button>
          <Button
            variant="outline"
            disabled={disabled || busy}
            onClick={() => {
              const cell = table.cells.find(
                (c) =>
                  c.row <= row - 1 &&
                  c.row + c.rowSpan > row - 1 &&
                  c.column <= column - 1 &&
                  c.column + c.columnSpan > column - 1,
              );
              if (cell) void preview({ kind: 'split', cellId: cell.id });
            }}
          >
            {ui('Zelle teilen vorschauen')}
          </Button>
          <p className="fine-note">
            {ui(
              'Beim Löschen entfallen die Inhalte der entfernten Zellen. Beim Teilen bleibt der Text in der ersten Zelle. Rückgängig stellt die gesamte Änderung wieder her.',
            )}
          </p>
        </>
      )}
      {error && <p role="alert">{ui(error)}</p>}
      {proposed && proposal && (
        <div className="editor-table-proposal">
          <p>
            {ui('Vorschau')}: {proposed.rows.length - 1} {ui('Zeilen')}
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', tableLayout: 'fixed' }}>
              <colgroup>
                {proposed.columns.slice(0, -1).map((x, i) => (
                  <col
                    key={i}
                    style={{
                      width:
                        ((proposed.columns[i + 1] - x) /
                          (proposed.columns.at(-1)! - proposed.columns[0])) *
                          100 +
                        '%',
                    }}
                  />
                ))}
              </colgroup>
              <tbody>
                {proposed.rows.slice(0, -1).map((_, r) => (
                  <tr key={r} style={{ height: proposed.rows[r + 1] - proposed.rows[r] + 'pt' }}>
                    {proposed.cells
                      .filter((c) => c.row === r)
                      .map((c) => (
                        <td
                          key={c.id}
                          rowSpan={c.rowSpan}
                          colSpan={c.columnSpan}
                          style={{
                            border: '1px solid currentColor',
                            padding: 6,
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {proposal.add.find((m) => m.tableCell?.cellId === c.id)?.text || ' '}
                        </td>
                      ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button
            disabled={disabled || busy}
            onClick={() => {
              onReplace(proposal.remove, proposal.add);
              onSelect(proposal.add.find((m) => m.kind === 'text')?.id || '');
              setProposal(null);
            }}
          >
            {ui('Tabellenänderung übernehmen')}
          </Button>
        </div>
      )}
    </details>
  );
}
