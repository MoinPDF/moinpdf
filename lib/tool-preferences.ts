import type { WorkspaceTool } from './tool-catalog';

export const TOOL_PREFERENCES_KEY = 'moinpdf-tool-preferences-v1';
export const TOOL_PREFERENCES_EVENT = 'moinpdf-tool-preferences';
export const defaultFavorites: WorkspaceTool[] = [
  'edit-text',
  'merge',
  'compress',
  'ocr',
  'sign',
  'pdf-word',
];
export type ToolPreferences = { favorites: WorkspaceTool[]; recent: WorkspaceTool[] };

/** Store tool IDs only: no filenames, document contents or usage timestamps. */
export function parseToolPreferences(
  raw: string | null,
  available: readonly string[],
): ToolPreferences {
  const valid = new Set(available);
  const clean = (value: unknown, limit: number) =>
    Array.isArray(value)
      ? [
          ...new Set(
            value.filter((id): id is WorkspaceTool => typeof id === 'string' && valid.has(id)),
          ),
        ].slice(0, limit)
      : [];
  const fallback = defaultFavorites.filter((id) => valid.has(id));
  try {
    const value = JSON.parse(raw || '{}');
    if (!value || typeof value !== 'object') return { favorites: fallback, recent: [] };
    const favorites = clean(value.favorites, 6);
    return { favorites: favorites.length ? favorites : fallback, recent: clean(value.recent, 5) };
  } catch {
    return { favorites: fallback, recent: [] };
  }
}

export function recordToolUse(preferences: ToolPreferences, id: WorkspaceTool): ToolPreferences {
  return {
    ...preferences,
    recent: [id, ...preferences.recent.filter((tool) => tool !== id)].slice(0, 5),
  };
}
