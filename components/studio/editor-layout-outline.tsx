'use client';
import type { Mark } from '@/lib/studio-engine';
import type { Source } from '@/lib/pdf-engine';
import { editorLayoutPlan } from '@/lib/editor-layout-plan';
import { editorMarkChanged, editorTextCollision, type TextTarget } from '@/lib/editor-model';
import { useEditorTypography } from './editor-typography';
import { ui } from '@/lib/ui-language';

export function EditorLayoutOutline({
  mark,
  marks,
  targets,
  source,
  width,
  height,
}: {
  mark: Mark;
  marks: Mark[];
  targets: TextTarget[];
  source: Source;
  width: number;
  height: number;
}) {
  const typography = useEditorTypography(mark, source);
  if (mark.kind !== 'text' || !editorMarkChanged(mark)) return null;
  const runs =
    typography.runs ||
    (typography.resolution
      ? [{ start: 0, end: (mark.text || '').length, style: {}, resolution: typography.resolution }]
      : []);
  const overflow =
    !typography.pending && runs.length > 0 && editorLayoutPlan(mark, width, height, runs).overflow;
  const collision = editorTextCollision(mark, marks, targets);
  const label = typography.error
    ? 'Schrift prüfen'
    : overflow
      ? 'Textfeld zu klein'
      : collision
        ? 'Text überlappt anderen Inhalt'
        : '';
  if (!label) return null;
  return (
    <div
      className="editor-layout-outline"
      style={{
        left: `${mark.x * 100}%`,
        top: `${mark.y * 100}%`,
        width: `${mark.w * 100}%`,
        height: `${mark.h * 100}%`,
      }}
      role="status"
    >
      <span>{ui(label)}</span>
    </div>
  );
}
