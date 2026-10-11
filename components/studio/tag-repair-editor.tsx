'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Choice, Text, NumberField } from './advanced-shared';
import { integratedDocumentServer, runServerJob } from '@/lib/document-server';
import type { Source } from '@/lib/pdf-engine';
export type TagNode = {
  id: string;
  parent: string | null;
  depth: number;
  role: string;
  alt: string;
  language: string;
  scope: string;
  rowSpan: number;
  colSpan: number;
  fieldLabel: string | null;
  children: string[];
  reorderable: boolean;
};
export type TagChange = {
  id: string;
  role?: string;
  alt?: string;
  language?: string;
  scope?: string;
  rowSpan?: number;
  colSpan?: number;
  fieldLabel?: string;
  order?: string[];
};
export type TagRepair = {
  digest: string;
  language: string;
  nodes: TagNode[];
  changes: Record<string, TagChange>;
};
export const tagRepairRequest = (value: TagRepair) => ({
  digest: value.digest,
  language: value.language,
  changes: Object.values(value.changes),
});
const roles = [
  'Document',
  'Part',
  'Sect',
  'Div',
  'P',
  'H',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'BlockQuote',
  'Caption',
  'L',
  'LI',
  'Lbl',
  'LBody',
  'Table',
  'TR',
  'TH',
  'TD',
  'THead',
  'TBody',
  'TFoot',
  'Span',
  'Quote',
  'Note',
  'Reference',
  'BibEntry',
  'Code',
  'Link',
  'Annot',
  'Figure',
  'Formula',
  'Form',
];
export function TagRepairEditor({
  source,
  value,
  onChange,
  run,
  available,
}: {
  source?: Source;
  value: TagRepair | null;
  onChange: (v: TagRepair | null) => void;
  run: (action: (signal: AbortSignal) => Promise<void>) => Promise<void>;
  available: boolean;
}) {
  const [selected, setSelected] = useState('n0');
  const node = value?.nodes.find((n) => n.id === selected) || value?.nodes[0];
  const current = node ? { ...node, ...value?.changes[node.id] } : undefined;
  const change = (patch: Omit<TagChange, 'id'>) => {
    if (value && node)
      onChange({
        ...value,
        changes: {
          ...value.changes,
          [node.id]: { ...value.changes[node.id], id: node.id, ...patch },
        },
      });
  };
  const load = () =>
    run(async (signal) => {
      if (!source || !integratedDocumentServer)
        throw new Error('Bitte eine PDF und den Dokumentenserver verwenden.');
      const body = new FormData();
      body.append(
        'file',
        new Blob([new Uint8Array(source.bytes)], { type: 'application/pdf' }),
        source.name,
      );
      const result = await runServerJob(
        integratedDocumentServer,
        '',
        '/v1/pdfua/structure',
        body,
        signal,
      );
      const parsed = JSON.parse(await result.blob.text()) as Omit<TagRepair, 'changes'>;
      if (
        !/^[a-f0-9]{64}$/.test(parsed.digest) ||
        !Array.isArray(parsed.nodes) ||
        !parsed.nodes.length ||
        parsed.nodes.length > 5000
      )
        throw new Error('Der Strukturbaum konnte nicht vollständig gelesen werden.');
      if (!signal.aborted) {
        onChange({ ...parsed, changes: {} });
        setSelected(parsed.nodes[0].id);
      }
    });
  const order = current?.order || node?.children || [];
  return (
    <div className="accessible-editor">
      <p className="fine-note">
        Vorhandene Tags bei unverändertem Seitenlayout bearbeiten. Eine ungetaggte PDF braucht
        zunächst eine vollständige Strukturierung. Signierte PDFs werden zur Reparatur abgewiesen.
      </p>
      <Button variant="outline" disabled={!source || !available} onClick={() => void load()}>
        Vorhandene PDF-Struktur laden
      </Button>
      {value && node && current && (
        <>
          <Text
            label="Dokumentsprache (z. B. de-DE)"
            value={value.language}
            onChange={(language) => onChange({ ...value, language })}
          />
          <Choice
            label="Strukturknoten"
            value={node.id}
            onChange={setSelected}
            items={value.nodes.map((n) => [
              n.id,
              `${'· '.repeat(Math.min(n.depth, 8))}${n.role} · ${n.id}${n.alt ? ' · ' + n.alt.slice(0, 50) : ''}`,
            ])}
          />
          {node.role !== 'StructTreeRoot' && (
            <Choice
              label="Strukturrolle"
              value={current.role}
              onChange={(role) => change({ role })}
              items={[...new Set([...roles, current.role])].map((role) => [role, role])}
            />
          )}
          <Text label="Alternativtext" value={current.alt} onChange={(alt) => change({ alt })} />
          <Text
            label="Sprache dieses Knotens (leer: vererben)"
            value={current.language}
            onChange={(language) => change({ language })}
          />
          {['TH', 'TD'].includes(current.role) && (
            <>
              <Choice
                label="Tabellenkopf gilt für"
                value={current.scope}
                onChange={(scope) => change({ scope })}
                items={[
                  ['', 'Keine Zuordnung'],
                  ['Column', 'Spalte'],
                  ['Row', 'Zeile'],
                  ['Both', 'Zeile und Spalte'],
                ]}
              />
              <NumberField
                label="Zellenspanne über Zeilen"
                min={1}
                max={1000}
                value={current.rowSpan}
                onChange={(rowSpan) => change({ rowSpan })}
              />
              <NumberField
                label="Zellenspanne über Spalten"
                min={1}
                max={1000}
                value={current.colSpan}
                onChange={(colSpan) => change({ colSpan })}
              />
            </>
          )}
          {node.fieldLabel !== null && (
            <Text
              label="Zugängliche Formularbeschreibung"
              value={current.fieldLabel || ''}
              onChange={(fieldLabel) => change({ fieldLabel })}
            />
          )}
          {node.reorderable && order.length > 1 && (
            <div>
              <p>Lesereihenfolge der untergeordneten Tags</p>
              {order.map((id, index) => (
                <div className="project-version" key={id}>
                  <span>
                    {index + 1}. {value.nodes.find((n) => n.id === id)?.role} · {id}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={index === 0}
                    aria-label={`${id} früher lesen`}
                    onClick={() => {
                      const next = [...order];
                      [next[index - 1], next[index]] = [next[index], next[index - 1]];
                      change({ order: next });
                    }}
                  >
                    Nach oben
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={index === order.length - 1}
                    aria-label={`${id} später lesen`}
                    onClick={() => {
                      const next = [...order];
                      [next[index + 1], next[index]] = [next[index], next[index + 1]];
                      change({ order: next });
                    }}
                  >
                    Nach unten
                  </Button>
                </div>
              ))}
            </div>
          )}
          <p className="fine-note">
            {Object.keys(value.changes).length} geänderte Knoten. Die reparierte PDF wird nur nach
            bestandener maschineller PDF/UA-Prüfung ausgegeben. Alternativtexte, Tabellenbeziehungen
            und Lesereihenfolge anschließend inhaltlich prüfen.
          </p>
        </>
      )}
    </div>
  );
}
