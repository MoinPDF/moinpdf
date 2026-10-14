'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { Check } from 'lucide-react';
import { fileArrivals, RESULT_FEEDBACK_MS } from '@/lib/ui-feedback';

/** Reserve a little room so showing and clearing the check never shifts the filename. */
export function FileArrivalCheck({ file }: { file: object }) {
  const recent = useSyncExternalStore(
    fileArrivals.subscribe,
    fileArrivals.getSnapshot,
    fileArrivals.getServerSnapshot,
  );
  return (
    <Check
      className="file-arrival-check"
      data-arrived={recent.has(file) || undefined}
      size={14}
      aria-hidden="true"
    />
  );
}

/** A result identity is acknowledged once; errors, cancellation and progress never trigger it. */
export function useFreshResult(result: object | null) {
  const [settled, setSettled] = useState<object | null>(null);
  useEffect(() => {
    setSettled(null);
    if (!result) return;
    const timer = window.setTimeout(() => setSettled(result), RESULT_FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [result]);
  return result !== null && settled !== result;
}

export function JobStatusIcon({
  working = false,
  fresh = false,
  size = 22,
}: {
  working?: boolean;
  fresh?: boolean;
  size?: number;
}) {
  return (
    <svg
      className="job-status-icon"
      data-state={working ? 'working' : 'done'}
      data-fresh={fresh || undefined}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle className="job-status-ring" cx="12" cy="12" r="9" pathLength="100" />
      <path className="job-status-check" d="m6 12 4 4 8-8" pathLength="1" />
    </svg>
  );
}

export function resultScrollBehavior(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
}
