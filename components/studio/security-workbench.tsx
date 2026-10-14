'use client';
import { WorkspaceContext } from './workspace-context';
import { JobStatusIcon, useFreshResult } from './ui-feedback';
import { ui } from '@/lib/ui-language';

import { useLanguage } from '@/components/studio/appearance';

import { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ShieldCheck,
  LockKeyhole,
  LockKeyholeOpen,
  Download,
  Check,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PagePreview } from './canvas';
import { protectPdf, type SecuritySettings } from '@/lib/pdf-security';
import { filenameStem, formatSize, pdfBlob, type Source, type JobResult } from '@/lib/pdf-engine';
type Props = {
  tool: 'protect' | 'unlock';
  sources: Source[];
  onBack: () => void;
  onTool: (tool: 'protect' | 'unlock') => void;
  onBusy: (busy: boolean) => void;
  onUse: (result: JobResult) => Promise<void>;
  pending: boolean;
};
export function SecurityWorkbench({
  tool,
  sources,
  onBack,
  onTool,
  onBusy,
  onUse,
  pending,
}: Props) {
  const { t } = useLanguage();
  const [sourceId, setSourceId] = useState(
      sources.find((s) => tool === 'unlock' && s.wasEncrypted)?.id || sources[0].id,
    ),
    [password, setPassword] = useState(''),
    [repeat, setRepeat] = useState(''),
    [show, setShow] = useState(false),
    [owner, setOwner] = useState('');
  const [printing, setPrinting] = useState<SecuritySettings['printing']>('full'),
    [copying, setCopying] = useState(true),
    [editing, setEditing] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [result, setResult] = useState<JobResult | null>(null),
    [url, setUrl] = useState('');
  const resultFresh = useFreshResult(result);
  const controller = useRef<AbortController | null>(null),
    source = sources.find((s) => s.id === sourceId) || sources[0],
    protect = tool === 'protect';
  useEffect(() => {
    window.scrollTo(0, 0);
    return () => controller.current?.abort();
  }, []);
  useEffect(() => {
    onBusy(busy);
    return () => onBusy(false);
  }, [busy, onBusy]);
  useEffect(() => {
    setPassword('');
    setRepeat('');
    setOwner('');
    setError('');
    setResult(null);
  }, [source.id, tool]);
  useEffect(() => {
    if (!result) {
      setUrl('');
      return;
    }
    const u = URL.createObjectURL(result.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [result]);
  const invalidate = () => {
    setResult(null);
    setError('');
  };
  async function save() {
    if (busy) return;
    setError('');
    if (protect && password !== repeat) {
      setError('Die beiden Öffnungspasswörter stimmen nicht überein.');
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setResult(null);
    try {
      const bytes = protect
        ? await protectPdf(
            source.bytes,
            { password, ownerPassword: owner, printing, copying, editing },
            abort.signal,
          )
        : source.bytes.slice();
      if (abort.signal.aborted) return;
      setResult({
        blob: pdfBlob(bytes),
        filename: `${filenameStem(source.name)}-${protect ? 'geschützt' : 'entsperrt'}.pdf`,
        kind: 'pdf',
        pages: source.pdf.numPages,
        inputSize: source.size,
      });
      setPassword('');
      setRepeat('');
      setOwner('');
    } catch (e) {
      if (!abort.signal.aborted) setError((e as Error).message);
    } finally {
      setBusy(false);
      controller.current = null;
    }
  }
  const select = (
    label: string,
    v: string,
    items: [string, string][],
    change: (v: string) => void,
  ) => (
    <label className="field">
      <span>{ui(label)}</span>
      <Select value={v} onValueChange={change} disabled={busy}>
        <SelectTrigger aria-label={ui(label)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map(([id, name]) => (
            <SelectItem key={id} value={id}>
              {ui(name)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
  const passwordField = (label: string, v: string, change: (v: string) => void) => (
    <label className="field">
      <span>{ui(label)}</span>
      <div className="password-input">
        <Input
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          aria-label={ui(label)}
          value={v}
          disabled={busy}
          onChange={(e) => {
            change(e.target.value);
            invalidate();
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`${ui(label)} ${show ? ui('verbergen') : ui('anzeigen')}`}
          onClick={() => setShow(!show)}
        >
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </Button>
      </div>
    </label>
  );
  return (
    <main className="document-workbench security-workbench">
      <WorkspaceContext sources={sources} locked={busy} />
      <header className="workbench-header">
        <Button variant="ghost" onClick={onBack} disabled={busy}>
          <ChevronLeft size={17} />
          {t('Alle Werkzeuge')}
        </Button>
        <span className="device-tag">
          <ShieldCheck size={14} />
          {ui('LOKAL AUF DEINEM GERÄT')}
        </span>
      </header>
      <div className="workbench-title">
        <div>
          <span className="studio-kicker">{ui('DEIN DOKUMENT. DEIN ZUGANG.')}</span>
          <h1>
            {protect ? <LockKeyhole /> : <LockKeyholeOpen />}
            {protect ? ui('PDF schützen') : ui('PDF entsperren')}
          </h1>
        </div>
        <div className="workbench-modes">
          <Button
            variant={protect ? 'default' : 'ghost'}
            disabled={busy}
            onClick={() => onTool('protect')}
          >
            {ui('Schützen')}
          </Button>
          <Button
            variant={!protect ? 'default' : 'ghost'}
            disabled={busy}
            onClick={() => onTool('unlock')}
          >
            {ui('Entsperren')}
          </Button>
        </div>
      </div>
      {pending && (
        <p className="workbench-notice">
          {ui(
            'Hier wird die vollständige geöffnete Datei verarbeitet. Änderungen aus anderen Werkzeugen bitte zuerst anwenden und als Arbeitsdokument übernehmen.',
          )}
        </p>
      )}
      <div className="security-layout">
        <section className="security-preview">
          <div className="security-source">
            {select(
              t('Dokument'),
              source.id,
              sources.map((s) => [s.id, s.name]),
              setSourceId,
            )}
          </div>
          <div className="security-paper">
            <PagePreview
              source={source}
              page={{
                id: 'security-preview',
                sourceId: source.id,
                index: 0,
                rotation: 0,
                selected: true,
              }}
            />
            <span className="security-paper-lock">
              {protect ? <LockKeyhole size={24} /> : <LockKeyholeOpen size={24} />}
            </span>
          </div>
          <div className="security-file-stats">
            <span>
              {source.pdf.numPages} {source.pdf.numPages === 1 ? t('Seite') : t('Seiten')}
            </span>
            <span>{formatSize(source.size)}</span>
            <span>{source.wasEncrypted ? ui('Lokal entsperrt') : ui('Geöffnete PDF')}</span>
          </div>
          <p>{ui('Alle Seiten, Formularfelder, Lesezeichen und Anhänge bleiben erhalten.')}</p>
        </section>
        <section className="security-settings">
          <div className="security-method">
            <span className="security-method-icon">
              {protect ? <LockKeyhole size={21} /> : <LockKeyholeOpen size={21} />}
            </span>
            <div>
              <h2>
                {protect ? ui('Nur mit deinem Passwort.') : ui('Ohne erneute Passwortabfrage.')}
              </h2>
              <p>
                {protect
                  ? ui('AES-256-Verschlüsselung für die gesamte PDF.')
                  : ui('Die beim Öffnen entsperrte Arbeitskopie als neue Datei speichern.')}
              </p>
            </div>
          </div>
          {protect ? (
            <>
              <div className="password-fields">
                {passwordField('Öffnungspasswort', password, setPassword)}
                {passwordField('Passwort wiederholen', repeat, setRepeat)}
                <p className="fine-note">
                  {ui(
                    'Mindestens 8 Zeichen. Bewahre dein Passwort sicher auf – es wird hier nicht gespeichert.',
                  )}
                </p>
              </div>
              <details className="security-permissions">
                <summary>
                  {ui('Berechtigungen anpassen')}
                  <span>{ui('Optional')}</span>
                </summary>
                <div>
                  {select(
                    'Drucken',
                    printing,
                    [
                      ['full', 'In voller Qualität erlaubt'],
                      ['low', 'Nur niedrige Qualität'],
                      ['none', 'Nicht erlaubt'],
                    ],
                    (v) => {
                      setPrinting(v as SecuritySettings['printing']);
                      invalidate();
                    },
                  )}
                  <label className="switch-field">
                    <span>{ui('Text und Bilder kopieren')}</span>
                    <Switch
                      checked={copying}
                      disabled={busy}
                      onCheckedChange={(v) => {
                        setCopying(v);
                        invalidate();
                      }}
                    />
                  </label>
                  <label className="switch-field">
                    <span>{ui('Bearbeiten und Formulare ändern')}</span>
                    <Switch
                      checked={editing}
                      disabled={busy}
                      onCheckedChange={(v) => {
                        setEditing(v);
                        invalidate();
                      }}
                    />
                  </label>
                  {passwordField('Berechtigungspasswort (optional)', owner, setOwner)}
                  <p className="fine-note">
                    {ui(
                      'Leer lassen für ein zufällig erzeugtes Berechtigungspasswort. Druck-, Kopier- und Bearbeitungsregeln sind Hinweise an PDF-Programme; nicht alle Programme beachten sie. Der Öffnungsschutz verschlüsselt die Datei.',
                    )}
                  </p>
                </div>
              </details>
            </>
          ) : (
            <div className="unlock-status">
              <Check size={22} />
              <h3>
                {source.wasEncrypted
                  ? ui('Passwort bereits beim Öffnen geprüft.')
                  : ui('Diese Arbeitsdatei ist bereits ungeschützt.')}
              </h3>
              <p>
                {source.wasEncrypted
                  ? ui('Du kannst sie jetzt ohne Passwort speichern oder direkt weiterbearbeiten.')
                  : ui(
                      'Du kannst eine ungeschützte Kopie speichern. Für eine andere Datei gehe zurück und füge die geschützte PDF hinzu.',
                    )}
              </p>
            </div>
          )}
          {error && (
            <p className="error-box" role="alert">
              {ui(error)}
            </p>
          )}
          {result ? (
            <div className="security-result" role="status">
              <span>
                <JobStatusIcon fresh={resultFresh} size={20} />
                {protect
                  ? ui('Deine geschützte PDF ist bereit.')
                  : ui('Deine entsperrte PDF ist bereit.')}
              </span>
              <p>
                {result.filename} · {formatSize(result.blob.size)}
              </p>
              <Button asChild className="result-download" data-fresh={resultFresh && !!url}>
                <a href={url} download={result.filename}>
                  <Download size={17} />
                  {t('PDF herunterladen')}
                </a>
              </Button>
              {!protect && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await onUse(result);
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {t('Ergebnis weiterbearbeiten')}
                </Button>
              )}
            </div>
          ) : (
            <Button className="security-save" disabled={busy} onClick={() => void save()}>
              {busy ? (
                <>
                  <JobStatusIcon working size={17} />
                  {ui('Wird verarbeitet …')}
                </>
              ) : protect ? (
                <>
                  <LockKeyhole size={17} />
                  {ui('Geschützte PDF erstellen')}
                </>
              ) : (
                <>
                  <LockKeyholeOpen size={17} />
                  {ui('Entsperrte PDF erstellen')}
                </>
              )}
            </Button>
          )}
          {busy && (
            <Button variant="ghost" onClick={() => controller.current?.abort()}>
              {t('Abbrechen')}
            </Button>
          )}
          <p className="security-footer-note">
            {ui(
              'Die Verarbeitung bleibt auf deinem Gerät. Deine Originaldatei wird nicht überschrieben.',
            )}
          </p>
        </section>
      </div>
    </main>
  );
}
