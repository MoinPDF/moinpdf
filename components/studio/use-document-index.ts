'use client';
import { useEffect, useRef, useState } from 'react';
import { inspectPage, pageKey, recognizeForSearch, type PageIndex } from '@/lib/document-check';
import type { Source, PageItem, ProgressUpdate } from '@/lib/pdf-engine';
export function useDocumentIndex(sources: Source[], pages: PageItem[]) {
  const cache = useRef(new Map<string, PageIndex>()),
    refs = useRef({ sources, pages });
  refs.current = { sources, pages };
  const [rows, setRows] = useState<PageIndex[]>([]),
    [checking, setChecking] = useState(false),
    [ocrBusy, setOcrBusy] = useState(false),
    [progress, setProgress] = useState<ProgressUpdate>({ percent: 0, label: '' }),
    [error, setError] = useState('');
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
          } catch (err) {
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
      cache.current.clear();
    },
    [],
  );
  async function recognize(language: string) {
    if (ocr.current || checking) return;
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
    } catch (err) {
      if (!ctrl.signal.aborted)
        setError('Die Texterkennung konnte nicht abgeschlossen werden. Bitte erneut versuchen.');
    } finally {
      if (ocr.current === ctrl) ocr.current = null;
      setOcrBusy(false);
    }
  }
  return {
    rows,
    checking,
    ocrBusy,
    progress,
    error,
    recognize,
    cancel: () => ocr.current?.abort(),
  };
}
export type DocumentIndex = ReturnType<typeof useDocumentIndex>;
