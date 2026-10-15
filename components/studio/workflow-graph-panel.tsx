'use client';
import { ui } from '@/lib/ui-language';
import { useLanguage } from '@/components/studio/appearance';

import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Choice, Text, NumberField, type PanelProps } from './advanced-shared';
import { stepLabels, type StepKind } from '@/lib/advanced-pipeline';
import {
  validateWorkflowGraph,
  runWorkflowGraph,
  type WorkflowGraph,
  type GraphNode,
} from '@/lib/workflow-graph';
import { downloadBlob, uid } from '@/lib/pdf-engine';
const key = 'moinpdf.workflows.graphs.v2';
export function WorkflowGraphPanel({
  value,
  onChange,
  onBack,
  sources,
  busy,
  run,
}: { value: WorkflowGraph; onChange: (v: WorkflowGraph) => void; onBack: () => void } & Pick<
  PanelProps,
  'sources' | 'busy' | 'run'
>) {
  useLanguage();
  const [selected, setSelected] = useState(value.entry),
    [notice, setNotice] = useState(''),
    [password, setPassword] = useState(''),
    [saved, setSaved] = useState<WorkflowGraph[]>([]);
  const input = useRef<HTMLInputElement>(null),
    drag = useRef<{
      id: string;
      clientX: number;
      clientY: number;
      x: number;
      y: number;
      scale: number;
    } | null>(null);
  useEffect(() => {
    try {
      const values = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(values)) setSaved(values.slice(0, 30).map(validateWorkflowGraph));
    } catch {
      setNotice('Gespeicherte Knotendiagramme konnten nicht geladen werden.');
    }
  }, []);
  const node = value.nodes.find((n) => n.id === selected) || value.nodes[0];
  const setNode = (next: GraphNode) =>
    onChange({ ...value, nodes: value.nodes.map((n) => (n.id === next.id ? next : n)) });
  const width = Math.max(950, ...value.nodes.map((n) => n.x + 260)),
    height = Math.max(350, ...value.nodes.map((n) => n.y + 120));
  const available = value.nodes
    .filter((n) => n.id !== node.id)
    .map(
      (n) =>
        [
          n.id,
          `${n.id} · ${ui(n.type === 'action' ? ui(stepLabels[n.action.kind]) : n.type === 'condition' ? 'Bedingung' : 'Ende')}`,
        ] as [string, string],
    );
  const validate = () => validateWorkflowGraph(value);
  const attempt = (f: () => void) => {
    try {
      setNotice('');
      f();
    } catch (e) {
      setNotice((e as Error).message);
    }
  };
  return (
    <div className="advanced-grid">
      <section className="advanced-card">
        <Button variant="outline" disabled={busy} onClick={onBack}>
          {ui('Zur Schrittliste')}
        </Button>
        <h2>{ui('Freies Ablaufdiagramm')}</h2>
        <Text
          label={ui('Name des Arbeitsablaufs')}
          value={value.name}
          onChange={(name) => onChange({ ...value, name })}
        />
        <p className="fine-note">
          {ui(
            'Knoten ziehen oder ihre Position eingeben. Verbindungen rechts festlegen. Jede Bedingung besitzt einen Ja- und Nein-Zweig; weitere Bedingungen können in beiden Zweigen folgen. Vor der Ausführung werden Schleifen, fehlende Ziele und unerreichbare Knoten geprüft.',
          )}
        </p>
        <div
          style={{
            maxHeight: 520,
            overflow: 'auto',
            border: '1px solid var(--border)',
            borderRadius: 12,
          }}
        >
          <svg
            role="img"
            aria-label={ui('Arbeitsablauf als Knotendiagramm')}
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            style={{ touchAction: 'none' }}
            onPointerMove={(event) => {
              const active = drag.current;
              if (!active || busy) return;
              const found = value.nodes.find((n) => n.id === active.id);
              if (found)
                setNode({
                  ...found,
                  x: Math.round(
                    Math.min(
                      4000,
                      Math.max(0, active.x + (event.clientX - active.clientX) * active.scale),
                    ),
                  ),
                  y: Math.round(
                    Math.min(
                      10000,
                      Math.max(0, active.y + (event.clientY - active.clientY) * active.scale),
                    ),
                  ),
                });
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
          >
            <defs>
              <marker
                id="workflow-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
              </marker>
            </defs>
            {value.nodes.flatMap((n) =>
              n.type === 'end'
                ? []
                : (n.type === 'action'
                    ? [[n.next, '']]
                    : [
                        [n.yes, 'Ja'],
                        [n.no, 'Nein'],
                      ]
                  ).map(([target, label], index) => {
                    const dest = value.nodes.find((item) => item.id === target);
                    if (!dest) return null;
                    const x = n.x + 110 + (label ? (index === 0 ? -50 : 50) : 0),
                      y = n.y + 70,
                      tx = dest.x + 110,
                      ty = dest.y + 10;
                    return (
                      <g
                        key={n.id + '-' + index}
                        style={{ color: label === 'Nein' ? '#b45309' : '#148179' }}
                      >
                        <path
                          d={`M ${x} ${y} C ${x} ${y + 55}, ${tx} ${ty - 55}, ${tx} ${ty}`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          markerEnd="url(#workflow-arrow)"
                        />
                        <text x={x + 5} y={y + 22} fill="currentColor" fontSize="13">
                          {ui(label)}
                        </text>
                      </g>
                    );
                  }),
            )}
            {value.nodes.map((n) => (
              <g
                key={n.id}
                transform={`translate(${n.x},${n.y + 10})`}
                role="button"
                tabIndex={0}
                aria-label={`${n.id}: ${n.type === 'action' ? ui(stepLabels[n.action.kind]) : n.type === 'condition' ? ui('Bedingung') : ui('Ende')}`}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelected(n.id);
                  }
                }}
                onPointerDown={(event) => {
                  if (busy) return;
                  setSelected(n.id);
                  const svg = event.currentTarget.ownerSVGElement!;
                  svg.setPointerCapture(event.pointerId);
                  drag.current = {
                    id: n.id,
                    clientX: event.clientX,
                    clientY: event.clientY,
                    x: n.x,
                    y: n.y,
                    scale: width / svg.getBoundingClientRect().width,
                  };
                }}
              >
                <rect
                  width="220"
                  height="60"
                  rx={n.type === 'condition' ? 25 : 10}
                  fill={selected === n.id ? '#e0f4ee' : '#fff'}
                  stroke={selected === n.id ? '#087d70' : '#64748b'}
                  strokeWidth={selected === n.id ? 3 : 1.5}
                />
                <text x="12" y="22" fill="#334155" fontSize="12">
                  {n.id}
                  {value.entry === n.id ? ui(' · Start') : ''}
                </text>
                <text x="12" y="44" fill="#0f172a" fontSize="14">
                  {n.type === 'action'
                    ? ui(stepLabels[n.action.kind])
                    : n.type === 'condition'
                      ? `${n.condition.field} ${n.condition.operator}`
                      : ui('Ende')}
                </text>
              </g>
            ))}
          </svg>
        </div>
        <div className="project-actions">
          <Button
            variant="outline"
            disabled={busy || value.nodes.length >= 60}
            onClick={() => {
              const id = 'node_' + uid().slice(0, 8),
                end = value.nodes.find((n) => n.type === 'end')?.id || '';
              onChange({
                ...value,
                nodes: [
                  ...value.nodes,
                  {
                    id,
                    x: 50,
                    y: Math.min(9800, height),
                    type: 'action',
                    action: { kind: 'stamp', text: 'GEPRÜFT' },
                    next: end,
                  },
                ],
              });
              setSelected(id);
            }}
          >
            {ui('Knoten hinzufügen')}
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              attempt(() => {
                validate();
                setNotice('Alle Verbindungen sind gültig.');
              })
            }
          >
            {ui('Verbindungen prüfen')}
          </Button>
        </div>
      </section>
      <section className="advanced-card">
        <h3>{ui('Knoten bearbeiten')}</h3>
        <Choice
          label={ui('Ausgewählter Knoten')}
          value={node.id}
          onChange={setSelected}
          items={value.nodes.map((n) => [n.id, n.id])}
          translateItems={false}
        />
        <Choice
          label={ui('Startknoten')}
          value={value.entry}
          onChange={(entry) => onChange({ ...value, entry })}
          items={value.nodes.map((n) => [n.id, n.id])}
          translateItems={false}
        />
        <Choice
          label={ui('Knotentyp')}
          value={node.type}
          onChange={(type) => {
            const base = { id: node.id, x: node.x, y: node.y },
              end = value.nodes.find((n) => n.type === 'end' && n.id !== node.id)?.id || '';
            setNode(
              type === 'end'
                ? { ...base, type: 'end' }
                : type === 'condition'
                  ? {
                      ...base,
                      type: 'condition',
                      condition: { field: 'filename', operator: 'contains', value: 'Rechnung' },
                      yes: end,
                      no: end,
                    }
                  : {
                      ...base,
                      type: 'action',
                      action: { kind: 'stamp', text: 'GEPRÜFT' },
                      next: end,
                    },
            );
          }}
          items={[
            ['action', 'Arbeitsschritt'],
            ['condition', 'Wenn / Sonst'],
            ['end', 'Ende'],
          ]}
        />
        <div className="pro-rule">
          <NumberField
            label={ui('Horizontale Position')}
            value={node.x}
            min={0}
            max={4000}
            onChange={(x) => setNode({ ...node, x })}
          />
          <NumberField
            label={ui('Vertikale Position')}
            value={node.y}
            min={0}
            max={10000}
            onChange={(y) => setNode({ ...node, y })}
          />
        </div>
        {node.type === 'action' && (
          <>
            <Choice
              label={ui('Aktion')}
              value={node.action.kind}
              onChange={(kind) => setNode({ ...node, action: { kind: kind as StepKind } })}
              items={Object.entries(stepLabels)}
            />
            {['stamp', 'watermark'].includes(node.action.kind) && (
              <Text
                label={ui('Text der Aktion')}
                value={node.action.text || ''}
                onChange={(text) => setNode({ ...node, action: { ...node.action, text } })}
              />
            )}
            {node.action.kind === 'numbers' && (
              <NumberField
                label={ui('Startnummer')}
                value={node.action.number || 1}
                min={1}
                max={999999}
                onChange={(number) => setNode({ ...node, action: { ...node.action, number } })}
              />
            )}
            <Choice
              label={ui('Danach')}
              value={node.next}
              onChange={(next) => setNode({ ...node, next })}
              items={available}
              translateItems={false}
            />
          </>
        )}
        {node.type === 'condition' && (
          <>
            <Choice
              label={ui('Bedingung prüft')}
              value={node.condition.field}
              onChange={(field) =>
                setNode({
                  ...node,
                  condition: {
                    field: field as 'filename' | 'text' | 'pages',
                    operator: field === 'pages' ? 'gte' : 'contains',
                    value: field === 'pages' ? '2' : 'Rechnung',
                  },
                })
              }
              items={[
                ['filename', 'Dateiname'],
                ['text', 'Vorhandener Text'],
                ['pages', 'Seitenzahl'],
              ]}
            />
            <Choice
              label={ui('Vergleich')}
              value={node.condition.operator}
              onChange={(operator) =>
                setNode({
                  ...node,
                  condition: {
                    ...node.condition,
                    operator: operator as typeof node.condition.operator,
                  },
                })
              }
              items={
                node.condition.field === 'pages'
                  ? [
                      ['gte', 'Mindestens'],
                      ['lt', 'Weniger als'],
                    ]
                  : [
                      ['contains', 'Enthält'],
                      ['notContains', 'Enthält nicht'],
                    ]
              }
            />
            <Text
              label={ui('Vergleichswert')}
              value={node.condition.value}
              onChange={(text) =>
                setNode({ ...node, condition: { ...node.condition, value: text } })
              }
            />
            <Choice
              label={ui('Bei Ja')}
              value={node.yes}
              onChange={(yes) => setNode({ ...node, yes })}
              items={available}
              translateItems={false}
            />
            <Choice
              label={ui('Bei Nein')}
              value={node.no}
              onChange={(no) => setNode({ ...node, no })}
              items={available}
              translateItems={false}
            />
          </>
        )}
        <Button
          variant="outline"
          disabled={busy || value.nodes.length === 1}
          onClick={() => {
            onChange({ ...value, nodes: value.nodes.filter((n) => n.id !== node.id) });
            setSelected(value.nodes.find((n) => n.id !== node.id)!.id);
          }}
        >
          {ui('Knoten entfernen')}
        </Button>
        {value.nodes.some((n) => n.type === 'action' && n.action.kind === 'protect') && (
          <Text
            label={ui('Ergebnispasswort (wird nicht im Ablauf gespeichert)')}
            type="password"
            value={password}
            onChange={setPassword}
          />
        )}
        <div className="project-actions">
          <Button
            disabled={busy || !sources.length}
            onClick={() => run((ctx) => runWorkflowGraph(sources, validate(), password, ctx))}
          >
            {ui('Ablauf auf alle Dateien anwenden')}
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              attempt(() => {
                const current = validate(),
                  next = [current, ...saved.filter((v) => v.name !== current.name)].slice(0, 30);
                localStorage.setItem(key, JSON.stringify(next));
                setSaved(next);
              })
            }
          >
            {ui('Ablauf speichern')}
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              attempt(() =>
                downloadBlob(
                  new Blob([JSON.stringify(validate(), null, 2)], { type: 'application/json' }),
                  'MoinPDF-Knotendiagramm.json',
                ),
              )
            }
          >
            {ui('JSON exportieren')}
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => input.current?.click()}>
            {ui('JSON importieren')}
          </Button>
          <input
            className="sr-only"
            ref={input}
            type="file"
            accept=".json,application/json"
            aria-label={ui('Arbeitsablauf importieren')}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (!file) return;
              try {
                if (file.size > 100000) throw new Error('Die Ablaufdatei ist zu groß.');
                const graph = validateWorkflowGraph(JSON.parse(await file.text()));
                onChange(graph);
                setSelected(graph.entry);
                setNotice('');
              } catch (error) {
                setNotice((error as Error).message);
              }
            }}
          />
        </div>
        {saved.length > 0 && (
          <Choice
            label={ui('Gespeichertes Diagramm laden')}
            value=""
            onChange={(name) => {
              const graph = saved.find((g) => g.name === name);
              if (graph) {
                onChange(graph);
                setSelected(graph.entry);
              }
            }}
            items={[
              ['', ui('Auswählen')],
              ...saved.map((g) => [g.name, g.name] as [string, string]),
            ]}
            translateItems={false}
          />
        )}
        {notice && <p role="status">{ui(notice)}</p>}
      </section>
    </div>
  );
}
