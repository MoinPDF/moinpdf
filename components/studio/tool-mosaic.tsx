'use client';

import {
  ArrowRightLeft,
  ChevronRight,
  FileText,
  House,
  Layers,
  PenLine,
  ShieldCheck,
} from 'lucide-react';
import type { ToolDefinition, WorkspaceTool } from '@/lib/tool-catalog';

export const mosaicCategoryIcons = [ShieldCheck, ArrowRightLeft, FileText, PenLine, Layers];
export const MosaicHomeIcon = House;

export const mosaicShortcuts: {
  id: WorkspaceTool;
  layout?: 'tile' | 'feature' | 'wide';
  title: [string, string];
  description: [string, string];
}[] = [
  {
    id: 'merge',
    layout: 'feature',
    title: ['PDF zusammenfügen', 'Merge PDFs'],
    description: ['Mehrere PDFs zu einer Datei verbinden.', 'Combine multiple PDFs into one file.'],
  },
  {
    id: 'pdf-word',
    title: ['PDF in Word', 'PDF to Word'],
    description: [
      'PDFs in bearbeitbare Word-Dateien umwandeln.',
      'Convert PDFs into editable Word documents.',
    ],
  },
  {
    id: 'ocr',
    title: ['Text erkennen', 'Recognize text'],
    description: [
      'Text aus PDFs erkennen und durchsuchbar machen.',
      'Recognize text and make PDFs searchable.',
    ],
  },
  {
    id: 'organize',
    layout: 'wide',
    title: ['Seiten sortieren', 'Organize pages'],
    description: [
      'PDF-Seiten neu anordnen, drehen oder entfernen.',
      'Reorder, rotate or remove PDF pages.',
    ],
  },
  {
    id: 'sign',
    title: ['PDF unterschreiben', 'Sign PDF'],
    description: ['Eine Unterschrift in dein PDF einfügen.', 'Add your signature to a PDF.'],
  },
  {
    id: 'batch',
    title: ['Stapelverarbeitung', 'Batch processing'],
    description: ['Mehrere PDFs gleichzeitig bearbeiten.', 'Process multiple PDFs at once.'],
  },
  {
    id: 'numbers',
    title: ['Seitennummern', 'Page numbers'],
    description: ['Seitenzahlen in dein PDF einfügen.', 'Add page numbers to a PDF.'],
  },
  {
    id: 'office-pdf',
    title: ['Office zu PDF', 'Office to PDF'],
    description: [
      'Word, Excel und PowerPoint als PDF speichern.',
      'Save Word, Excel and PowerPoint files as PDFs.',
    ],
  },
  {
    id: 'edit-text',
    layout: 'wide',
    title: ['PDF bearbeiten', 'Edit PDF'],
    description: [
      'Texte direkt ändern, Schriften wählen und Scans bearbeiten.',
      'Edit text directly, choose fonts and work with scanned pages.',
    ],
  },
];

/** Scalable artwork follows the app's line icons; no raster assets or extra requests. */
function ToolArtwork({ tool }: { tool: ToolDefinition }) {
  const common = {
    viewBox: '0 0 96 96',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
    focusable: false as const,
  };
  if (tool.id === 'merge') {
    return (
      <svg {...common}>
        <path
          d="M45 28h22l15 16v40a5 5 0 0 1-5 5H45a5 5 0 0 1-5-5V33a5 5 0 0 1 5-5Z"
          opacity=".42"
          fill="currentColor"
          fillOpacity=".08"
        />
        <g>
          <path
            d="M16 8h29l16 17v46a5 5 0 0 1-5 5H16a5 5 0 0 1-5-5V13a5 5 0 0 1 5-5Z"
            fill="currentColor"
            fillOpacity=".09"
          />
          <path d="M44 9v17h16" />
        </g>
        <circle cx="59" cy="69" r="17" className="mosaic-art-badge" />
        <path d="M51 69h16m-8-8v16" />
      </svg>
    );
  }
  if (tool.id === 'pdf-word') {
    return (
      <svg {...common}>
        <path
          d="M17 8h32l18 18v53a5 5 0 0 1-5 5H17a5 5 0 0 1-5-5V13a5 5 0 0 1 5-5Z"
          fill="currentColor"
          fillOpacity=".08"
        />
        <path d="M48 9v18h18M23 39h24M23 51h17M23 63h13" />
        <rect x="43" y="44" width="43" height="44" rx="6" className="mosaic-art-badge" />
        <path d="m51 57 5 18 8-16 7 16 6-18" strokeWidth="3.8" />
      </svg>
    );
  }
  if (tool.id === 'ocr') {
    return (
      <svg {...common} strokeWidth="5">
        <path d="M12 31V13h19M65 13h19v18M84 65v19H65M31 84H12V65" />
        <path d="M31 37V32h34v5M48 33v34M38 67h20" />
      </svg>
    );
  }
  if (tool.id === 'organize') {
    return (
      <svg {...common} strokeWidth="3.5">
        <rect
          x="57"
          y="28"
          width="28"
          height="57"
          rx="4"
          fill="currentColor"
          fillOpacity=".08"
          opacity=".4"
        />
        <rect
          x="32"
          y="18"
          width="29"
          height="58"
          rx="4"
          className="mosaic-art-badge"
          opacity=".7"
        />
        <rect x="7" y="8" width="30" height="59" rx="4" className="mosaic-art-badge" />
        <path
          d="m18 30 5-4v21M44 40c7-8 12 2 4 8l-5 4h12M69 50h8l-5 6c9-1 8 10-1 8"
          strokeWidth="2.6"
        />
      </svg>
    );
  }
  if (tool.id === 'sign') {
    return (
      <svg {...common}>
        <path d="M9 73c5-20 21-58 29-59 9-1-11 50-20 59-4 5 13-18 19-25 5-6-5 20 0 20 4 0 11-15 13-12 1 2-2 13 5 12l8-5M9 85h69" />
        <path d="m64 51 14-33 10 5-14 33-13 9 3-14Z" fill="currentColor" fillOpacity=".18" />
        <path d="m76 24 10 5" />
      </svg>
    );
  }
  if (tool.id === 'batch') {
    return (
      <svg {...common}>
        <path d="m10 29 38-20 38 20-38 21-38-21Z" fill="currentColor" fillOpacity=".08" />
        <path d="m11 45 37 21 37-21M11 62l37 21 37-21" />
      </svg>
    );
  }
  const Icon = tool.icon;
  return <Icon size={72} strokeWidth={1.35} aria-hidden="true" />;
}

export function ToolMosaicCard({
  tool,
  title = tool.title,
  description = tool.description,
  locked,
  onChoose,
  layout = 'tile',
}: {
  tool: ToolDefinition;
  title?: string;
  description?: string;
  locked: boolean;
  onChoose: (id: WorkspaceTool) => void;
  layout?: 'tile' | 'feature' | 'wide';
}) {
  return (
    <button
      type="button"
      className="tool-mosaic-card"
      data-tool-tone={tool.group}
      data-tool-id={tool.id}
      data-mosaic-layout={layout}
      data-harbor-light
      disabled={locked}
      onClick={() => onChoose(tool.id)}
      title={tool.description}
    >
      <span className="tool-mosaic-art">
        <ToolArtwork tool={tool} />
      </span>
      <span className="tool-mosaic-copy">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <span className="tool-mosaic-arrow" aria-hidden="true">
        <ChevronRight size={21} />
      </span>
      {layout !== 'tile' && (
        <FileText className="tool-mosaic-watermark" aria-hidden="true" strokeWidth={1.2} />
      )}
    </button>
  );
}
