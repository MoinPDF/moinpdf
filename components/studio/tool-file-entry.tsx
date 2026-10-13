'use client';

import { ChevronLeft, FilePlus2, LoaderCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from './appearance';
import type { ToolDefinition } from '@/lib/tool-catalog';
import './conversion-workbench.css';

export function ToolFileEntry({
  tool,
  locked,
  loading,
  dragOver,
  onBack,
  onAdd,
  onDemo,
  onBlank,
}: {
  tool: ToolDefinition;
  locked: boolean;
  loading: boolean;
  dragOver: boolean;
  onBack: () => void;
  onAdd: () => void;
  onDemo: () => void;
  onBlank: () => void;
}) {
  const { t } = useLanguage();
  return (
    <main className="document-workbench advanced-workbench conversion-workbench tool-file-entry">
      <header className="workbench-header">
        <Button variant="ghost" disabled={locked} onClick={onBack}>
          <ChevronLeft size={17} />
          {t('Alle Werkzeuge')}
        </Button>
      </header>
      <div className="workbench-title">
        <div>
          <span className="studio-kicker">{t('DATEI REIN. ERGEBNIS RAUS.')}</span>
          <h1>
            <tool.icon aria-hidden="true" />
            {tool.title}
          </h1>
          <p>{tool.description}</p>
        </div>
      </div>
      <ol className="conversion-steps" aria-label={t('Arbeitsschritte')}>
        <li className="is-current" aria-current="step">
          <span>1</span>
          {t('Datei auswählen')}
        </li>
        <li>
          <span>2</span>
          {t('Verarbeiten')}
        </li>
        <li>
          <span>3</span>
          {t('Herunterladen')}
        </li>
      </ol>
      <section
        className={`advanced-card conversion-card tool-file-card${dragOver ? ' is-drag' : ''}`}
        aria-label={tool.title}
        aria-busy={loading}
      >
        <div className="conversion-fields">
          <Button variant="outline" disabled={locked} onClick={onAdd}>
            {loading ? <LoaderCircle className="spin" size={17} /> : <Plus size={17} />}
            {loading ? t('Wird geöffnet …') : t('Dateien auswählen')}
          </Button>
          <p className="fine-note">
            {t('Dateien hierher ziehen.')}
            <br />
            {t('80 MB / 200 Seiten')}
          </p>
          <Button className="conversion-submit" disabled>
            {tool.action}
          </Button>
          <div className="tool-file-alternatives">
            <button type="button" disabled={locked} onClick={onDemo}>
              {t('Mit Beispieldokument ausprobieren')}
            </button>
            <button type="button" disabled={locked} onClick={onBlank}>
              <FilePlus2 size={16} aria-hidden="true" />
              {t('Leerseite')}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
