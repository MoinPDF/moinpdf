'use client';
import { createContext, useContext } from 'react';
import type { DownloadResult } from '@/lib/result-details';
import type { SavedResult } from '@/lib/workspace-storage';

export const ResultsContext = createContext<{
  results: SavedResult[];
  remember: (result: DownloadResult) => void;
  remove: (id: string) => void;
  clear: () => void;
}>({ results: [], remember: () => {}, remove: () => {}, clear: () => {} });
export const useWorkspaceResults = () => useContext(ResultsContext);
