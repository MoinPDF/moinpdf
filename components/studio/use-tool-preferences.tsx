'use client';
import { useCallback, useEffect, useState } from 'react';
import { useTools } from './appearance';
import type { WorkspaceTool } from '@/lib/tool-catalog';
import {
  defaultFavorites,
  parseToolPreferences,
  recordToolUse,
  TOOL_PREFERENCES_EVENT,
  TOOL_PREFERENCES_KEY,
  type ToolPreferences,
} from '@/lib/tool-preferences';

let session: ToolPreferences | undefined;
function read(ids: string[]) {
  if (session) return parseToolPreferences(JSON.stringify(session), ids);
  try {
    return parseToolPreferences(window.localStorage.getItem(TOOL_PREFERENCES_KEY), ids);
  } catch {
    return parseToolPreferences(JSON.stringify(session), ids);
  }
}
function write(value: ToolPreferences) {
  session = value;
  try {
    window.localStorage.setItem(TOOL_PREFERENCES_KEY, JSON.stringify(value));
  } catch {
    /* Session-only when storage is blocked. */
  }
  window.dispatchEvent(new CustomEvent(TOOL_PREFERENCES_EVENT, { detail: value }));
}
export function useToolPreferences() {
  const { tools } = useTools();
  const signature = tools.map((tool) => tool.id).join(',');
  const [value, setValue] = useState<ToolPreferences>({ favorites: defaultFavorites, recent: [] });
  useEffect(() => {
    const ids = signature.split(',');
    setValue(read(ids));
    const sync = (event: Event) => {
      if (
        event instanceof window.StorageEvent &&
        event.key !== TOOL_PREFERENCES_KEY &&
        event.key !== null
      )
        return;
      if (event instanceof window.StorageEvent) session = undefined;
      setValue(
        event instanceof window.CustomEvent
          ? parseToolPreferences(JSON.stringify(event.detail), ids)
          : read(ids),
      );
    };
    window.addEventListener(TOOL_PREFERENCES_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(TOOL_PREFERENCES_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [signature]);
  const setFavorites = useCallback(
    (favorites: WorkspaceTool[]) => {
      const ids = signature.split(',');
      write(parseToolPreferences(JSON.stringify({ ...read(ids), favorites }), ids));
    },
    [signature],
  );
  const record = useCallback(
    (id: WorkspaceTool) => {
      if (signature.split(',').includes(id)) write(recordToolUse(read(signature.split(',')), id));
    },
    [signature],
  );
  return { ...value, setFavorites, record };
}
