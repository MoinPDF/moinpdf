'use client';

import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';

type Surface = 'home' | 'all';
type Entry = {
  query: string;
  category: string;
  top: number;
  left: number;
  categoryLeft: number;
  tool: string;
};
type Memory = { home: Entry; all: Entry; origin: Surface; restore: Surface | null };
const entry = (category: string): Entry => ({
  query: '',
  category,
  top: 0,
  left: 0,
  categoryLeft: 0,
  tool: '',
});
const Context = createContext<RefObject<Memory> | null>(null);

export function ToolBrowserMemory({ children }: { children: ReactNode }) {
  const memory = useRef<Memory>({
    home: entry('quick'),
    all: entry('all'),
    origin: 'all',
    restore: null,
  });
  return <Context.Provider value={memory}>{children}</Context.Provider>;
}
function useMemory() {
  const memory = useContext(Context);
  if (!memory) throw new Error('ToolBrowserMemory is required');
  return memory;
}
export function useToolNavigation() {
  const memory = useMemory();
  return {
    capture(surface: Surface, tool: string) {
      Object.assign(memory.current[surface], {
        top: window.scrollY,
        left: window.scrollX,
        tool,
        categoryLeft:
          document.querySelector(`[data-tool-browser="${surface}"] [data-browser-categories]`)
            ?.scrollLeft || 0,
      });
      memory.current.origin = surface;
    },
    restore(surface = memory.current.origin) {
      memory.current.restore = surface;
      return surface;
    },
    resetRestore() {
      memory.current.restore = null;
    },
  };
}
export function useToolBrowserState(surface: Surface) {
  const memory = useMemory();
  const [query, setQuery] = useState(() => memory.current[surface].query);
  const [category, setCategory] = useState(() => memory.current[surface].category);
  useLayoutEffect(() => {
    if (memory.current.restore !== surface) return;
    const saved = { ...memory.current[surface] };
    const frame = requestAnimationFrame(() => {
      memory.current.restore = null;
      const root = document.querySelector(`[data-tool-browser="${surface}"]`);
      const target = root?.querySelector<HTMLElement>(`[data-tool-id="${saved.tool}"]`);
      target?.focus({ preventScroll: true });
      const categories = root?.querySelector('[data-browser-categories]');
      if (categories) categories.scrollLeft = saved.categoryLeft;
      window.scrollTo({ top: saved.top, left: saved.left, behavior: 'instant' });
    });
    return () => cancelAnimationFrame(frame);
  }, [memory, surface]);
  return {
    query,
    setQuery(value: string) {
      memory.current[surface].query = value;
      setQuery(value);
    },
    category,
    setCategory(value: string) {
      memory.current[surface].category = value;
      setCategory(value);
    },
  };
}
