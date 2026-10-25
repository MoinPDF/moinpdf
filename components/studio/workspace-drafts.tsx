'use client';
import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  type ReactNode,
  type SetStateAction,
} from 'react';
export type ToolDrafts = Record<string, unknown>;
const DraftContext = createContext<{
  drafts: ToolDrafts;
  setDrafts: React.Dispatch<SetStateAction<ToolDrafts>>;
} | null>(null);
export function WorkspaceDraftProvider({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<ToolDrafts>({});
  return <DraftContext.Provider value={{ drafts, setDrafts }}>{children}</DraftContext.Provider>;
}
export function useWorkspaceDrafts() {
  const context = useContext(DraftContext);
  if (!context) throw new Error('Workspace draft provider is missing.');
  return context;
}
/** Only explicit, non-secret tool fields opt in. Documents/results remain in their own stores. */
export function useToolDraftState<T>(
  key: string,
  initial: T | (() => T),
): [T, React.Dispatch<SetStateAction<T>>] {
  const context = useContext(DraftContext);
  const [fallback, setFallback] = useState(initial);
  const seed = useRef<{ key: string; value: T } | null>(null);
  if (seed.current?.key !== key)
    seed.current = { key, value: typeof initial === 'function' ? (initial as () => T)() : initial };
  const initialValue = seed.current.value;
  const value = context
    ? Object.hasOwn(context.drafts, key)
      ? (context.drafts[key] as T)
      : initialValue
    : fallback;
  const setDrafts = context?.setDrafts;
  const setValue: React.Dispatch<SetStateAction<T>> = useCallback(
    (next) => {
      if (!setDrafts) {
        setFallback(next);
        return;
      }
      setDrafts((previous) => {
        const old = Object.hasOwn(previous, key) ? (previous[key] as T) : initialValue;
        const updated = typeof next === 'function' ? (next as (old: T) => T)(old) : next;
        return { ...previous, [key]: updated };
      });
    },
    [setDrafts, key, initialValue],
  );
  return [value, setValue];
}
