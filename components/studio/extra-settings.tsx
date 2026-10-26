'use client';
import { ui } from '@/lib/ui-language';
import { useLanguage } from '@/components/studio/appearance';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { resolvePair, rasterTools, duplexOrder, type ExtraTool } from '@/lib/extra-options';
import type { StudioOptions } from '@/lib/studio-engine';
import type { PageItem, Source } from '@/lib/pdf-engine';

export function ExtraSettings({
  tool,
  sources,
  selectedCount,
  selectedPages,
  options,
  locked,
  onChange,
}: {
  tool: ExtraTool;
  sources: Source[];
  selectedCount: number;
  selectedPages: PageItem[];
  options: StudioOptions;
  locked: boolean;
  onChange: (patch: Partial<StudioOptions>) => void;
}) {
  useLanguage();
  const choice = (key: keyof StudioOptions, label: string, items: [string, string][]) => (
    <label className="field">
      <span>{ui(label)}</span>
      <Select
        value={String(options[key] ?? (key === 'interleaveMode' ? 'two' : ''))}
        onValueChange={(v) => onChange({ [key]: v })}
        disabled={locked}
      >
        <SelectTrigger aria-label={ui(label)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map(([value, text]) => (
            <SelectItem key={value} value={value}>
              {ui(text)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
  const [first, second] = resolvePair(sources, options),
    single = tool === 'interleave' && options.interleaveMode === 'single',
    paired = ['compare', 'interleave', 'overlay'].includes(tool) && !single;
  let duplex: ReturnType<typeof duplexOrder> | undefined;
  let duplexError = '';
  if (single) {
    try {
      if (new Set(selectedPages.map((p) => p.sourceId)).size > 1)
        throw new Error('Für die Duplex-Sortierung nur Seiten einer Datei auswählen.');
      duplex = duplexOrder(selectedCount, options.duplexSplit, options.reverseSecond);
    } catch (error) {
      duplexError = (error as Error).message;
    }
  }
  const pairSelect = (position: 'firstSource' | 'secondSource', label: string, value: string) => (
    <label className="field">
      <span>{ui(label)}</span>
      <Select
        value={value}
        onValueChange={(v) => onChange({ [position]: v })}
        disabled={locked || sources.length < 2}
      >
        <SelectTrigger aria-label={ui(label)}>
          <SelectValue placeholder={ui('Zweite Datei hinzufügen')} />
        </SelectTrigger>
        <SelectContent>
          {sources
            .filter((s) => position === 'firstSource' || s.id !== first?.id)
            .map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </label>
  );
  return (
    <div className="extra-settings">
      {tool === 'interleave' &&
        choice('interleaveMode', 'Scan-Aufteilung', [
          ['two', 'Vorder- und Rückseiten in zwei Dateien'],
          ['single', 'Vorder- und Rückseiten in einer Datei'],
        ])}
      {single && (
        <>
          <label className="field">
            <span>{ui('Trennstelle nach ausgewählter Seite')}</span>
            <Input
              type="number"
              aria-label={ui('Trennstelle nach ausgewählter Seite')}
              min={1}
              max={Math.max(1, selectedCount - 1)}
              value={options.duplexSplit || Math.ceil(selectedCount / 2)}
              disabled={locked}
              onChange={(e) => onChange({ duplexSplit: Number(e.target.value) })}
            />
          </label>
          <Button variant="outline" disabled={locked} onClick={() => onChange({ duplexSplit: 0 })}>
            {ui('In der Mitte teilen')}
          </Button>
          <p className="fine-note">
            {ui(
              'Zuerst stehen alle Vorderseiten, danach alle Rückseiten. Die Trennstelle zählt die ausgewählten Seiten in ihrer aktuellen Reihenfolge.',
            )}
          </p>
          {duplexError && (
            <p role="alert" className="notice">
              {ui(duplexError)}
            </p>
          )}
          {duplex && (
            <div role="status">
              <strong>{ui('Neue Seitenreihenfolge')}</strong>
              <p style={{ overflowWrap: 'anywhere' }}>
                {duplex.order.map((i) => selectedPages[i]?.index + 1).join(' → ')}
              </p>
              {duplex.unequal && (
                <p className="notice">
                  {ui(
                    'Die Blöcke sind unterschiedlich lang. Übrige Seiten werden am Ende angehängt. Bitte die Zuordnung prüfen.',
                  )}
                </p>
              )}
            </div>
          )}
        </>
      )}
      {paired && (
        <>
          {pairSelect(
            'firstSource',
            tool === 'overlay' ? 'Basisdatei' : 'Datei A',
            first?.id || '',
          )}
          {pairSelect('secondSource', tool === 'overlay' ? 'Vorlage' : 'Datei B', second?.id || '')}
          {sources.length < 2 && (
            <p className="notice">
              {ui('Öffne oben eine zweite Datei, um dieses Werkzeug zu verwenden.')}
            </p>
          )}
          <p className="fine-note">
            {ui(
              'Verarbeitet die ausgewählten Seiten dieser beiden Dateien in ihrer aktuellen Reihenfolge.',
            )}
          </p>
        </>
      )}
      {tool === 'compare' && (
        <>
          {choice('compareMode', 'Vergleichsart', [
            ['pages', 'Seiten an gleicher Position'],
            ['content', 'Inhalte über Seiten hinweg'],
          ])}
          <div className="notice">
            {ui(
              'Vergleicht vorhandenen Text. Bilder, Layout und reine Scanänderungen werden nicht geprüft. Scans zuerst mit „OCR & Text“ auslesen und die Ergebnisse öffnen.',
            )}
          </div>
          {options.compareMode === 'content' && (
            <p className="fine-note">
              {ui(
                'Ordnet Textblöcke unabhängig von ihrer Seitenposition zu. Zeigt verschobene Inhalte und Änderungen auf Wortebene. Mehrfach vorkommende oder unklare Zuordnungen bitte prüfen.',
              )}
            </p>
          )}
        </>
      )}
      {tool === 'interleave' && (
        <>
          <label className="switch-field">
            <span>
              {ui(single ? 'Rückseitenblock rückwärts' : 'Datei B rückwärts')}
              <small>{ui('Für umgekehrt gescannte Rückseiten')}</small>
            </span>
            <Switch
              aria-label={ui(single ? 'Rückseitenblock rückwärts' : 'Datei B rückwärts')}
              checked={options.reverseSecond}
              disabled={locked}
              onCheckedChange={(v) => onChange({ reverseSecond: v })}
            />
          </label>
          <p className="fine-note">
            {ui('Reihenfolge: A1, B1, A2, B2 … Zusätzliche Seiten werden am Ende angehängt.')}
          </p>
        </>
      )}
      {tool === 'split-ranges' && (
        <>
          {choice('splitMode', 'Aufteilung', [
            ['every', 'Nach Seitenanzahl'],
            ['ranges', 'Eigene Seitenbereiche'],
          ])}
          {options.splitMode === 'every' ? (
            <label className="field">
              <span>{ui('Seiten pro Datei')}</span>
              <Input
                aria-label={ui('Seiten pro Datei')}
                type="number"
                min={1}
                max={200}
                value={Number.isNaN(options.splitEvery) ? '' : options.splitEvery}
                onChange={(e) => onChange({ splitEvery: parseInt(e.target.value, 10) })}
                disabled={locked}
              />
            </label>
          ) : (
            <label className="field">
              <span>{ui('Bereiche, mit Semikolon getrennt')}</span>
              <Input
                aria-label={ui('Seitenbereiche')}
                placeholder="1-3; 4-6; 7,9"
                value={options.splitRanges}
                maxLength={1200}
                onChange={(e) => onChange({ splitRanges: e.target.value })}
                disabled={locked}
              />
            </label>
          )}
          <p className="fine-note">
            {ui('Die Nummern beziehen sich auf die ')}
            {selectedCount}{' '}
            {ui(
              ' ausgewählten Seiten. Jeder Abschnitt wird eine eigene PDF im ZIP. Bei eigenen Bereichen werden nur die genannten Seiten exportiert.',
            )}
          </p>
        </>
      )}
      {tool === 'booklet' && (
        <>
          {choice('pageSize', 'Papierformat', [
            ['a4', 'DIN A4'],
            ['letter', 'US Letter'],
          ])}
          <div className="notice">
            {ui(
              'Beidseitig im Querformat drucken, an der kurzen Kante wenden und mittig falten. Fehlende Seiten werden bis zum nächsten Vielfachen von vier als Leerseiten ergänzt.',
            )}
          </div>
        </>
      )}
      {tool === 'split-grid' && (
        <>
          {choice('tileLayout', 'Raster pro Seite', [
            ['2x1', '2 Ausschnitte nebeneinander'],
            ['1x2', '2 Ausschnitte untereinander'],
            ['2x2', '4 Ausschnitte · 2 × 2'],
            ['3x3', '9 Ausschnitte · 3 × 3'],
          ])}
          <p className="fine-note">
            {ui(
              'Ausgabe von links nach rechts, dann von oben nach unten. Maximal 200 Ausgabeseiten. Die Ausschnitte werden visuell beschnitten; zum sicheren Entfernen vertraulicher Inhalte „Schwärzen“ nutzen.',
            )}
          </p>
        </>
      )}
      {tool === 'auto-crop' && (
        <>
          <label className="field">
            <span>
              {ui('Rand behalten ')}
              <b>
                {options.cropPadding} {ui(' mm')}
              </b>
            </span>
            <Slider
              aria-label={ui('Rand in Millimetern')}
              value={[options.cropPadding]}
              min={0}
              max={20}
              step={1}
              onValueChange={(v) => onChange({ cropPadding: v[0] })}
              disabled={locked}
            />
          </label>
          <p className="fine-note">
            {ui(
              'Erkennt nahezu weiße Außenränder. Flecken oder farbige Hintergründe können die Erkennung begrenzen. Vollständig weiße Seiten behalten ihr Format.',
            )}
          </p>
        </>
      )}
      {tool === 'bilevel' && (
        <>
          <label className="field">
            <span>
              {ui('Schwellenwert ')}
              <b>{options.threshold}</b>
            </span>
            <Slider
              aria-label={ui('Schwellenwert')}
              value={[options.threshold]}
              min={40}
              max={240}
              step={1}
              onValueChange={(v) => onChange({ threshold: v[0] })}
              disabled={locked}
            />
          </label>
          <p className="fine-note">
            {ui(
              'Höhere Werte machen mehr Bildbereiche schwarz. Das Ergebnis enthält ausschließlich schwarze und weiße Pixel.',
            )}
          </p>
        </>
      )}
      {rasterTools.includes(tool) && (
        <div className="notice">
          {ui(
            'Erstellt neue Seitenbilder. Kopierbarer Text, Links und interaktive Felder werden nicht übernommen. Bei Bedarf danach OCR anwenden.',
          )}
        </div>
      )}
      {tool === 'stamp' && (
        <>
          <label className="field">
            <span>{ui('Stempeltext')}</span>
            <Input
              aria-label={ui('Stempeltext')}
              value={options.stampText}
              maxLength={60}
              onChange={(e) => onChange({ stampText: e.target.value })}
              disabled={locked}
            />
          </label>
          <div className="stamp-presets">
            {['GEPRÜFT', 'EINGEGANGEN', 'BEZAHLT'].map((text) => (
              <Button
                key={ui(text)}
                variant="outline"
                size="sm"
                disabled={locked}
                onClick={() => onChange({ stampText: text })}
              >
                {ui(text)}
              </Button>
            ))}
          </div>
          <label className="field">
            <span>{ui('Datum · optional')}</span>
            <Input
              aria-label={ui('Stempeldatum')}
              type="date"
              value={options.stampDate}
              onInput={(e) => onChange({ stampDate: e.currentTarget.value })}
              onChange={(e) => onChange({ stampDate: e.target.value })}
              disabled={locked}
            />
          </label>
          {choice('stampPosition', 'Position', [
            ['top-right', 'Oben rechts'],
            ['top-left', 'Oben links'],
            ['bottom-right', 'Unten rechts'],
            ['bottom-left', 'Unten links'],
          ])}
          {choice('stampColor', 'Stempelfarbe', [
            ['teal', 'Türkis'],
            ['green', 'Grün'],
            ['red', 'Rot'],
          ])}
          <p className="fine-note">
            {ui(
              'Der Stempel liegt sichtbar über dem Dokument. Bestehende Texte bleiben kopierbar.',
            )}
          </p>
        </>
      )}
      {tool === 'edit-metadata' && (
        <>
          {(
            [
              ['metaTitle', 'Titel'],
              ['metaAuthor', 'Autor'],
              ['metaSubject', 'Betreff'],
              ['metaKeywords', 'Stichwörter, mit Komma getrennt'],
            ] as const
          ).map(([key, label]) => (
            <label className="field" key={key}>
              <span>{ui(label)}</span>
              <Input
                aria-label={ui(label)}
                value={options[key]}
                maxLength={1000}
                onChange={(e) => onChange({ [key]: e.target.value })}
                disabled={locked}
              />
            </label>
          ))}
          <p className="fine-note">
            {ui(
              'Diese Angaben gelten für die neu erstellte PDF. Leere Felder werden geleert. Die sichtbaren Dokumentinhalte ändern sich dadurch nicht.',
            )}
          </p>
        </>
      )}
      {tool === 'remove-annotations' && (
        <>
          <label className="switch-field">
            <span>{ui('Auch Links entfernen')}</span>
            <Switch
              aria-label={ui('Auch Links entfernen')}
              checked={options.removeLinks}
              disabled={locked}
              onCheckedChange={(v) => onChange({ removeLinks: v })}
            />
          </label>
          <p className="fine-note">
            {ui(
              'Entfernt echte PDF-Anmerkungen, etwa Kommentare oder Hervorhebungen. Bereits fest in den Inhalt eingebrannte Markierungen bleiben erhalten. Ausgefüllte Formularwerte werden als feste Inhalte übernommen.',
            )}
          </p>
        </>
      )}
      {tool === 'overlay' && (
        <>
          {choice('overlayLayer', 'Vorlage platzieren', [
            ['front', 'Vor den Inhalt'],
            ['back', 'Hinter den Inhalt'],
          ])}
          <label className="field">
            <span>
              {ui('Deckkraft der Vorlage ')}
              <b>{options.overlayOpacity} %</b>
            </span>
            <Slider
              aria-label={ui('Deckkraft der Vorlage')}
              value={[options.overlayOpacity]}
              min={5}
              max={100}
              step={5}
              onValueChange={(v) => onChange({ overlayOpacity: v[0] })}
              disabled={locked}
            />
          </label>
          <p className="fine-note">
            {ui(
              'Die erste ausgewählte Vorlagenseite wird proportional auf jede ausgewählte Basisseite gelegt. Ein weißer Seitenhintergrund der Basis kann eine dahinterliegende Vorlage verdecken.',
            )}
          </p>
        </>
      )}
      {tool === 'extract-images' && (
        <div className="notice">
          {ui(
            'Exportiert eingebettete Rasterbilder in ihrer dekodierten Auflösung als PNG. Jedes Bild einmal pro ausgewählter Originalseite. Vektorgrafiken und reine Bildmasken sind keine eigenständigen Fotos. Die Ausgabe bezieht sich auf die Originalinhalte.',
          )}
        </div>
      )}
      {tool === 'attachments' && (
        <div className="notice">
          {ui(
            'Liest eingebettete Dateien aus den Original-PDFs mit ausgewählten Seiten. Dazu können XML-Dateien bei ZUGFeRD-Rechnungen gehören. Keine Prüfung der Rechnungsdaten; Bilder auf der Seite sind keine Dateianhänge.',
          )}
        </div>
      )}
      {tool === 'pdf-info' && (
        <p className="fine-note">
          {ui(
            'Erstellt einen lesbaren Bericht über die gesamten Originaldateien, aus denen Seiten ausgewählt sind. Der Bericht lässt sich als TXT speichern.',
          )}
        </p>
      )}
    </div>
  );
}
