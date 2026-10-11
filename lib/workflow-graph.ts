import JSZip from 'jszip';
import { openSource, type Source } from './pdf-engine';
import {
  validateWorkflow,
  conditionMatches,
  applyWorkflowAction,
  stepLabels,
  type SavedWorkflow,
  type WorkflowAction,
  type WorkflowCondition,
} from './advanced-pipeline';
import { checkAbort, uniqueNames, type RunContext, type ExportFile } from './advanced-types';
export type GraphNode = { id: string; x: number; y: number } & (
  | { type: 'action'; action: WorkflowAction; next: string }
  | { type: 'condition'; condition: WorkflowCondition; yes: string; no: string }
  | { type: 'end' }
);
export type WorkflowGraph = { version: 2; name: string; entry: string; nodes: GraphNode[] };
const idOK = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9_-]{1,40}$/.test(value);
export function workflowToGraph(workflow: SavedWorkflow): WorkflowGraph {
  const saved = validateWorkflow(workflow),
    nodes: GraphNode[] = [];
  for (const [i, step] of saved.steps.entries()) {
    const next = i === saved.steps.length - 1 ? 'end' : `step${i + 1}`;
    const action = { kind: step.kind, text: step.text, number: step.number };
    if (step.condition) {
      nodes.push({
        id: `step${i}`,
        x: 300,
        y: i * 220,
        type: 'condition',
        condition: step.condition,
        yes: `yes${i}`,
        no: step.otherwise ? `no${i}` : next,
      });
      nodes.push({ id: `yes${i}`, x: 80, y: i * 220 + 100, type: 'action', action, next });
      if (step.otherwise)
        nodes.push({
          id: `no${i}`,
          x: 530,
          y: i * 220 + 100,
          type: 'action',
          action: step.otherwise,
          next,
        });
    } else nodes.push({ id: `step${i}`, x: 300, y: i * 220, type: 'action', action, next });
  }
  nodes.push({ id: 'end', x: 300, y: saved.steps.length * 220, type: 'end' });
  return validateWorkflowGraph({ version: 2, name: saved.name, entry: 'step0', nodes });
}
export function validateWorkflowGraph(value: unknown): WorkflowGraph {
  const input = value as WorkflowGraph;
  if ((value as { version?: number })?.version === 1)
    return workflowToGraph(value as SavedWorkflow);
  if (
    !input ||
    input.version !== 2 ||
    typeof input.name !== 'string' ||
    !input.name.trim() ||
    input.name.length > 100 ||
    !idOK(input.entry) ||
    !Array.isArray(input.nodes) ||
    !input.nodes.length ||
    input.nodes.length > 60
  )
    throw new Error('Ungültiger Ablauf: Name und 1 bis 60 Knoten erforderlich.');
  const nodes: GraphNode[] = input.nodes.map((node) => {
    if (
      !node ||
      !idOK(node.id) ||
      !Number.isFinite(node.x) ||
      !Number.isFinite(node.y) ||
      node.x < 0 ||
      node.y < 0 ||
      node.x > 4000 ||
      node.y > 10000
    )
      throw new Error('Ungültige Knotenkennung oder Position.');
    const base = { id: node.id, x: node.x, y: node.y };
    if (node.type === 'end') return { ...base, type: 'end' };
    if (node.type === 'action') {
      if (!idOK(node.next)) throw new Error('Ein Arbeitsschritt benötigt einen Folgeknoten.');
      const action = validateWorkflow({ version: 1, name: 'Aktion', steps: [node.action] })
        .steps[0];
      if (action.condition || action.otherwise)
        throw new Error('Bedingungen als eigene Knoten anlegen.');
      return { ...base, type: 'action', action, next: node.next };
    }
    if (node.type === 'condition') {
      if (!idOK(node.yes) || !idOK(node.no))
        throw new Error('Eine Bedingung benötigt einen Ja- und einen Nein-Zweig.');
      const condition = validateWorkflow({
        version: 1,
        name: 'Bedingung',
        steps: [{ kind: 'metadata', condition: node.condition }],
      }).steps[0].condition;
      if (!condition) throw new Error('Die Bedingung fehlt.');
      return { ...base, type: 'condition', condition, yes: node.yes, no: node.no };
    }
    throw new Error('Unbekannter Knotentyp.');
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  if (byId.size !== nodes.length || !byId.has(input.entry))
    throw new Error('Doppelte Knotenkennung oder fehlender Startknoten.');
  const active = new Set<string>(),
    visited = new Set<string>();
  const visit = (id: string) => {
    if (active.has(id))
      throw new Error(
        'Der Arbeitsablauf enthält eine Schleife. Bitte die Verbindungen korrigieren.',
      );
    if (visited.has(id)) return;
    const node = byId.get(id);
    if (!node) throw new Error('Eine Verbindung verweist auf einen fehlenden Knoten.');
    active.add(id);
    if (node.type === 'action') {
      if (node.action.kind === 'protect' && byId.get(node.next)?.type !== 'end')
        throw new Error('Nach Passwortschutz muss das Ende folgen.');
      visit(node.next);
    } else if (node.type === 'condition') {
      visit(node.yes);
      visit(node.no);
    }
    active.delete(id);
    visited.add(id);
  };
  visit(input.entry);
  if (visited.size !== nodes.length)
    throw new Error('Einige Knoten sind vom Start aus nicht erreichbar. Verbinden oder entfernen.');
  return { version: 2, name: input.name.trim(), entry: input.entry, nodes };
}
export async function runWorkflowGraph(
  sources: Source[],
  value: WorkflowGraph,
  password: string,
  ctx: RunContext,
): Promise<ExportFile> {
  const graph = validateWorkflowGraph(value),
    nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  if (!sources.length) throw new Error('Bitte zuerst PDFs öffnen.');
  const zip = new JSZip(),
    names = uniqueNames(sources.map((s) => s.name.replace(/\.pdf$/i, '') + '-bearbeitet.pdf'));
  const log: { file: string; node: string; action?: string; decision?: boolean; next?: string }[] =
    [];
  let totalPages = 0;
  for (const [index, original] of sources.entries()) {
    let current = original,
      owned: Source | undefined,
      bytes = original.bytes,
      next = graph.entry,
      visited = 0;
    try {
      while (true) {
        checkAbort(ctx.signal);
        const node = nodes.get(next)!;
        if (node.type === 'end') {
          log.push({ file: original.name, node: node.id, action: 'Ende' });
          break;
        }
        visited++;
        if (node.type === 'condition') {
          const decision = await conditionMatches(current, node.condition, ctx);
          next = decision ? node.yes : node.no;
          log.push({ file: original.name, node: node.id, decision, next });
          continue;
        }
        bytes = await applyWorkflowAction(current, node.action, password, {
          signal: ctx.signal,
          report: (p) =>
            ctx.report({
              percent:
                ((index + (visited - 1 + p.percent / 100) / graph.nodes.length) / sources.length) *
                100,
              label: `${original.name} · ${stepLabels[node.action.kind]} · ${p.label}`,
            }),
        });
        log.push({
          file: original.name,
          node: node.id,
          action: stepLabels[node.action.kind],
          next: node.next,
        });
        if (node.action.kind !== 'protect') {
          if (owned) await owned.pdf.loadingTask.destroy();
          owned = undefined;
          current = await openSource(
            new File([new Uint8Array(bytes)], original.name, { type: 'application/pdf' }),
          );
          owned = current;
        }
        next = node.next;
      }
      totalPages += current.pdf.numPages;
      zip.file(names[index], bytes);
    } finally {
      if (owned) await owned.pdf.loadingTask.destroy();
    }
  }
  checkAbort(ctx.signal);
  zip.file(
    'MoinPDF-Ablaufprotokoll.json',
    JSON.stringify({ workflow: graph.name, graph, decisions: log }, null, 2),
  );
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  checkAbort(ctx.signal);
  return {
    blob,
    filename: 'PDF-Arbeitsablauf.zip',
    kind: 'zip',
    pages: totalPages,
    note: `${sources.length} Dateien · ${graph.nodes.length} Ablaufknoten · vollständiges Entscheidungsprotokoll`,
  };
}
