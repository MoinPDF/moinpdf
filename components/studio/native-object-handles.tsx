'use client';
import { useRef, type PointerEvent } from 'react';
import type { NativeObject } from '@/lib/native-pdf';
type Transform = { dx: number; dy: number; scale: number; rotation: number };
export function NativeObjectHandles({
  objects,
  object,
  value,
  onChange,
  onSelect,
  disabled,
}: {
  objects: NativeObject[];
  object?: NativeObject;
  value: Transform;
  onChange: (v: Transform) => void;
  onSelect: (id: number) => void;
  disabled: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    kind: 'move' | 'scale' | 'rotate';
    x: number;
    y: number;
    cx: number;
    cy: number;
    radius: number;
    value: Transform;
  } | null>(null);
  const start = (kind: 'move' | 'scale' | 'rotate', event: PointerEvent<HTMLButtonElement>) => {
    if (disabled || !object || !root.current) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const r = root.current.getBoundingClientRect(),
      cx = r.left + (object.x + object.w / 2 + value.dx / 100) * r.width,
      cy = r.top + (object.y + object.h / 2 + value.dy / 100) * r.height;
    drag.current = {
      kind,
      x: event.clientX,
      y: event.clientY,
      cx,
      cy,
      radius: Math.hypot(event.clientX - cx, event.clientY - cy),
      value,
    };
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current,
      r = root.current?.getBoundingClientRect();
    if (!d || !r) return;
    if (d.kind === 'move')
      onChange({
        ...d.value,
        dx: Math.max(-100, Math.min(100, d.value.dx + ((event.clientX - d.x) / r.width) * 100)),
        dy: Math.max(-100, Math.min(100, d.value.dy + ((event.clientY - d.y) / r.height) * 100)),
      });
    if (d.kind === 'scale')
      onChange({
        ...d.value,
        scale: Math.max(
          10,
          Math.min(
            1000,
            (d.value.scale * Math.hypot(event.clientX - d.cx, event.clientY - d.cy)) /
              Math.max(1, d.radius),
          ),
        ),
      });
    if (d.kind === 'rotate')
      onChange({
        ...d.value,
        rotation:
          ((d.value.rotation +
            ((Math.atan2(event.clientY - d.cy, event.clientX - d.cx) -
              Math.atan2(d.y - d.cy, d.x - d.cx)) *
              180) /
              Math.PI +
            540) %
            360) -
          180,
      });
  };
  const stop = () => {
    drag.current = null;
  };
  const pointer = { onPointerMove: move, onPointerUp: stop, onPointerCancel: stop };
  return (
    <div
      ref={root}
      style={{ position: 'absolute', inset: 0 }}
      onPointerDown={(event) => {
        if (disabled || event.target !== event.currentTarget) return;
        const r = event.currentTarget.getBoundingClientRect(),
          x = (event.clientX - r.left) / r.width,
          y = (event.clientY - r.top) / r.height;
        const selected = [...objects]
          .reverse()
          .find((o) => x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h);
        if (selected) onSelect(selected.index);
      }}
    >
      {object && (
        <div
          style={{
            position: 'absolute',
            left:
              (object.x + object.w / 2 + value.dx / 100 - (object.w * value.scale) / 200) * 100 +
              '%',
            top:
              (object.y + object.h / 2 + value.dy / 100 - (object.h * value.scale) / 200) * 100 +
              '%',
            width: object.w * value.scale + '%',
            height: object.h * value.scale + '%',
            transform: `rotate(${value.rotation}deg)`,
            border: '2px solid #176c64',
            boxSizing: 'border-box',
            pointerEvents: 'none',
          }}
        >
          <button
            type="button"
            disabled={disabled}
            aria-label="Objekt auf der Seite verschieben"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              minHeight: 10,
              background: 'rgba(23,108,100,.12)',
              pointerEvents: 'auto',
              touchAction: 'none',
              cursor: 'move',
            }}
            onPointerDown={(e) => start('move', e)}
            {...pointer}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 2 : 0.5;
              if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                e.preventDefault();
                onChange({
                  ...value,
                  dx: Math.max(
                    -100,
                    Math.min(
                      100,
                      value.dx +
                        (e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0),
                    ),
                  ),
                  dy: Math.max(
                    -100,
                    Math.min(
                      100,
                      value.dy + (e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0),
                    ),
                  ),
                });
              }
            }}
          />
          <button
            type="button"
            disabled={disabled}
            aria-label="Objekt proportional skalieren"
            style={{
              position: 'absolute',
              right: -9,
              bottom: -9,
              width: 18,
              height: 18,
              background: '#176c64',
              border: '2px solid white',
              pointerEvents: 'auto',
              touchAction: 'none',
              cursor: 'nwse-resize',
            }}
            onPointerDown={(e) => start('scale', e)}
            {...pointer}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                onChange({
                  ...value,
                  scale: Math.max(10, Math.min(1000, value.scale + (e.key === 'ArrowUp' ? 5 : -5))),
                });
              }
            }}
          />
          <button
            type="button"
            disabled={disabled}
            aria-label="Objekt drehen"
            style={{
              position: 'absolute',
              left: 'calc(50% - 9px)',
              top: -28,
              width: 18,
              height: 18,
              borderRadius: 9,
              background: '#176c64',
              border: '2px solid white',
              pointerEvents: 'auto',
              touchAction: 'none',
              cursor: 'grab',
            }}
            onPointerDown={(e) => start('rotate', e)}
            {...pointer}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                onChange({
                  ...value,
                  rotation: Math.max(
                    -360,
                    Math.min(360, value.rotation + (e.key === 'ArrowRight' ? 5 : -5)),
                  ),
                });
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
