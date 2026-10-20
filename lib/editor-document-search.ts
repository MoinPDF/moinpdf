import type { PageItem, Source } from './pdf-engine';
import { uid } from './pdf-engine';
import type { Edits, Mark } from './studio-engine';
import {
  editorMarkChanged,
  editorParagraphs,
  editorRemovalRects,
  editorRectsOverlap,
  readTextTargets,
  type TextTarget,
} from './editor-model';
import { analyzeEditorPage, cachedEditorPage, remainingEditorTargets } from './editor-analysis';
import { editorTargetMark } from './editor-blocks';
import { findEditorText, replaceEditorMatches, type EditorTextMatch } from './editor-rich-text';

export type EditorSearchBlock = {
  id: string;
  pageId: string;
  pageNumber: number;
  sourceId: string;
  mark: Mark;
  existing: boolean;
  width: number;
  height: number;
};
export type EditorDocumentIndex = {
  fingerprint: string;
  blocks: EditorSearchBlock[];
  pageTargets: Record<string, TextTarget[]>;
  skipped: number[];
  failures: { page: number; message: string }[];
};
export type EditorDocumentMatch = EditorTextMatch & { id: string; block: EditorSearchBlock };
export function editorDocumentFingerprint(sources: Source[], pages: PageItem[], edits: Edits) {
  return JSON.stringify([
    sources.map((s) => s.id),
    pages.map((p) => [p.id, p.sourceId, p.index, p.rotation]),
    edits.crops,
    Object.entries(edits.marks)
      .map(([id, marks]) => [id, marks.filter(editorMarkChanged)] as const)
      .filter(([, marks]) => marks.length),
  ]);
}
export async function indexEditorDocument(
  sources: Source[],
  pages: PageItem[],
  edits: Edits,
  language: string,
  scans: boolean,
  signal: AbortSignal,
  onProgress: (page: number, total: number) => void,
): Promise<EditorDocumentIndex> {
  const index: EditorDocumentIndex = {
    fingerprint: editorDocumentFingerprint(sources, pages, edits),
    blocks: [],
    pageTargets: {},
    skipped: [],
    failures: [],
  };
  let characters = 0;
  for (const [i, page] of pages.entries()) {
    signal.throwIfAborted();
    onProgress(i + 1, pages.length);
    try {
      const source = sources.find((s) => s.id === page.sourceId)!;
      const analysis = scans
        ? await analyzeEditorPage(source, page, { language, signal })
        : cachedEditorPage(source, page, language) || (await readTextTargets(source, page));
      signal.throwIfAborted();
      index.pageTargets[page.id] = analysis.targets;
      if (!analysis.targets.length) index.skipped.push(i + 1);
      const marks = edits.marks[page.id] || [];
      const available = remainingEditorTargets(analysis.targets, marks.flatMap(editorRemovalRects));
      const targets = editorParagraphs(available, analysis.width, analysis.height);
      for (const target of targets) {
        if (target.unsupportedReason) {
          index.failures.push({ page: i + 1, message: target.unsupportedReason });
          continue;
        }
        const id = `search-${uid()}`;
        index.blocks.push({
          id,
          pageId: page.id,
          pageNumber: i + 1,
          sourceId: source.id,
          existing: false,
          mark: editorTargetMark(target, page.index, analysis.width, id),
          width: analysis.width,
          height: analysis.height,
        });
      }
      for (const mark of marks.filter((m) => m.kind === 'text'))
        index.blocks.push({
          id: `mark-${page.id}-${mark.id}`,
          pageId: page.id,
          pageNumber: i + 1,
          sourceId: source.id,
          existing: true,
          mark,
          width: analysis.width,
          height: analysis.height,
        });
      characters +=
        targets.reduce((n, t) => n + t.text.length, 0) +
        marks.reduce((n, m) => n + (m.text?.length || 0), 0);
      if (characters > 5000000)
        throw new Error(
          'Das Dokument enthält zu viel Text für die gemeinsame Suche. Bitte in kleinere Dokumente aufteilen.',
        );
    } catch (e) {
      signal.throwIfAborted();
      if (characters > 5000000) throw e;
      index.failures.push({ page: i + 1, message: (e as Error).message });
    }
  }
  return index;
}
export function findEditorDocument(
  index: EditorDocumentIndex,
  query: string,
  matchCase = false,
  wholeWord = false,
): EditorDocumentMatch[] {
  const hits: EditorDocumentMatch[] = [];
  for (const block of index.blocks)
    for (const match of findEditorText(block.mark.text || '', query, matchCase, wholeWord)) {
      hits.push({ ...match, id: `${block.id}:${match.start}:${match.end}`, block });
      if (hits.length > 5000)
        throw new Error('Mehr als 5.000 Treffer. Bitte den Suchtext genauer eingeben.');
    }
  return hits;
}
export function replaceEditorDocument(
  index: EditorDocumentIndex,
  hits: EditorDocumentMatch[],
  replacement: string,
  edits: Edits,
) {
  const byBlock = new Map<string, { block: EditorSearchBlock; matches: EditorTextMatch[] }>();
  for (const hit of hits) {
    if (!index.blocks.includes(hit.block))
      throw new Error('Die Suchergebnisse sind nicht mehr aktuell. Bitte erneut suchen.');
    const group = byBlock.get(hit.block.id) || { block: hit.block, matches: [] };
    group.matches.push({ start: hit.start, end: hit.end });
    byBlock.set(hit.block.id, group);
  }
  const next: Edits = { ...edits, marks: { ...edits.marks } };
  const changes: { block: EditorSearchBlock; mark: Mark }[] = [];
  for (const { block, matches } of byBlock.values()) {
    const mark = { ...block.mark, ...replaceEditorMatches(block.mark, matches, replacement) };
    const current = next.marks[block.pageId] || [];
    next.marks[block.pageId] = [
      ...current.filter(
        (m) =>
          m.id !== block.mark.id &&
          (editorMarkChanged(m) ||
            !editorRemovalRects(m).some((a) =>
              editorRemovalRects(mark).some((b) => editorRectsOverlap(a, b)),
            )),
      ),
      mark,
    ];
    changes.push({ block, mark });
  }
  return { edits: next, changes };
}
