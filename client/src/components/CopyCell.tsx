import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyCellProps {
  value: string;
  children: ReactNode;
}

export function CopyCell({ value, children }: CopyCellProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1200);
    });
  };

  return (
    <div className="relative group/copy">
      {children}
      {value && (
        <button
          onClick={handleCopy}
          className="absolute top-0 right-0 p-0.5 rounded opacity-0 group-hover/copy:opacity-100 transition-opacity bg-bg-secondary/80 hover:bg-bg-tertiary"
        >
          {copied ? (
            <Check className="w-3 h-3 text-success" />
          ) : (
            <Copy className="w-3 h-3 text-text-tertiary hover:text-text-primary" />
          )}
        </button>
      )}
    </div>
  );
}
