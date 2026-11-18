'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from './appearance';
import { ui } from '@/lib/ui-language';
import { CameraPanel } from './advanced-media-panels';
import {
  transferFromHash,
  transferCall,
  randomHex,
  sealTransfer,
  openTransfer,
  type TransferSession,
} from '@/lib/scan-transfer';
import type { PanelProps } from './advanced-shared';
export function ScanTransferPanel({ busy, run }: Pick<PanelProps, 'busy' | 'run'>) {
  useLanguage();
  const [session, setSession] = useState<TransferSession | null>(null),
    [sender, setSender] = useState(false),
    [error, setError] = useState(''),
    [status, setStatus] = useState(''),
    [qr, setQr] = useState(''),
    [pending, setPending] = useState<File | null>(null),
    [sending, setSending] = useState(false);
  const item = useRef(''),
    retry = useRef<{ id: string; data: Uint8Array } | null>(null),
    abort = useRef(new AbortController());
  useEffect(() => {
    abort.current = new AbortController();
    try {
      const incoming = transferFromHash(location.hash);
      if (incoming) {
        setSender(true);
        setSession(incoming);
      }
    } catch (e) {
      setError((e as Error).message);
    }
    return () => abort.current.abort();
  }, []);
  useEffect(() => {
    if (!session || sender) return;
    let live = true;
    const canvas = document.createElement('canvas');
    import('@bwip-js/browser')
      .then(({ qrcode }) => {
        qrcode(canvas, {
          bcid: 'qrcode',
          text:
            location.origin +
            location.pathname +
            '#moin-transfer=' +
            session.id +
            '.' +
            session.send +
            '.' +
            session.key,
          scale: 4,
          padding: 4,
        });
        if (live) setQr(canvas.toDataURL());
      })
      .catch(() => setError(ui('QR-Code konnte nicht erstellt werden.')));
    return () => {
      live = false;
    };
  }, [session, sender]);
  useEffect(() => {
    if (!session || pending) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const poll = async () => {
      try {
        const state = await (await transferCall(session, '', {}, controller.signal)).json();
        if (stopped) return;
        if (sender) {
          if (item.current && state.ack === item.current) {
            setStatus(ui('Am PC empfangen und bestätigt.'));
            item.current = '';
            retry.current = null;
            setSending(false);
            setError('');
          }
        } else if (state.pending) {
          const response = await transferCall(
            session,
            '/file?id=' + state.pending,
            {},
            controller.signal,
          );
          const file = await openTransfer(
            new Uint8Array(await response.arrayBuffer()),
            session.key,
            state.pending,
          );
          if (stopped) return;
          item.current = state.pending;
          setPending(file);
          setStatus(ui('Datei empfangen. Bitte am PC übernehmen.'));
          setError('');
          return;
        }
      } catch (e) {
        if (!controller.signal.aborted) setError(ui((e as Error).message));
        if ((e as Error & { status?: number }).status === 410) {
          setSending(false);
          return;
        }
      }
      if (!stopped) timer = setTimeout(poll, 2000);
    };
    void poll();
    return () => {
      stopped = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [session, pending, sender]);
  async function start() {
    setError('');
    try {
      const s = await (
        await transferCall(null, '', { method: 'POST' }, abort.current.signal)
      ).json();
      setSession({ ...s, key: randomHex(32) });
    } catch (e) {
      setError(ui((e as Error).message));
    }
  }
  async function send(file?: File) {
    if (!session) return;
    setError('');
    setSending(true);
    try {
      if (file) {
        const id = randomHex(16);
        retry.current = { id, data: await sealTransfer(file, session.key, id) };
      }
      const current = retry.current;
      if (!current) throw new Error('Bitte zuerst eine Datei auswählen.');
      item.current = current.id;
      await transferCall(
        session,
        '/file',
        {
          method: 'PUT',
          headers: { 'X-Transfer-Id': current.id, 'Content-Type': 'application/octet-stream' },
          body: current.data.slice().buffer,
        },
        abort.current.signal,
      );
      setStatus(ui('Gesendet. Warte auf Bestätigung am PC …'));
    } catch (e) {
      setSending(false);
      setError(ui((e as Error).message));
    }
  }
  async function acknowledge() {
    if (!session) return;
    await transferCall(
      session,
      '/ack',
      { method: 'POST', headers: { 'X-Transfer-Id': item.current } },
      abort.current.signal,
    );
    setPending(null);
    item.current = '';
    setStatus(ui('Datei übernommen. Weitere Scans können gesendet werden.'));
  }
  return (
    <section className="advanced-card">
      <h2>{ui(sender ? 'Scan an den PC senden' : 'Scans vom Smartphone empfangen')}</h2>
      <p>
        {ui(
          '15 Minuten, bis zu 20 Dateien mit jeweils 10 MB. Dateien werden vor dem Senden verschlüsselt. Den QR-Link nur auf dem eigenen Smartphone öffnen. Beide Geräte benötigen diese MoinPDF-Adresse und gegebenenfalls dieselbe Anmeldung.',
        )}
      </p>
      {!session ? (
        <Button onClick={start}>{ui('QR-Verbindung erstellen')}</Button>
      ) : sender ? (
        <>
          <input
            type="file"
            accept="application/pdf,image/*"
            capture="environment"
            disabled={sending}
            aria-label={ui('Scan auswählen')}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void send(f);
              e.target.value = '';
            }}
          />
          <CameraPanel
            busy={sending}
            run={async (job) => {
              try {
                setSending(true);
                const out = await job({ signal: abort.current.signal, report: () => {} });
                if (out)
                  await send(new File([out.blob], out.filename, { type: 'application/pdf' }));
                else setSending(false);
              } catch (e) {
                setSending(false);
                setError(ui((e as Error).message));
              }
            }}
          />
          {retry.current && !sending && (
            <Button onClick={() => void send()}>{ui('Übertragung wiederholen')}</Button>
          )}
        </>
      ) : (
        <>
          {qr && (
            <img
              src={qr}
              alt={ui('QR-Code für Scanübertragung')}
              style={{ width: 240, maxWidth: '100%', background: '#fff' }}
            />
          )}
          <p>{ui('QR-Code mit der Smartphone-Kamera öffnen. Dieses Fenster geöffnet lassen.')}</p>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  location.origin +
                    location.pathname +
                    '#moin-transfer=' +
                    session.id +
                    '.' +
                    session.send +
                    '.' +
                    session.key,
                );
                setStatus(ui('Verbindungslink kopiert.'));
              } catch {
                setError(ui('Link konnte nicht kopiert werden. Bitte den QR-Code verwenden.'));
              }
            }}
          >
            {ui('Verbindungslink kopieren')}
          </Button>
          {pending && (
            <>
              <p>{pending.name}</p>
              <Button
                disabled={busy}
                onClick={() =>
                  run(async (ctx) => {
                    const { openSource } = await import('@/lib/pdf-engine');
                    const source = await openSource(pending);
                    try {
                      ctx.signal.throwIfAborted();
                      await acknowledge();
                      return {
                        blob: new Blob([source.bytes.slice()], { type: 'application/pdf' }),
                        filename: pending.name.replace(/\.[^.]+$/, '') + '.pdf',
                        kind: 'pdf',
                        pages: source.pdf.numPages,
                      };
                    } finally {
                      await source.pdf.loadingTask.destroy();
                    }
                  })
                }
              >
                {ui('Scan übernehmen')}
              </Button>
            </>
          )}
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await transferCall(session, '', { method: 'DELETE' }, abort.current.signal);
                setSession(null);
                setPending(null);
                setQr('');
                setStatus('');
                setError('');
              } catch (e) {
                setError(ui((e as Error).message));
              }
            }}
          >
            {ui('Verbindung schließen')}
          </Button>
        </>
      )}
      {status && <p role="status">{status}</p>}
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
