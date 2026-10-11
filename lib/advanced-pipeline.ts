import JSZip from 'jszip';
import { openSource, sourcePages, extractPageText, type Source } from './pdf-engine';
import { runStudioJob, emptyEdits } from './studio-engine';
import { inspectPage } from './document-check';
import { protectPdf } from './pdf-security';
import { workflowOptions } from './advanced-text';
import { checkAbort, uniqueNames, type RunContext, type ExportFile } from './advanced-types';

export const stepLabels = {
  ocr: 'OCR',
  removeBlank: 'Leerseiten entfernen',
  numbers: 'Seitennummern',
  stamp: 'Stempel',
  watermark: 'Wasserzeichen',
  metadata: 'Dokumentinfos entfernen',
  grayscale: 'Graustufen',
  compress: 'Scans komprimieren',
  protect: 'Passwortschutz',
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
        let pages = sourcePages(current);
        if (step.kind === 'protect') {
          bytes = await protectPdf(
            bytes,
            { password, printing: 'full', copying: true, editing: true },
            ctx.signal,
          );
          continue;
        }
        if (step.kind === 'removeBlank') {
          const keep = [];
          for (const [n, page] of pages.entries()) {
            if (!(await inspectPage(current, page, n, ctx.signal)).blank) keep.push(page);
            report({ percent: ((n + 1) / pages.length) * 100, label: `Seite ${n + 1}` });
          }
          if (!keep.length)
            throw new Error(
              `${original.name}: Alle Seiten wurden als leer erkannt. Bitte den Schritt „Leerseiten entfernen“ prüfen.`,
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
          [current],
          pages,
          options,
          emptyEdits(),
          report,
          ctx.signal,
        );
        bytes = new Uint8Array(await result.blob.arrayBuffer());
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
    blob: await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }),
    filename: 'PDF-Arbeitsablauf.zip',
    kind: 'zip',
    pages: totalPages,
    note: `${sources.length} ${sources.length === 1 ? 'Datei' : 'Dateien'} · ${steps.map((s) => stepLabels[s.kind]).join(' → ')}`,
  };
}
