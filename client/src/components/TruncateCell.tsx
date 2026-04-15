import { useState, useRef, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface TruncateCellProps {
  children: ReactNode;
  /** Plain text value for tooltip display. Falls back to children if not provided. */
  value?: string;
}

export function TruncateCell({ children, value }: TruncateCellProps) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const [tip, setTip] = useState<{ text: string; top: number; left: number } | null>(null);

  const handleEnter = useCallback(() => {
    const el = spanRef.current;
    if (!el) return;
    if (el.scrollWidth <= el.clientWidth) return; // not truncated
    const rect = el.getBoundingClientRect();
    const text = value ?? el.textContent ?? '';
    setTip({ text, top: rect.top, left: rect.left + rect.width / 2 });
  }, [value]);

  const handleLeave = useCallback(() => setTip(null), []);

  return (
    <>
      <span
        ref={spanRef}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className="block truncate"
      >
        {children}
      </span>
      {tip && createPortal(
        <div
          className="fixed z-[99999] px-2.5 py-1.5 text-[11px] font-mono leading-relaxed rounded-lg shadow-lg pointer-events-none bg-[#1e293b] text-[#f1f5f9] dark:bg-[#2a2f3e] dark:text-[#c8cdd7] dark:border dark:border-[#3a4050] animate-tooltip-in max-w-md whitespace-pre-wrap break-all"
          style={{ top: tip.top - 8, left: tip.left, transform: 'translate(-50%, -100%)' }}
        >
          {tip.text}
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-[#1e293b] dark:bg-[#2a2f3e] rotate-45" />
        </div>,
        document.body,
      )}
    </>
  );
}
