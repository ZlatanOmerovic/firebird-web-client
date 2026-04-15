import { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Tooltip } from './Tooltip';

interface PaginationBarProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** Extra content on the right side */
  suffix?: React.ReactNode;
}

export function PaginationBar({ page, totalPages, total, pageSize, onPageChange, suffix }: PaginationBarProps) {
  const [jumpValue, setJumpValue] = useState('');
  const [jumpError, setJumpError] = useState(false);

  if (totalPages <= 1 && !suffix) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const handleJump = () => {
    const num = parseInt(jumpValue, 10);
    if (isNaN(num) || num < 1 || num > totalPages) {
      setJumpError(true);
      setTimeout(() => setJumpError(false), 800);
      return;
    }
    onPageChange(num);
    setJumpValue('');
  };

  return (
    <div className="flex items-center px-4 py-1.5 border-t border-b border-border bg-bg-secondary text-xs text-text-secondary">
      {/* Left: row range */}
      <span className="font-mono tabular-nums shrink-0">
        {start.toLocaleString()}–{end.toLocaleString()} of {total.toLocaleString()}
      </span>

      {/* Center: Go to page */}
      {totalPages > 1 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-1">
            <span className="text-text-tertiary text-[10px]">Go to</span>
            <input
              type="text"
              inputMode="numeric"
              value={jumpValue}
              onChange={(e) => { setJumpValue(e.target.value.replace(/\D/g, '')); setJumpError(false); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleJump(); }}
              placeholder="#"
              className={`w-10 px-1.5 py-0.5 text-center text-[11px] font-mono bg-bg-primary border rounded text-text-primary focus:border-accent focus:outline-none transition-colors ${
                jumpError ? 'border-error animate-shake' : 'border-border'
              }`}
            />
          </div>
        </div>
      )}

      {/* Right: pagination nav + suffix */}
      <div className="flex items-center gap-1.5 shrink-0">
        {totalPages > 1 && (
          <div className="flex items-center gap-0.5">
            <Tooltip content="First page" placement="top">
              <button
                onClick={() => onPageChange(1)}
                disabled={page === 1}
                className="p-1 rounded hover:bg-bg-tertiary disabled:opacity-30 transition-colors"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
            <Tooltip content="Previous page" placement="top">
              <button
                onClick={() => onPageChange(Math.max(1, page - 1))}
                disabled={page === 1}
                className="p-1 rounded hover:bg-bg-tertiary disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </Tooltip>

            <span className="px-1.5 font-mono tabular-nums text-text-primary">
              {page} <span className="text-text-tertiary">/</span> {totalPages}
            </span>

            <Tooltip content="Next page" placement="top">
              <button
                onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="p-1 rounded hover:bg-bg-tertiary disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
            <Tooltip content="Last page" placement="top">
              <button
                onClick={() => onPageChange(totalPages)}
                disabled={page === totalPages}
                className="p-1 rounded hover:bg-bg-tertiary disabled:opacity-30 transition-colors"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          </div>
        )}
        {suffix}
      </div>
    </div>
  );
}
