'use client';
import { useEffect, useRef, useState } from 'react';
import { analyzeScanQuality } from '@/lib/scan-quality';
import { inspectPage, pageKey, recognizeForSearch, type PageIndex } from '@/lib/document-check';
import { renderPage, type Source, type PageItem, type ProgressUpdate } from '@/lib/pdf-engine';
export function useDocumentIndex(sources: Source[], pages: PageItem[]) {
  const cache = useRef(new Map<string, PageIndex>()),
    refs = useRef({ sources, pages });
  refs.current = { sources, pages };
  const [rows, setRows] = useState<PageIndex[]>([]),
    [checking, setChecking] = useState(false),
    [ocrBusy, setOcrBusy] = useState(false),
    [progress, setProgress] = useState<ProgressUpdate>({ percent: 0, label: '' }),
    [error, setError] = useState('');
  const [qualityBusy, setQualityBusy] = useState(false);
  const quality = useRef<AbortController | null>(null);
  const ocr = useRef<AbortController | null>(null);
  const signature = pages.map((p) => `${p.id}:${pageKey(p)}`).join('|');
  const refresh = () =>
    setRows(
      refs.current.pages.flatMap((p, position) => {
        const row = cache.current.get(pageKey(p));
        return row ? [{ ...row, pageId: p.id, position }] : [];
      }),
    );
  useEffect(() => {
    const ctrl = new AbortController();
    ocr.current?.abort();
    quality.current?.abort();
    setError('');
    const { sources: currentSources, pages: currentPages } = refs.current;
    const keys = new Set(currentPages.map(pageKey));
    for (const key of cache.current.keys()) if (!keys.has(key)) cache.current.delete(key);
    if (!currentPages.length) {
      cache.current.clear();
      setRows([]);
      setChecking(false);
      return () => ctrl.abort();
    }
    setChecking(true);
    refresh();
    void (async () => {
      try {
        for (let position = 0; position < currentPages.length; position++) {
          if (ctrl.signal.aborted) return;
          const page = currentPages[position],
            key = pageKey(page);
          if (cache.current.has(key)) continue;
          try {
            const row = await inspectPage(
              currentSources.find((s) => s.id === page.sourceId)!,
              page,
              position,
              ctrl.signal,
            );
            if (ctrl.signal.aborted) return;
            cache.current.set(key, row);
          } catch {
            if (ctrl.signal.aborted) return;
            const source = currentSources.find((s) => s.id === page.sourceId)!;
            cache.current.set(key, {
              pageId: page.id,
              sourceId: source.id,
              name: source.name,
              originalIndex: page.index,
              position,
              width: 0,
              height: 0,
              format: 'Unbekannt',
              text: '',
              preview: '',
              blank: false,
              needsOcr: false,
              ocrDone: false,
              error: 'Diese Seite konnte nicht geprüft werden.',
            });
          }
          refresh();
          await new Promise((r) => setTimeout(r, 0));
        }
      } finally {
        if (!ctrl.signal.aborted) setChecking(false);
      }
    })();
    return () => ctrl.abort();
  }, [signature]);
  useEffect(
    () => () => {
      ocr.current?.abort();
      quality.current?.abort();
      cache.current.clear();
    },
    [],
  );
  async function recognize(language: string) {
    if (ocr.current || quality.current || checking) return;
    const ctrl = new AbortController();
    ocr.current = ctrl;
    setOcrBusy(true);
    setError('');
    const { sources: currentSources, pages: currentPages } = refs.current;
    const seen = new Set<string>(),
      targets = currentPages.filter((p) => {
        const key = pageKey(p),
          row = cache.current.get(key);
        if (!row?.needsOcr || row.ocrDone || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    try {
      await recognizeForSearch(
        currentSources,
        targets,
        language,
        (page, text) => {
          const key = pageKey(page),
            row = cache.current.get(key);
          if (row && !ctrl.signal.aborted) {
            cache.current.set(key, { ...row, text, ocrDone: true });
            refresh();
          }
        },
        setProgress,
        ctrl.signal,
      );
    } catch {
      if (!ctrl.signal.aborted)
        setError('Die Texterkennung konnte nicht abgeschlossen werden. Bitte erneut versuchen.');
    } finally {
      if (ocr.current === ctrl) ocr.current = null;
      setOcrBusy(false);
    }
  }
  async function checkQuality() {
    if (ocr.current || quality.current || checking) return;
    const { sources: currentSources, pages: currentPages } = refs.current;
    if (currentPages.length > 200) {
      setError('Bitte höchstens 200 Seiten auswerten.');
      return;
    }
    const ctrl = new AbortController();
    quality.current = ctrl;
    setQualityBusy(true);
    setError('');
    try {
      for (const [i, page] of currentPages.entries()) {
        ctrl.signal.throwIfAborted();
        setProgress({ percent: (i / currentPages.length) * 100, label: 'Scan-Qualität prüfen' });
        const { canvas } = await renderPage(
          currentSources.find((s) => s.id === page.sourceId)!,
          page,
          1000,
          ctrl.signal,
        );
        try {
          const result = analyzeScanQuality(
            canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data,
            canvas.width,
            canvas.height,
          );
          ctrl.signal.throwIfAborted();
          const key = pageKey(page),
            row = cache.current.get(key);
          if (row) cache.current.set(key, { ...row, quality: result });
          refresh();
        } finally {
          canvas.width = canvas.height = 0;
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    } catch (e) {
      if (!ctrl.signal.aborted) setError((e as Error).message);
    } finally {
      if (quality.current === ctrl) quality.current = null;
      setQualityBusy(false);
    }
  }
  return {
    rows,
    checking,
    ocrBusy,
    qualityBusy,
    checkQuality,
    progress,
    error,
    recognize,
    cancel: () => {
      ocr.current?.abort();
      quality.current?.abort();
    },
  };
}
export type DocumentIndex = ReturnType<typeof useDocumentIndex>;
