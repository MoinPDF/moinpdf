'use client';

import { useId } from 'react';
import type { ToolDefinition } from '@/lib/tool-catalog';

export function HomeToolIcon({ id, icon: Icon }: Pick<ToolDefinition, 'id' | 'icon'>) {
  const gradient = useId();
  const artwork = ['merge', 'compress', 'pdf-word', 'edit-text', 'ocr', 'html-pdf'].includes(id);
  if (!artwork) return <Icon size={27} strokeWidth={1.6} aria-hidden="true" />;
  const colors =
    id === 'compress'
      ? ['#9bd4ab', '#4b9e72']
      : id === 'pdf-word'
        ? ['#619ac4', '#326e9f']
        : ['#79b8b3', '#398a85'];
  return (
    <svg
      className="harbor-document-icon"
      width="36"
      height="36"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradient} x1="8" y1="6" x2="37" y2="43" gradientUnits="userSpaceOnUse">
          <stop stopColor={colors[0]} />
          <stop offset="1" stopColor={colors[1]} />
        </linearGradient>
      </defs>
      {id === 'merge' && (
        <>
          <path
            d="M11 5h12l7 7v21a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
            fill={`url(#${gradient})`}
            opacity=".65"
          />
          <path d="M23 5v7h7" fill="#fff" fillOpacity=".22" />
          <path
            d="M22 17h12l7 7v18a2 2 0 0 1-2 2H22a2 2 0 0 1-2-2V19a2 2 0 0 1 2-2Z"
            fill={`url(#${gradient})`}
            stroke="#fff"
            strokeOpacity=".15"
          />
          <path d="M34 17v7h7" fill="#fff" fillOpacity=".3" />
        </>
      )}
      {id === 'compress' && (
        <>
          <path
            d="M13 5h16l9 9v27a2 2 0 0 1-2 2H13a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
            fill={`url(#${gradient})`}
            stroke="#fff"
            strokeOpacity=".18"
          />
          <path d="M29 5v9h9" fill="#fff" fillOpacity=".32" />
          <path
            d="M24 20v14m-6-6 6 6 6-6"
            stroke="#205b40"
            strokeWidth="2.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      {id === 'pdf-word' && (
        <>
          <rect x="17" y="6" width="26" height="36" rx="3" fill="#dce7ec" />
          <path d="M24 14h12m-12 7h12m-12 7h12m-12 7h12" stroke="#8fa9b6" strokeWidth="2" />
          <rect x="5" y="16" width="25" height="26" rx="3" fill={`url(#${gradient})`} />
          <path
            d="m10 23 3.5 13 4-10 4 10L25 23"
            stroke="#fff"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      {id === 'edit-text' && (
        <g className="harbor-document-outline" stroke="currentColor" strokeLinecap="round">
          <rect x="7" y="7" width="34" height="34" rx="5" strokeWidth="1.6" strokeDasharray="4 3" />
          <path d="M16 19v-3h16v3m-8-3v18m-6 0h12" strokeWidth="2.5" />
        </g>
      )}
      {id === 'ocr' && (
        <g
          className="harbor-document-outline"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <path d="M16 7H8v8m24-8h8v8M8 33v8h8m24-8v8h-8" />
          <text
            x="24"
            y="29"
            fill="currentColor"
            stroke="none"
            fontFamily="inherit"
            fontWeight="650"
            fontSize="12"
            textAnchor="middle"
          >
            OCR
          </text>
        </g>
      )}
      {id === 'html-pdf' && (
        <g className="harbor-document-outline" stroke="currentColor" strokeWidth="1.8">
          <circle cx="24" cy="24" r="17" />
          <ellipse cx="24" cy="24" rx="7" ry="17" />
          <path d="M8 18h32M8 30h32" />
        </g>
      )}
    </svg>
  );
}
