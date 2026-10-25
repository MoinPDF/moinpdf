'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { ProjectArchive } from '@/lib/local-projects';
import { downloadBlob, filenameStem, formatSize } from '@/lib/pdf-engine';
import { useLanguage } from './appearance';
import { ui } from '@/lib/ui-language';
import { projectEncryptionAvailable } from '@/lib/project-encryption';
export type ProjectExportRequest = { archive: ProjectArchive; whole: boolean };
export function ProjectExportDialog({
  request,
  onClose,
  onBusy,
}: {
  request: ProjectExportRequest | null;
  onClose: () => void;
  onBusy?: (busy: boolean) => void;
}) {
  const { t } = useLanguage();
  const [encrypted, setEncrypted] = useState(false),
    [password, setPassword] = useState(''),
    [confirmation, setConfirmation] = useState(''),
    [handoff, setHandoff] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [progress, setProgress] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    onBusy?.(busy);
    return () => onBusy?.(false);
  }, [busy, onBusy]);
  useEffect(() => {
    setPassword('');
    setConfirmation('');
    setHandoff(false);
    setError('');
    setProgress('');
  }, [request]);
  useEffect(() => () => controller.current?.abort(), []);
  if (!request) return null;
  const { archive, whole } = request,
    latest = archive.versions[0];
  const names = [...new Set(archive.versions.flatMap((v) => v.sources.map((s) => s.name)))];
  const undo = archive.versions.reduce(
    (n, v) =>
      n +
      v.state.history.length +
      v.state.future.length +
      Object.values(v.state.documentSessions).reduce(
        (m, s) => m + s.past.length + s.future.length,
        0,
      ),
    0,
  );
  const close = () => {
    controller.current?.abort();
    if (!busy) onClose();
  };
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !busy) close();
      }}
    >
      <DialogContent className="project-dialog z-[52]">
        <DialogHeader>
          <DialogTitle>{t('Projekt exportieren', 'Export project')}</DialogTitle>
          <DialogDescription>{archive.name}</DialogDescription>
        </DialogHeader>
        <label className="advanced-field">
          <span>{t('Ausgabe', 'Output')}</span>
          <select
            value={handoff ? 'handoff' : 'project'}
            disabled={busy}
            onChange={(e) => setHandoff(e.target.value === 'handoff')}
          >
            <option value="project">{t('Bearbeitbares Projekt', 'Editable project')}</option>
            <option value="handoff">
              {t('Bereinigte PDF zur Weitergabe', 'Flattened PDF for sharing')}
            </option>
          </select>
        </label>
        {handoff ? (
          <p>
            {t(
              'Nur die sichtbaren Seiten des neuesten gewählten Stands, als Seitenbilder bis 2800 Pixel. Keine Originaldateien, Anhänge oder Bearbeitungsverläufe. Suchtext, interaktive Formulare, Links und Zertifikatssignaturen werden nicht übernommen. Sichtbare vertrauliche Angaben bleiben sichtbar.',
              'Only visible pages of the latest selected snapshot, as page images up to 2800 pixels. No source files, attachments or edit history. Searchable text, interactive forms, links and certificate signatures are not retained. Visible confidential information remains visible.',
            )}
          </p>
        ) : (
          <>
            <p>
              {archive.versions.length} {t('Arbeitsstände', 'snapshots')} · {names.length}{' '}
              {t('Dateinamen', 'filenames')} · {undo}{' '}
              {t('frühere Bearbeitungsschritte', 'earlier edit steps')}
            </p>
            <details>
              <summary>
                {t('Enthaltene Originaldateien ansehen', 'Review included source files')}
              </summary>
              <ul>
                {names.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </details>
            <p>
              {t(
                'Originale, frühere Bearbeitungen und zuvor entsperrte PDFs sind enthalten. Diese Datei ist zum Fortsetzen der Arbeit bestimmt.',
                'Source files, earlier edits and previously unlocked PDFs are included. This file is intended for continuing work.',
              )}
            </p>
            <label>
              <input
                type="checkbox"
                checked={encrypted}
                disabled={busy || !projectEncryptionAvailable()}
                onChange={(e) => setEncrypted(e.target.checked)}
              />{' '}
              {t('Projektdatei mit Passwort verschlüsseln', 'Encrypt project file with a password')}
            </label>
            {!projectEncryptionAvailable() && (
              <p>
                {t(
                  'Passwortschutz benötigt HTTPS oder localhost.',
                  'Password protection requires HTTPS or localhost.',
                )}
              </p>
            )}
            {encrypted ? (
              <>
                <label className="advanced-field">
                  <span>
                    {t('Passwort (mindestens 12 Zeichen)', 'Password (at least 12 characters)')}
                  </span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    maxLength={1024}
                    value={password}
                    disabled={busy}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <label className="advanced-field">
                  <span>{t('Passwort wiederholen', 'Repeat password')}</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    maxLength={1024}
                    value={confirmation}
                    disabled={busy}
                    onChange={(e) => setConfirmation(e.target.value)}
                  />
                </label>
                <p>
                  {t(
                    'Ohne dieses Passwort lässt sich die Datei nicht wiederherstellen. Der lokale Browserspeicher wird dadurch nicht verschlüsselt.',
                    'This file cannot be recovered without its password. This does not encrypt local browser storage.',
                  )}
                </p>
              </>
            ) : (
              <p>
                {t(
                  'Diese Projektdatei wird unverschlüsselt gespeichert.',
                  'This project file will be saved without encryption.',
                )}
              </p>
            )}
          </>
        )}
        {error && <p role="alert">{ui(error)}</p>}
        {progress && <p role="status">{progress}</p>}
        <div className="project-actions">
          <Button
            disabled={
              busy || (!handoff && encrypted && (password.length < 12 || password !== confirmation))
            }
            onClick={async () => {
              const abort = new AbortController();
              controller.current = abort;
              setBusy(true);
              setError('');
              try {
                let blob: Blob;
                if (handoff)
                  blob = await (
                    await import('@/lib/project-handoff')
                  ).projectHandoff(latest.sources, latest.state, abort.signal, (p) =>
                    setProgress(p.label),
                  );
                else {
                  blob = whole
                    ? await (
                        await import('@/lib/project-bundle')
                      ).encodeProjectArchive(archive, abort.signal)
                    : await (
                        await import('@/lib/project-archive')
                      ).encodeProjectFile(archive.name, latest.sources, latest.state, abort.signal);
                  if (encrypted) {
                    setProgress(
                      t('Projektdatei wird verschlüsselt …', 'Encrypting project file …'),
                    );
                    blob = await (
                      await import('@/lib/project-encryption')
                    ).encryptProject(blob, password, abort.signal);
                  }
                }
                abort.signal.throwIfAborted();
                downloadBlob(
                  blob,
                  filenameStem(archive.name + '.moinpdf') +
                    (handoff ? '-weitergabe.pdf' : whole ? '-gesamt.moinpdf' : '.moinpdf'),
                );
                setProgress(`${t('Heruntergeladen', 'Downloaded')} · ${formatSize(blob.size)}`);
                setPassword('');
                setConfirmation('');
                onClose();
              } catch (e) {
                if (!abort.signal.aborted) setError((e as Error).message);
              } finally {
                setBusy(false);
                controller.current = null;
                if (abort.signal.aborted) onClose();
              }
            }}
          >
            {t('Datei herunterladen', 'Download file')}
          </Button>
          <Button variant="outline" onClick={close}>
            {t('Abbrechen', 'Cancel')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
