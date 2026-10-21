'use client';
import { useEffect, useRef, useState } from 'react';
import type { Source, PageItem } from '@/lib/pdf-engine';
import type { Mark } from '@/lib/studio-engine';
import type { EditorTable } from '@/lib/editor-tables';
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
}: {
  source: Source;
  page: PageItem;
  marks: Mark[];
  disabled: boolean;
  onReplace: (remove: string[], add: Mark[]) => void;
  onSelect: (id: string) => void;
}) {
  const [found, setFound] = useState<EditorTable[]>([]),
    [chosen, setChosen] = useState(''),
    [row, setRow] = useState(1),
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
  const existing = marks.flatMap((m) => (m.nativeTable ? [m.nativeTable] : [])),
    tables = [...existing, ...found.filter((t) => !existing.some((e) => e.id === t.id))],
    table = tables.find((t) => t.id === chosen) || tables[0];
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
  async function preview(kind: 'height' | 'insert') {
    if (!table) return;
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setBusy(true);
    setError('');
    setProposal(null);
    try {
      const result = await changeEditorTable(
        source,
        page,
        marks,
        table,
        { kind, row: kind === 'insert' ? row : row - 1, height },
        c.signal,
      );
      c.signal.throwIfAborted();
      if (current.current === key) setProposal({ key, ...result });
    } catch (e) {
      if (!c.signal.aborted)
        setError(
          e instanceof Error && /[äöüÄÖÜß]/.test(e.message)
            ? e.message
            : 'Die Tabellenänderung passt nicht sicher. Bitte Zeilenhöhe, verbundene Zellen und benachbarte Inhalte prüfen.',
        );
    } finally {
      if (!c.signal.aborted) setBusy(false);
    }
  }
  const proposed =
    proposal?.key === key ? proposal.add.find((m) => m.nativeTable)?.nativeTable : undefined;
  return (
    <details className="editor-workflow-section">
      <summary>{ui('Tabellenzeilen anpassen')}</summary>
      <p>
        {ui(
          'Einfache Tabellen mit geraden Linien: Zeilenhöhe ändern oder eine leere Zeile einfügen. Verbundene Zellen und mehrzeiliger Text bleiben erhalten.',
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
            onClick={() => void preview('height')}
          >
            {ui('Zeilenhöhe vorschauen')}
          </Button>
          <Button
            variant="outline"
            disabled={disabled || busy}
            onClick={() => void preview('insert')}
          >
            {ui('Zeile darunter vorschauen')}
          </Button>
        </>
      )}
      {error && <p role="alert">{ui(error)}</p>}
      {proposed && proposal && (
        <div className="editor-table-proposal">
          <p>
            {ui('Vorschau')}: {proposed.rows.length - 1} {ui('Zeilen')}
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <tbody>
                {proposed.rows.slice(0, -1).map((_, r) => (
                  <tr key={r}>
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
