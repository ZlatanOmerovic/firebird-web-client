import { useState, useEffect, useCallback, useRef } from 'react';
import { X, AlertCircle, CheckCircle2, Code, Copy, Check, ExternalLink, Clock } from 'lucide-react';
import { SqlHighlight } from './SqlHighlight';

interface ToastItem {
  id: number;
  message: string;
  type: 'error' | 'success' | 'action';
  sql?: string;
  duration?: number;
}

let addToastFn: ((t: Omit<ToastItem, 'id'>) => void) | null = null;

export function toast(message: string, type: 'error' | 'success' = 'error') {
  addToastFn?.({ message, type });
}

export function actionToast(message: string, sql?: string, duration?: number) {
  addToastFn?.({ message, type: 'action', sql, duration });
}

function ToastCard({ t, onRemove }: { t: ToastItem; onRemove: () => void }) {
  const [showSql, setShowSql] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Auto-dismiss: 4s for action, 5s for others, paused on hover, cancelled if SQL shown
  useEffect(() => {
    if (showSql) return; // persistent once SQL is shown
    const schedule = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(onRemove, t.type === 'action' ? 4000 : 5000);
    };
    if (!hovered) schedule();
    else if (timerRef.current) clearTimeout(timerRef.current);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [hovered, showSql, onRemove, t.type]);

  const handleCopy = () => {
    if (!t.sql) return;
    navigator.clipboard.writeText(t.sql).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleOpenInEditor = () => {
    if (!t.sql) return;
    sessionStorage.setItem('firebird-run-query', t.sql);
    window.history.pushState(null, '', '/sql');
    window.dispatchEvent(new PopStateEvent('popstate'));
    onRemove();
  };

  const isAction = t.type === 'action';
  const isError = t.type === 'error';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`rounded-xl border text-sm shadow-lg animate-[slideUp_0.2s_ease-out] overflow-hidden ${
        isError
          ? 'bg-bg-primary border-error/20'
          : 'bg-bg-primary border-success/20'
      }`}
      style={{ boxShadow: '0 4px 16px var(--color-shadow-lg)', maxWidth: 420 }}
    >
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {isError ? (
          <AlertCircle className="w-4 h-4 shrink-0 text-error" />
        ) : (
          <CheckCircle2 className="w-4 h-4 shrink-0 text-success" />
        )}
        <span className={`flex-1 ${isError ? 'text-error' : 'text-success'}`}>{t.message}</span>
        {isAction && t.duration !== undefined && (
          <span className="flex items-center gap-1 text-[10px] text-text-tertiary font-mono tabular-nums shrink-0">
            <Clock className="w-2.5 h-2.5" />
            {t.duration}ms
          </span>
        )}
        {isAction && t.sql && (
          <button
            onClick={() => setShowSql(!showSql)}
            className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-md border transition-colors shrink-0 ${
              showSql
                ? 'bg-accent-subtle text-accent border-accent/30'
                : 'text-text-tertiary border-border hover:text-accent hover:border-accent/30'
            }`}
          >
            <Code className="w-3 h-3" />
            SQL
          </button>
        )}
        <button
          onClick={onRemove}
          className="text-text-tertiary hover:text-text-primary transition-colors p-0.5 shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Expanded SQL section */}
      {showSql && t.sql && (
        <div className="border-t border-border">
          <div className="max-h-40 overflow-auto px-1 py-1 [&>pre]:!text-[11px] [&>pre]:!rounded-none [&>pre]:!border-0 [&>pre]:!shadow-none">
            <SqlHighlight code={t.sql} />
          </div>
          <div className="flex items-center gap-1 px-3 py-2 border-t border-border bg-bg-secondary">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-md transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={handleOpenInEditor}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-accent hover:bg-accent-subtle rounded-md transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Open in Editor
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextIdRef = useRef(0);

  const addToast = useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = ++nextIdRef.current;
    setToasts((prev) => [...prev, { ...t, id }]);
  }, []);

  useEffect(() => {
    addToastFn = addToast;
    return () => { addToastFn = null; };
  }, [addToast]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-12 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastCard key={t.id} t={t} onRemove={() => remove(t.id)} />
      ))}
    </div>
  );
}
