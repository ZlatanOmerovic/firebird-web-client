import { useRef, useEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Checkbox } from './Checkbox';

interface SelectAllPopoverProps {
  totalCount: number;
  pageCount: number;
  visible: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onSelectAll: () => void;
  onClose: () => void;
  itemLabel: string;
}

export function SelectAllPopover({ totalCount, pageCount, visible, anchorRef, onSelectAll, onClose, itemLabel }: SelectAllPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  // Position relative to anchor
  useEffect(() => {
    if (!visible || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setCoords({
      top: rect.top + rect.height / 2,
      left: rect.right + 10,
    });
  }, [visible, anchorRef]);

  // Click outside to dismiss
  useEffect(() => {
    if (!visible) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to avoid immediate dismiss from the checkbox click that opened it
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 50);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler); };
  }, [visible, onClose]);

  if (!visible || totalCount <= pageCount) return null;

  const plural = totalCount === 1 ? itemLabel : itemLabel + 's';

  return createPortal(
    <div
      ref={popoverRef}
      className="fixed z-[99998] animate-tooltip-in"
      style={{ top: coords.top, left: coords.left, transform: 'translateY(-50%)' }}
    >
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-bg-secondary border border-accent/30 rounded-lg shadow-xl">
        <Checkbox
          checked={false}
          onChange={() => onSelectAll()}
        />
        <span className="text-xs text-text-primary whitespace-nowrap">
          Select all <span className="font-semibold font-mono tabular-nums text-accent">{totalCount.toLocaleString()}</span> {plural}
        </span>
      </div>
      {/* Arrow pointing left */}
      <div className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-2.5 h-2.5 bg-bg-secondary border-l border-b border-accent/30 rotate-45" />
    </div>,
    document.body,
  );
}
