import { useState, useRef, useCallback, useLayoutEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type Placement = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  content: ReactNode;
  placement?: Placement;
  delay?: number;
  children: ReactNode;
  className?: string;
}

export function Tooltip({ content, placement = 'top', delay = 300, children, className }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [actualPlacement, setActualPlacement] = useState(placement);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => setVisible(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  useLayoutEffect(() => {
    if (!visible || !triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const gap = 8;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    const positions: Record<Placement, { top: number; left: number }> = {
      top: {
        top: triggerRect.top - tooltipRect.height - gap,
        left: triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2,
      },
      bottom: {
        top: triggerRect.bottom + gap,
        left: triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2,
      },
      left: {
        top: triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2,
        left: triggerRect.left - tooltipRect.width - gap,
      },
      right: {
        top: triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2,
        left: triggerRect.right + gap,
      },
    };

    // Pick placement — only check the axis that matters (we clamp the other axis afterward)
    const fits = (p: Placement) => {
      const pos = positions[p];
      if (p === 'top' || p === 'bottom') {
        return pos.top >= 4 && pos.top + tooltipRect.height <= viewportH - 4;
      }
      return pos.left >= 4 && pos.left + tooltipRect.width <= viewportW - 4;
    };

    const flipMap: Record<Placement, Placement[]> = {
      top: ['top', 'bottom', 'right', 'left'],
      bottom: ['bottom', 'top', 'right', 'left'],
      left: ['left', 'right', 'top', 'bottom'],
      right: ['right', 'left', 'top', 'bottom'],
    };

    const chosen = flipMap[placement].find(fits) ?? placement;
    const pos = positions[chosen];

    // Clamp to viewport
    pos.left = Math.max(4, Math.min(pos.left, viewportW - tooltipRect.width - 4));
    pos.top = Math.max(4, Math.min(pos.top, viewportH - tooltipRect.height - 4));

    setActualPlacement(chosen);
    setCoords(pos);
  }, [visible, placement]);

  if (!content) return <>{children}</>;

  const arrowClasses: Record<Placement, string> = {
    top: 'left-1/2 -translate-x-1/2 -bottom-1 rotate-45',
    bottom: 'left-1/2 -translate-x-1/2 -top-1 rotate-45',
    left: 'top-1/2 -translate-y-1/2 -right-1 rotate-45',
    right: 'top-1/2 -translate-y-1/2 -left-1 rotate-45',
  };

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className={`inline-flex ${className ?? ''}`}
      >
        {children}
      </div>
      {visible && createPortal(
        <div
          ref={tooltipRef}
          role="tooltip"
          className="fixed z-[99999] px-2.5 py-1.5 text-[11px] font-medium leading-tight rounded-lg shadow-lg pointer-events-none bg-[#1e293b] text-[#f1f5f9] dark:bg-[#2a2f3e] dark:text-[#c8cdd7] dark:border dark:border-[#3a4050] animate-tooltip-in whitespace-nowrap"
          style={{ top: coords.top, left: coords.left }}
        >
          {content}
          <div className={`absolute w-2 h-2 bg-[#1e293b] dark:bg-[#2a2f3e] dark:border-[#3a4050] ${arrowClasses[actualPlacement]}`} />
        </div>,
        document.body,
      )}
    </>
  );
}
