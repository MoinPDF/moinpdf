'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatSize } from '@/lib/pdf-engine';
import { storageHealth, type StorageHealth } from '@/lib/storage-health';
import { useLanguage } from './appearance';
export function StorageHealthPanel() {
  const { t } = useLanguage();
  const [health, setHealth] = useState<StorageHealth | null>(null);
  const [busy, setBusy] = useState(false),
    [requested, setRequested] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = () =>
      void storageHealth().then((v) => {
        if (active) setHealth(v);
      });
    refresh();
    const timer = setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  return (
    <section className="advanced-card" aria-label={t('Browserspeicher', 'Browser storage')}>
      <strong>{t('Browserspeicher', 'Browser storage')}</strong>
      <p>
        {health?.usage !== undefined && health.quota !== undefined
          ? `${formatSize(health.usage)} / ${formatSize(health.quota)} ${t('(geschätzt, einschließlich Offline-Dateien)', '(estimated, including offline files)')}`
          : t(
              'Speicherbelegung ist in diesem Browser nicht verfügbar.',
              'Storage usage is unavailable in this browser.',
            )}
      </p>
      <p role="status">
        {health?.persisted
          ? t(
              'Dauerhafte Speicherung ist gewährt. Eine heruntergeladene Sicherung bleibt sinnvoll.',
              'Persistent storage is granted. Keep a downloaded backup as well.',
            )
          : requested
            ? t(
                'Der Browser hat dauerhafte Speicherung nicht gewährt. Bitte Projekte herunterladen.',
                'The browser did not grant persistent storage. Please download your projects.',
              )
            : t(
                'Lokale Daten können vom Browser entfernt werden. Sichere wichtige Projekte als Datei.',
                'The browser may remove local data. Back up important projects as files.',
              )}
      </p>
      {health?.pressure && (
        <p role="alert">
          {t(
            'Wenig Browserspeicher: Projekte sichern und nicht mehr benötigte Ergebnisse oder Offline-Pakete entfernen.',
            'Browser storage is running low: back up projects and remove unneeded results or offline packages.',
          )}
        </p>
      )}
      {health?.supported && !health.persisted && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await navigator.storage.persist();
            } catch {
              /* Display the actual state below. */
            }
            setRequested(true);
            setHealth(await storageHealth());
            setBusy(false);
          }}
        >
          {t('Dauerhafte Speicherung anfragen', 'Request persistent storage')}
        </Button>
      )}
    </section>
  );
}
