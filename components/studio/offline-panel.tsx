'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { formatSize } from '@/lib/pdf-engine';
import { ocrLanguages } from '@/lib/ocr-languages';
import {
  offlineMessage,
  offlineWorker,
  type OfflineManifest,
  type OfflineStatus,
} from '@/lib/offline-client';
import { useLanguage } from './appearance';
export function OfflinePanel() {
  const { t } = useLanguage();
  const [manifest, setManifest] = useState<OfflineManifest | null>(null),
    [status, setStatus] = useState<OfflineStatus | null>(null),
    [selected, setSelected] = useState(['core', 'language-deu', 'language-eng']),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(''),
    [online, setOnline] = useState(true);
  const worker = useRef<ServiceWorker | null>(null);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    void fetch('/offline-manifest.json', { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => {
        if (active && Array.isArray(m?.packs) && typeof m.build === 'string') setManifest(m);
      })
      .catch(() => {});
    if ('serviceWorker' in navigator)
      void navigator.serviceWorker
        .getRegistration('/')
        .then(async (reg) => {
          if (active && reg?.active?.scriptURL.startsWith(location.origin + '/sw.js')) {
            worker.current = reg.active;
            const state = await offlineMessage<OfflineStatus>(reg.active, { type: 'status' });
            if (active) setStatus(state);
          }
        })
        .catch(() => {});
    return () => {
      active = false;
      controller.abort();
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  const available =
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    'serviceWorker' in navigator &&
    'caches' in window;
  const name = (id: string) =>
    id === 'core'
      ? t('App und lokale PDF-Werkzeuge', 'App and local PDF tools')
      : id === 'office'
        ? t('Office-Konverter', 'Office converter')
        : id === 'assistant'
          ? t('Assistent-Laufzeit (ohne Modell)', 'Assistant runtime (without model)')
          : t(ocrLanguages.find(([code]) => id === 'language-' + code)?.[1] || id);
  return (
    <section
      className="advanced-card offline-panel"
      aria-label={t('Offline-Nutzung', 'Offline use')}
    >
      <strong>
        {t('Offline-Nutzung', 'Offline use')} ·{' '}
        {online ? t('Online', 'Online') : t('Offline', 'Offline')}
      </strong>
      <p>
        {t(
          'App und benötigte Sprachpakete auf diesem Gerät speichern. Dokumentenserver-Funktionen benötigen weiterhin eine Verbindung zum eigenen Server.',
          'Save the app and required language packs on this device. Document server features still need a connection to your server.',
        )}
      </p>
      <p role="status">
        {status?.ready.includes('core')
          ? `${t('Offline vorbereitet', 'Prepared for offline use')} · ${status.version}`
          : t('Noch nicht offline vorbereitet.', 'Not prepared for offline use yet.')}
        {status &&
          manifest &&
          status.build !== manifest.build &&
          ` · ${t('Aktualisierung verfügbar', 'Update available')}`}
      </p>
      {!available ? (
        <p>
          {t(
            'Offline-Nutzung benötigt HTTPS oder localhost und einen unterstützten Browser.',
            'Offline use requires HTTPS or localhost and a supported browser.',
          )}
        </p>
      ) : !manifest ? (
        <p>
          {t(
            'Offline-Pakete sind erst in einer gebauten Veröffentlichung verfügbar.',
            'Offline packages are available in a production build.',
          )}
        </p>
      ) : (
        <details>
          <summary>{t('Offline-Pakete verwalten', 'Manage offline packages')}</summary>
          {manifest.packs.map((pack) => (
            <label
              key={pack.id}
              style={{ display: 'flex', gap: 8, alignItems: 'center', minHeight: 44 }}
            >
              <input
                type="checkbox"
                checked={selected.includes(pack.id)}
                disabled={busy || pack.id === 'core'}
                onChange={(e) =>
                  setSelected((s) =>
                    e.target.checked ? [...s, pack.id] : s.filter((id) => id !== pack.id),
                  )
                }
              />
              <span>
                {name(pack.id)} · {formatSize(pack.bytes)}{' '}
                {status?.build === manifest.build && status.ready.includes(pack.id) ? '✓' : ''}
              </span>
            </label>
          ))}
          <div className="project-actions">
            <Button
              disabled={busy || !online}
              onClick={async () => {
                setBusy(true);
                setNotice('');
                try {
                  worker.current = await offlineWorker();
                  const next = await offlineMessage<OfflineStatus>(
                    worker.current,
                    {
                      type: 'prepare',
                      packs: selected.filter((id) => manifest.packs.some((p) => p.id === id)),
                    },
                    (p) =>
                      setNotice(`${name(p.pack)}: ${formatSize(p.done)} / ${formatSize(p.total)}`),
                  );
                  setStatus(next);
                  setNotice(
                    t(
                      'Offline-Dateien geprüft und gespeichert. Du kannst die App über das Browsermenü installieren.',
                      'Offline files verified and saved. You can install the app from the browser menu.',
                    ),
                  );
                } catch (e) {
                  setNotice((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t('Auswahl herunterladen / aktualisieren', 'Download / update selection')}
            </Button>
            {busy && (
              <Button
                variant="outline"
                onClick={() => {
                  if (worker.current)
                    void offlineMessage(worker.current, { type: 'cancel' }).catch(() => {});
                }}
              >
                {t('Abbrechen', 'Cancel')}
              </Button>
            )}
            {!busy && worker.current && (
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    setStatus(
                      await offlineMessage<OfflineStatus>(worker.current!, {
                        type: 'remove',
                        pack: 'all',
                      }),
                    );
                    setNotice(
                      t(
                        'Offline-Dateien entfernt. Projekte und Ergebnisse bleiben gespeichert.',
                        'Offline files removed. Projects and results remain saved.',
                      ),
                    );
                  } catch (e) {
                    setNotice((e as Error).message);
                  }
                }}
              >
                {t('Offline-Dateien entfernen', 'Remove offline files')}
              </Button>
            )}
          </div>
        </details>
      )}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}

export function OfflineIndicator({ onOpen }: { onOpen: () => void }) {
  const { t } = useLanguage();
  const [offline, setOffline] = useState(false),
    [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    setHost(document.getElementById('moinpdf-project-bar'));
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return host && offline
    ? createPortal(
        <button
          type="button"
          className="results-shortcut"
          onClick={onOpen}
          aria-label={t('Offline-Status und Pakete öffnen', 'Open offline status and packages')}
        >
          <span role="status">{t('Offline', 'Offline')}</span>
        </button>,
        host,
      )
    : null;
}
