import { useState, useRef, useCallback, useEffect, useMemo } from 'react';

const MIN_WIDTH = 60;
const STORAGE_PREFIX = 'firebird-colwidths-';

function loadWidths(storageKey: string): Record<string, number> | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + storageKey);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

function saveWidths(storageKey: string, widths: Record<string, number>) {
  try {
    localStorage.setItem(STORAGE_PREFIX + storageKey, JSON.stringify(widths));
  } catch { /* ignore */ }
}

export function useColumnResize(columnKeys: string[], defaultWidth = 150, storageKey?: string) {
  const [widths, setWidths] = useState<Record<string, number>>(() => {
    const saved = storageKey ? loadWidths(storageKey) : null;
    const init: Record<string, number> = {};
    for (const key of columnKeys) init[key] = saved?.[key] ?? defaultWidth;
    return init;
  });

  // Sync when column keys change (new table/query)
  useEffect(() => {
    const saved = storageKey ? loadWidths(storageKey) : null;
    setWidths((prev) => {
      const next: Record<string, number> = {};
      for (const key of columnKeys) next[key] = saved?.[key] ?? prev[key] ?? defaultWidth;
      return next;
    });
  }, [columnKeys.join(','), defaultWidth, storageKey]);

  const dragRef = useRef<{ key: string; startX: number; startW: number; didMove: boolean } | null>(null);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragRef.current) return;
    dragRef.current.didMove = true;
    const { key, startX, startW } = dragRef.current;
    const newW = Math.max(MIN_WIDTH, startW + (e.clientX - startX));
    setWidths((prev) => ({ ...prev, [key]: newW }));
  }, []);

  const onMouseUp = useCallback(() => {
    const drag = dragRef.current;
    dragRef.current = null;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    // Persist to localStorage after drag ends
    if (drag?.didMove && storageKey) {
      setWidths((current) => {
        saveWidths(storageKey, current);
        return current;
      });
    }

    // Suppress the click event that fires after mouseup to prevent sort trigger
    if (drag?.didMove) {
      const suppress = (e: MouseEvent) => { e.stopPropagation(); e.preventDefault(); };
      document.addEventListener('click', suppress, { capture: true, once: true });
    }
  }, [onMouseMove, storageKey]);

  const startResize = useCallback((key: string, startX: number) => {
    dragRef.current = { key, startX, startW: widths[key] ?? defaultWidth, didMove: false };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [widths, defaultWidth, onMouseMove, onMouseUp]);

  // Total width of all resizable columns
  const totalWidth = useMemo(() => {
    return columnKeys.reduce((sum, key) => sum + (widths[key] ?? defaultWidth), 0);
  }, [columnKeys, widths, defaultWidth]);

  return { widths, startResize, totalWidth };
}
