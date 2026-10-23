'use client';
import { useState } from 'react';
import { ui } from '@/lib/ui-language';
import { useLanguage } from '@/components/studio/appearance';

import {
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Copy,
  Undo2,
  ImagePlus,
  Plus,
  MousePointer2,
  ScanLine,
  Eraser,
  Settings2,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { Mark } from '@/lib/studio-engine';
import { fitRect, type EditorAction } from '@/lib/editor-model';
import type { Source } from '@/lib/pdf-engine';
import type { RecoveryStatus } from '@/lib/recovery-writer';
import { EditorFontPicker, EditorFontStatus, type EditorPatch } from './editor-typography';

type ToolbarProps = {
  tool: string;
  action: EditorAction;
  disabled: boolean;
  onAction: (value: EditorAction) => void;
  onNewText: () => void;
  onImage: () => void;
  onErase: () => void;
  onSearch?: () => void;
  recoveryStatus?: RecoveryStatus;
};
export function EditorToolbar({
  tool,
  action,
  disabled,
  onAction,
  onNewText,
  onImage,
  onErase,
  onSearch,
  recoveryStatus,
}: ToolbarProps) {
  useLanguage();
  return (
    <div className="editor-toolbar" role="toolbar" aria-label={ui('Bearbeitungswerkzeuge')}>
      {tool === 'edit-text' && (
        <>
          <Button
            variant={action === 'pick' ? 'secondary' : 'ghost'}
            aria-pressed={action === 'pick'}
            disabled={disabled}
            onClick={() => onAction('pick')}
          >
            <MousePointer2 size={16} />
            {ui('Text auswählen')}
          </Button>
          <Button
            variant={action === 'replace-area' ? 'secondary' : 'ghost'}
            aria-pressed={action === 'replace-area'}
            disabled={disabled}
            onClick={() => onAction('replace-area')}
          >
            <ScanLine size={16} />
            {ui('Bereich ersetzen')}
          </Button>
          <Button variant="ghost" disabled={disabled} onClick={onNewText}>
            <Plus size={16} />
            {ui('Neuer Text')}
          </Button>
          {onSearch && (
            <Button variant="ghost" disabled={disabled} onClick={onSearch}>
              <Search size={16} />
              {ui('Dokument durchsuchen')}
            </Button>
          )}
        </>
      )}
      {tool === 'erase' && (
        <>
          <Button
            variant={action === 'erase' ? 'secondary' : 'ghost'}
            aria-pressed={action === 'erase'}
            disabled={disabled}
            onClick={() => onAction('erase')}
          >
            <Eraser size={16} />
            {ui('Bereich markieren')}
          </Button>
          <Button variant="ghost" disabled={disabled} onClick={onErase}>
            <Plus size={16} />
            {ui('Bereich per Eingabe')}
          </Button>
        </>
      )}
      {(tool === 'insert-image' || tool === 'edit-text') && (
        <Button variant="ghost" disabled={disabled} onClick={onImage}>
          <ImagePlus size={16} />
          {ui('Bild auswählen')}
        </Button>
      )}
      <Button
        className="editor-settings-jump"
        variant="outline"
        onClick={() =>
          document
            .getElementById('editor-settings')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      >
        <Settings2 size={16} />
        {ui('Einstellungen')}
      </Button>
      <span>{ui('Direkt schreiben · Verschieben am Griff · Größe am Eckpunkt ändern')}</span>
      {recoveryStatus && recoveryStatus.phase !== 'idle' && (
        <span
          className={`editor-save-status ${recoveryStatus.phase}`}
          role="status"
          aria-live="polite"
        >
          {ui(
            recoveryStatus.phase === 'saved'
              ? 'Arbeitsstand lokal gesichert'
              : recoveryStatus.phase === 'saving'
                ? 'Arbeitsstand wird gesichert …'
                : recoveryStatus.phase === 'error'
                  ? 'Sicherung fehlgeschlagen – Projekt herunterladen'
                  : recoveryStatus.phase === 'restore'
                    ? 'Vorherigen Arbeitsstand wiederherstellen oder verwerfen'
                    : 'Änderungen noch nicht gesichert',
          )}
        </span>
      )}
    </div>
  );
}
export function EditorPanel({
  tool,
  source,
  mark,
  marks,
  width,
  height,
  disabled,
  onPatch,
  onRemove,
  onSelect,
  onDuplicate,
  onNewText,
  onImage,
}: {
  tool: string;
  source?: Source;
  mark?: Mark;
  marks: Mark[];
  width: number;
  height: number;
  disabled: boolean;
  onPatch: EditorPatch;
  onRemove: (id: string) => void;
  onSelect: (id: string) => void;
  onDuplicate: () => void;
  onNewText: () => void;
  onImage: () => void;
}) {
  useLanguage();
  const [unit, setUnit] = useState<'mm' | '%'>('mm');
  const measure = (key: 'x' | 'y' | 'w' | 'h') =>
    unit === '%' ? 100 : ((key === 'x' || key === 'w' ? width : height) * 25.4) / 72;
  const patch = (v: Partial<Mark>) => {
    if (mark) onPatch(mark.id, v);
  };
  function geometry(key: 'x' | 'y' | 'w' | 'h', value: string) {
    if (!mark || value === '') return;
    const n = Number(value) / measure(key);
    if (!Number.isFinite(n)) return;
    const next = { ...mark, [key]: n };
    if (key === 'x') next.x = Math.min(1 - mark.w, n);
    if (key === 'y') next.y = Math.min(1 - mark.h, n);
    if ((mark.kind === 'image' || mark.kind === 'signature') && (key === 'w' || key === 'h')) {
      if (key === 'w') next.h = (n * mark.h) / mark.w;
      else next.w = (n * mark.w) / mark.h;
      const scale = Math.min(1, (1 - next.x) / next.w, (1 - next.y) / next.h);
      next.w *= scale;
      next.h *= scale;
    }
    patch(fitRect(next));
  }
  return (
    <div className="editor-panel" id="editor-settings">
      {!mark && (
        <div className="editor-empty">
          {tool === 'edit-text' ? (
            <>
              <p>
                {ui(
                  'Wähle eine Textstelle auf der Seite oder markiere einen Bereich, den du ersetzen möchtest.',
                )}
              </p>
              <Button variant="outline" disabled={disabled} onClick={onNewText}>
                <Plus size={16} />
                {ui('Neues Textfeld')}
              </Button>
            </>
          ) : tool === 'insert-image' ? (
            <>
              <p>{ui('PNG, JPG oder WebP auswählen oder direkt auf die Seite ziehen.')}</p>
              <Button variant="outline" disabled={disabled} onClick={onImage}>
                <ImagePlus size={16} />
                {ui('Bild auswählen')}
              </Button>
            </>
          ) : (
            <p>
              {ui(
                'Ziehe einen Rahmen um den Inhalt. Die Füllfarbe und die genauen Maße kannst du danach anpassen.',
              )}
            </p>
          )}
        </div>
      )}
      {mark && (
        <>
          <div className="editor-selection-label">
            {mark.nativeTable
              ? ui('Geändertes Tabellenraster')
              : mark.kind === 'text'
                ? mark.sourceRect
                  ? ui('TEXT ERSETZEN')
                  : ui('TEXTFELD')
                : mark.kind === 'erase'
                  ? ui('INHALT ENTFERNEN')
                  : mark.kind === 'image'
                    ? ui('EINGEFÜGTES BILD')
                    : ui('AUSGEWÄHLTE MARKIERUNG')}
          </div>
          {mark.kind === 'text' && (
            <>
              <label className="field">
                <span>{mark.sourceRect ? ui('Ersatztext') : ui('Text')}</span>
                <Textarea
                  aria-label={ui('Textinhalt')}
                  data-editor-history="true"
                  value={mark.text || ''}
                  maxLength={20000}
                  onChange={(e) => onPatch(mark.id, { text: e.target.value }, 'typing')}
                  disabled={disabled}
                  placeholder={
                    mark.sourceRect ? ui('Leer lassen, um den Text zu entfernen') : ui('Dein Text')
                  }
                  className="editor-text-input"
                />
              </label>
              <div className="editor-font-row">
                <label className="field">
                  <span>{ui('Schriftart')}</span>
                  <EditorFontPicker mark={mark} disabled={disabled} onPatch={onPatch} />
                </label>
                <label className="field">
                  <span>{ui('Größe · pt')}</span>
                  <Input
                    aria-label={ui('Textgröße in Punkt')}
                    type="number"
                    min={1}
                    max={288}
                    step={0.1}
                    value={Math.round((mark.fontScale || 0.028) * width * 10) / 10}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (n >= 1 && n <= 288) patch({ fontScale: n / width });
                    }}
                    disabled={disabled}
                  />
                </label>
              </div>
              <EditorFontStatus mark={mark} source={source} />
              <label className="field">
                <span>{ui('Zeilenabstand')}</span>
                <Input
                  type="number"
                  aria-label={ui('Zeilenabstand')}
                  min={1}
                  max={3}
                  step={0.05}
                  value={mark.lineHeight || 1.25}
                  disabled={disabled}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    if (value >= 1 && value <= 3) patch({ lineHeight: value });
                  }}
                />
              </label>
              <div className="editor-format-bar">
                <Button
                  variant={mark.bold ? 'secondary' : 'ghost'}
                  size="icon"
                  aria-label={ui('Fett')}
                  aria-pressed={!!mark.bold}
                  disabled={disabled}
                  onClick={() => patch({ bold: !mark.bold })}
                >
                  <Bold size={17} />
                </Button>
                <Button
                  variant={mark.italic ? 'secondary' : 'ghost'}
                  size="icon"
                  aria-label={ui('Kursiv')}
                  aria-pressed={!!mark.italic}
                  disabled={disabled}
                  onClick={() => patch({ italic: !mark.italic })}
                >
                  <Italic size={17} />
                </Button>
                <span />
                {(
                  [
                    ['left', AlignLeft, 'Linksbündig'],
                    ['center', AlignCenter, 'Zentriert'],
                    ['right', AlignRight, 'Rechtsbündig'],
                  ] as const
                ).map(([value, Icon, label]) => (
                  <Button
                    key={value}
                    variant={(mark.align || 'left') === value ? 'secondary' : 'ghost'}
                    size="icon"
                    aria-label={ui(label)}
                    aria-pressed={(mark.align || 'left') === value}
                    disabled={disabled}
                    onClick={() => patch({ align: value })}
                  >
                    <Icon size={17} />
                  </Button>
                ))}
              </div>
              <label className="editor-color">
                <span>{ui('Textfarbe')}</span>
                <Input
                  aria-label={ui('Textfarbe')}
                  type="color"
                  value={mark.color || '#222222'}
                  onInput={(e) => patch({ color: e.currentTarget.value })}
                  onChange={(e) => patch({ color: e.target.value })}
                  disabled={disabled}
                />
              </label>
            </>
          )}
          {(mark.kind === 'erase' || (mark.sourceRect && mark.sourceIsScan !== false)) && (
            <>
              {mark.kind === 'text' && (
                <label className="field">
                  <span>{ui('Scan-Hintergrund')}</span>
                  <select
                    aria-label={ui('Scan-Hintergrund')}
                    value={mark.scanBackground || 'preserve'}
                    disabled={disabled}
                    onChange={(e) =>
                      patch({ scanBackground: e.target.value as 'preserve' | 'solid' })
                    }
                  >
                    <option value="preserve">
                      {ui('Papier und durchgehende Linien erhalten')}
                    </option>
                    <option value="solid">{ui('Mit Füllfarbe ersetzen')}</option>
                  </select>
                </label>
              )}
              <label className="editor-color">
                <span>{ui('Füllfarbe des entfernten Bereichs')}</span>
                <Input
                  aria-label={ui('Füllfarbe')}
                  type="color"
                  value={mark.fill || '#ffffff'}
                  onInput={(e) => patch({ fill: e.currentTarget.value, scanBackground: 'solid' })}
                  onChange={(e) => patch({ fill: e.target.value, scanBackground: 'solid' })}
                  disabled={disabled}
                />
              </label>
            </>
          )}
          {!mark.nativeImage &&
            !mark.nativeTable &&
            (mark.kind === 'image' || mark.kind === 'signature') && (
              <label className="field">
                <span>
                  {ui('Deckkraft · ')}
                  {Math.round((mark.opacity ?? 1) * 100)} %
                </span>
                <Input
                  aria-label={ui('Bilddeckkraft')}
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={(mark.opacity ?? 1) * 100}
                  onChange={(e) => patch({ opacity: Number(e.target.value) / 100 })}
                  disabled={disabled}
                />
              </label>
            )}
          <label className="field">
            <span>{ui('Maßeinheit')}</span>
            <select
              aria-label={ui('Maßeinheit')}
              value={unit}
              onChange={(e) => setUnit(e.target.value as 'mm' | '%')}
            >
              <option value="mm">mm</option>
              <option value="%">%</option>
            </select>
          </label>
          <div className="editor-geometry">
            {(['x', 'y', 'w', 'h'] as const).map((key) => (
              <label className="field" key={key}>
                <span>
                  {ui({ x: 'Links', y: 'Oben', w: 'Breite', h: 'Höhe' }[key])} · {unit}
                </span>
                <Input
                  aria-label={ui(
                    { x: 'Objekt links', y: 'Objekt oben', w: 'Objektbreite', h: 'Objekthöhe' }[
                      key
                    ],
                  )}
                  type="number"
                  min={key === 'x' || key === 'y' ? 0 : 0.1}
                  max={Math.round(measure(key) * 100) / 100}
                  step={0.1}
                  value={Math.round(mark[key] * measure(key) * 100) / 100}
                  onChange={(e) => geometry(key, e.target.value)}
                  disabled={disabled || !!mark.tableCell || !!mark.nativeTable}
                />
              </label>
            ))}
          </div>
          {mark.sourceRect && (
            <p className="fine-note">
              {ui(
                'Der ursprüngliche Bereich bleibt an seiner Stelle entfernt, auch wenn du das Textfeld verschiebst.',
              )}
            </p>
          )}
          <div className="editor-object-actions">
            {mark.kind === 'text' && mark.sourceRect && (
              <Button
                variant="outline"
                disabled={disabled || !mark.text}
                onClick={() => patch({ text: '' })}
              >
                {ui('Nur Text entfernen')}
              </Button>
            )}
            {mark.kind !== 'erase' && !mark.nativeImage && !mark.tableCell && !mark.nativeTable && (
              <Button variant="outline" disabled={disabled} onClick={onDuplicate}>
                <Copy size={15} />
                {ui('Duplizieren')}
              </Button>
            )}
            <Button variant="ghost" disabled={disabled} onClick={() => onRemove(mark.id)}>
              <Undo2 size={15} />
              {mark.nativeTable || mark.tableCell
                ? ui('Tabellenänderung verwerfen')
                : mark.sourceRect || mark.nativeImage || mark.kind === 'erase'
                  ? ui('Änderung verwerfen')
                  : ui('Objekt entfernen')}
            </Button>
          </div>
        </>
      )}
      {marks.length > 0 && (
        <div className="editor-object-list">
          <span>{ui('OBJEKTE AUF DIESER SEITE')}</span>
          {marks.map((m, i) => (
            <button
              key={m.id}
              className={mark?.id === m.id ? 'selected' : ''}
              disabled={disabled}
              onClick={() => onSelect(m.id)}
            >
              {String(i + 1).padStart(2, '0')} ·{' '}
              {m.nativeTable
                ? ui('Geändertes Tabellenraster')
                : m.kind === 'text'
                  ? m.text?.slice(0, 38) ||
                    ui(m.tableCell ? 'Leere Tabellenzelle' : 'Text entfernt')
                  : ui(
                      {
                        erase: 'Entfernter Bereich',
                        image: 'Bild',
                        signature: 'Unterschrift',
                        redact: 'Schwärzung',
                        highlight: 'Markierung',
                      }[m.kind],
                    )}
            </button>
          ))}
        </div>
      )}
      {(tool === 'edit-text' || tool === 'erase') && (
        <div className="notice editor-export-note">
          {ui(
            tool === 'edit-text'
              ? 'Scans werden lokal erkannt. Originaltext wird beim Export tatsächlich entfernt. Wenn die direkte Bearbeitung nicht sicher möglich ist, wird der Export angehalten. Scan-Seiten werden aus bearbeiteten Bilddaten neu aufgebaut. OCR, Ersatzschriften und Hintergründe bitte prüfen.'
              : 'Entfernte Inhalte werden aus neuen Seitenbildern gelöscht. Auf betroffenen Seiten entfallen ursprünglicher kopierbarer Text, Links und Formularfelder. Neuer Text bleibt kopierbar, sofern du die Seite nicht zusätzlich schwärzt, zuschneidest oder als Bild exportierst. Ersatzschriften und farbige Hintergründe bitte in der Vorschau prüfen.',
          )}
        </div>
      )}
      {tool === 'insert-image' && (
        <p className="fine-note">
          {ui(
            'Bis 8 MB pro Bild. Bilder lassen sich verschieben und proportional skalieren. Der vorhandene PDF-Text bleibt erhalten.',
          )}
        </p>
      )}
    </div>
  );
}
