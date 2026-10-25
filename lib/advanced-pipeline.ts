import { PDFDocument, degrees } from 'pdf-lib';
import JSZip from 'jszip';
import {
  openSource,
  sourcePages,
  extractPageText,
  requireAcroForm,
  type Source,
} from './pdf-engine';
import { runStudioJob, emptyEdits } from './studio-engine';
import { inspectPage } from './document-check';
import { protectPdf, linearizePdf, optimizePdf } from './pdf-security';
import { workflowOptions } from './advanced-text';
import { checkAbort, uniqueNames, type RunContext, type ExportFile } from './advanced-types';

export const stepLabels = {
  rotate90: 'Seiten um 90° drehen',
  rotate180: 'Seiten um 180° drehen',
  reverse: 'Seitenreihenfolge umkehren',
  flattenForms: 'Formularfelder festschreiben',
  optimizeLossless: 'Verlustfrei optimieren',
  ocr: 'OCR',
  removeBlank: 'Leerseiten entfernen',
  numbers: 'Seitennummern',
  stamp: 'Stempel',
  watermark: 'Wasserzeichen',
  metadata: 'Dokumentinfos entfernen',
  grayscale: 'Graustufen',
  compress: 'Scans komprimieren',
  protect: 'Passwortschutz',
  'remove-annotations': 'Kommentare entfernen',
  'auto-crop': 'Weiße Ränder beschneiden',
  bilevel: 'Schwarzweiß',
  invert: 'Farben invertieren',
  resize: 'Auf A4 einpassen',
  nup: 'Zwei Seiten pro Blatt',
  flatten: 'Als Seitenbilder festschreiben',
  linearize: 'Schnelle Webansicht',
};
export type StepKind = keyof typeof stepLabels;
export type WorkflowCondition = {
  field: 'filename' | 'text' | 'pages';
  operator: 'contains' | 'notContains' | 'gte' | 'lt';
  value: string;
};
export type WorkflowAction = { kind: StepKind; text?: string; number?: number };
export type WorkflowStep = WorkflowAction & {
  condition?: WorkflowCondition;
  otherwise?: WorkflowAction;
};
export type SavedWorkflow = { version: 1; name: string; steps: WorkflowStep[] };
export const workflowTemplates: SavedWorkflow[] = [
  {
    version: 1,
    name: 'Scanablage',
    steps: [{ kind: 'ocr' }, { kind: 'removeBlank' }, { kind: 'optimizeLossless' }],
  },
  {
    version: 1,
    name: 'Zum Teilen vorbereiten',
    steps: [{ kind: 'metadata' }, { kind: 'remove-annotations' }, { kind: 'optimizeLossless' }],
  },
  {
    version: 1,
    name: 'Formular abschließen',
    steps: [{ kind: 'flattenForms' }, { kind: 'optimizeLossless' }],
  },
  { version: 1, name: 'Vertraulich versenden', steps: [{ kind: 'metadata' }, { kind: 'protect' }] },
  {
    version: 1,
    name: 'Rückwärts gescannte Seiten',
    steps: [{ kind: 'reverse' }, { kind: 'rotate180' }],
  },
];
export function validateWorkflow(value: unknown): SavedWorkflow {
  const v = value as SavedWorkflow;
  if (
    !v ||
    v.version !== 1 ||
    typeof v.name !== 'string' ||
    !v.name.trim() ||
    v.name.length > 100 ||
    !Array.isArray(v.steps) ||
    !v.steps.length ||
    v.steps.length > 12
  )
    throw new Error('Ungültiger Arbeitsablauf: Name und 1 bis 12 Schritte erforderlich.');
  const steps = v.steps.map((s, i) => {
    if (!s || !Object.hasOwn(stepLabels, s.kind)) throw new Error('Unbekannter Arbeitsschritt.');
    if (s.kind === 'protect' && i !== v.steps.length - 1)
      throw new Error('Passwortschutz muss der letzte Schritt sein.');
    if (s.text !== undefined && (typeof s.text !== 'string' || s.text.length > 200))
      throw new Error('Schritttext: höchstens 200 Zeichen.');
    if (
      s.number !== undefined &&
      (!Number.isInteger(s.number) || s.number < 1 || s.number > 999999)
    )
      throw new Error('Startnummer: 1 bis 999999.');
    let condition: WorkflowCondition | undefined, otherwise: WorkflowAction | undefined;
    if (s.condition) {
      const c = s.condition;
      if (
        !['filename', 'text', 'pages'].includes(c.field) ||
        !['contains', 'notContains', 'gte', 'lt'].includes(c.operator) ||
        typeof c.value !== 'string' ||
        !c.value.trim() ||
        c.value.length > 200 ||
        (c.field === 'pages'
          ? !['gte', 'lt'].includes(c.operator) ||
            !/^\d+$/.test(c.value) ||
            Number(c.value) < 1 ||
            Number(c.value) > 1000
          : !['contains', 'notContains'].includes(c.operator))
      )
        throw new Error('Ungültige Ablaufbedingung.');
      condition = { field: c.field, operator: c.operator, value: c.value };
    }
    if (s.otherwise) {
      if (!condition) throw new Error('Ein Sonst-Zweig benötigt eine Bedingung.');
      const action = validateWorkflow({
        version: 1,
        name: 'Sonst',
        steps: [{ kind: s.otherwise.kind, text: s.otherwise.text, number: s.otherwise.number }],
      }).steps[0];
      if (action.kind === 'protect' && i !== v.steps.length - 1)
        throw new Error('Passwortschutz muss der letzte Schritt sein.');
      otherwise = action;
    }
    return {
      kind: s.kind,
      ...(s.text !== undefined ? { text: s.text } : {}),
      ...(s.number !== undefined ? { number: s.number } : {}),
      ...(condition ? { condition } : {}),
      ...(otherwise ? { otherwise } : {}),
    };
  });
  return { version: 1, name: v.name.trim(), steps };
}
export async function conditionMatches(
  source: Source,
  condition: WorkflowCondition,
  ctx: RunContext,
) {
  checkAbort(ctx.signal);
  if (condition.field === 'pages')
    return condition.operator === 'gte'
      ? source.pdf.numPages >= Number(condition.value)
      : source.pdf.numPages < Number(condition.value);
  const needle = condition.value.normalize('NFKC').toLocaleLowerCase('de-DE');
  let found = false;
  if (condition.field === 'filename')
    found = source.name.normalize('NFKC').toLocaleLowerCase('de-DE').includes(needle);
  else
    for (const [i, page] of sourcePages(source).entries()) {
      checkAbort(ctx.signal);
      if (
        (await extractPageText(source, page))
          .normalize('NFKC')
          .toLocaleLowerCase('de-DE')
          .includes(needle)
      ) {
        found = true;
        break;
      }
      ctx.report({
        percent: ((i + 1) / source.pdf.numPages) * 100,
        label: 'Bedingung im vorhandenen PDF-Text prüfen',
      });
    }
  return condition.operator === 'notContains' ? !found : found;
}
export async function applyWorkflowAction(
  source: Source,
  step: WorkflowAction,
  password: string,
  ctx: RunContext,
): Promise<Uint8Array> {
  checkAbort(ctx.signal);
  if (
    step.kind === 'rotate90' ||
    step.kind === 'rotate180' ||
    step.kind === 'reverse' ||
    step.kind === 'flattenForms' ||
    step.kind === 'optimizeLossless'
  ) {
    const doc = await PDFDocument.load(source.bytes);
    const form = requireAcroForm(doc);
    if (step.kind === 'optimizeLossless') return optimizePdf(source.bytes, undefined, ctx.signal);
    if (step.kind === 'flattenForms') form.flatten();
    if (step.kind.startsWith('rotate')) {
      const angle = step.kind === 'rotate90' ? 90 : 180;
      for (const page of doc.getPages())
        page.setRotation(degrees((page.getRotation().angle + angle) % 360));
    }
    if (step.kind === 'reverse') {
      // Reinsert the same page objects: field widgets and bookmark destinations keep their refs.
      const pages = doc.getPages();
      while (doc.getPageCount()) doc.removePage(0);
      for (const page of pages.reverse()) doc.addPage(page);
    }
    checkAbort(ctx.signal);
    return doc.save();
  }
  if (step.kind === 'protect')
    return protectPdf(
      source.bytes,
      { password, printing: 'full', copying: true, editing: true },
      ctx.signal,
    );
  if (step.kind === 'linearize') return linearizePdf(source.bytes, ctx.signal);
  let pages = sourcePages(source);
  if (step.kind === 'removeBlank') {
    const keep = [];
    for (const [index, page] of pages.entries()) {
      if (!(await inspectPage(source, page, index, ctx.signal)).blank) keep.push(page);
      ctx.report({ percent: ((index + 1) / pages.length) * 100, label: `Seite ${index + 1}` });
    }
    if (!keep.length)
      throw new Error(
        `${source.name}: Alle Seiten wurden als leer erkannt. Bitte den Schritt „Leerseiten entfernen“ prüfen.`,
      );
    pages = keep;
  }
  const options = {
    ...workflowOptions,
    stampText: step.text || 'GEPRÜFT',
    watermark: step.text || 'ENTWURF',
    numberStart: step.number || 1,
  };
  const result = await runStudioJob(
    step.kind === 'removeBlank' ? 'organize' : step.kind,
    [source],
    pages,
    options,
    emptyEdits(),
    ctx.report,
    ctx.signal,
  );
  return new Uint8Array(await result.blob.arrayBuffer());
}
export async function runPipeline(
  sources: Source[],
  workflow: SavedWorkflow,
  password: string,
  ctx: RunContext,
): Promise<ExportFile> {
  const { steps } = validateWorkflow(workflow);
  if (!sources.length) throw new Error('Bitte zuerst PDFs öffnen.');
  const zip = new JSZip(),
    names = uniqueNames(sources.map((s) => s.name.replace(/\.pdf$/i, '') + '-bearbeitet.pdf'));
  let totalPages = 0;
  const log: { file: string; step: number; condition?: boolean; action: string }[] = [];
  for (const [i, original] of sources.entries()) {
    checkAbort(ctx.signal);
    let current = original,
      owned: Source | undefined,
      bytes = original.bytes;
    try {
      for (const [j, configured] of steps.entries()) {
        checkAbort(ctx.signal);
        const matched = configured.condition
          ? await conditionMatches(current, configured.condition, ctx)
          : undefined;
        const step = matched === false ? configured.otherwise : configured;
        log.push({
          file: original.name,
          step: j + 1,
          ...(matched !== undefined ? { condition: matched } : {}),
          action: step ? stepLabels[step.kind] : 'Übersprungen',
        });
        if (!step) continue;
        const report = (p: { percent: number; label: string }) =>
          ctx.report({
            percent: ((i + (j + p.percent / 100) / steps.length) / sources.length) * 100,
            label: `${i + 1}/${sources.length} · ${stepLabels[step.kind]} · ${p.label}`,
          });
        bytes = await applyWorkflowAction(current, step, password, { signal: ctx.signal, report });
        if (step.kind === 'protect') continue;
        if (owned) await owned.pdf.loadingTask.destroy();
        owned = undefined;
        current = await openSource(
          new File([new Uint8Array(bytes)], original.name, { type: 'application/pdf' }),
        );
        owned = current;
      }
      totalPages += current.pdf.numPages;
      zip.file(names[i], bytes);
    } finally {
      if (owned) await owned.pdf.loadingTask.destroy();
    }
  }
  checkAbort(ctx.signal);
  zip.file(
    'MoinPDF-Ablaufprotokoll.json',
    JSON.stringify({ workflow: workflow.name, steps: log }, null, 2),
  );
  return {
    blob: await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }, () =>
      checkAbort(ctx.signal),
    ),
    filename: 'PDF-Arbeitsablauf.zip',
    kind: 'zip',
    pages: totalPages,
    note: `${sources.length} ${sources.length === 1 ? 'Datei' : 'Dateien'} · ${steps.map((s) => stepLabels[s.kind]).join(' → ')}`,
  };
}

export async function runWorkflowStep(
  source: Source,
  configured: WorkflowStep,
  password: string,
  ctx: RunContext,
) {
  const matched = configured.condition
    ? await conditionMatches(source, configured.condition, ctx)
    : undefined;
  const step = matched === false ? configured.otherwise : configured;
  return {
    bytes: step ? await applyWorkflowAction(source, step, password, ctx) : source.bytes,
    action: step ? stepLabels[step.kind] : 'Übersprungen',
    protected: step?.kind === 'protect',
  };
}
