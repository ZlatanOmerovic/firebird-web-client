import { useState, useEffect, useCallback } from 'react';
import { Loader2, X, RefreshCw, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { Tooltip } from './Tooltip';

interface RequestError {
  id: number;
  url: string;
  method: string;
  status: number;
  statusText: string;
  body: string;
  timestamp: number;
}

let activeRequests = 0;
let onChangeCallbacks: (() => void)[] = [];
let errorCallbacks: ((err: RequestError) => void)[] = [];
let nextErrorId = 0;

function notifyChange() {
  onChangeCallbacks.forEach((cb) => cb());
}

// Intercept fetch globally
const originalFetch = window.fetch;
window.fetch = async function (...args) {
  const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;

  // Only track /api requests
  if (!url.includes('/api/')) return originalFetch.apply(this, args);

  // Skip ping requests — they're background health checks
  if (url.includes('/api/ping')) return originalFetch.apply(this, args);

  activeRequests++;
  notifyChange();

  try {
    const response = await originalFetch.apply(this, args);

    activeRequests = Math.max(0, activeRequests - 1);
    notifyChange();

    // Clone response to read body for error reporting without consuming it
    if (!response.ok) {
      const clone = response.clone();
      try {
        const body = await clone.text();
        const method = (args[1] as RequestInit)?.method ?? 'GET';
        errorCallbacks.forEach((cb) => cb({
          id: ++nextErrorId,
          url,
          method: method.toUpperCase(),
          status: response.status,
          statusText: response.statusText,
          body,
          timestamp: Date.now(),
        }));
      } catch { /* ignore */ }
    }

    return response;
  } catch (err) {
    activeRequests = Math.max(0, activeRequests - 1);
    notifyChange();

    const method = (args[1] as RequestInit)?.method ?? 'GET';
    errorCallbacks.forEach((cb) => cb({
      id: ++nextErrorId,
      url,
      method: method.toUpperCase(),
      status: 0,
      statusText: 'Network Error',
      body: err instanceof Error ? err.message : 'Request failed',
      timestamp: Date.now(),
    }));

    throw err;
  }
};

export function GlobalRequestIndicator() {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<RequestError[]>([]);
  const [expandedError, setExpandedError] = useState<number | null>(null);

  useEffect(() => {
    const onChange = () => setLoading(activeRequests > 0);
    onChangeCallbacks.push(onChange);
    return () => { onChangeCallbacks = onChangeCallbacks.filter((cb) => cb !== onChange); };
  }, []);

  const onError = useCallback((err: RequestError) => {
    setErrors((prev) => [err, ...prev].slice(0, 5));
  }, []);

  useEffect(() => {
    errorCallbacks.push(onError);
    return () => { errorCallbacks = errorCallbacks.filter((cb) => cb !== onError); };
  }, [onError]);

  const dismissError = (id: number) => {
    setErrors((prev) => prev.filter((e) => e.id !== id));
  };

  const dismissAll = () => setErrors([]);

  return (
    <>
      {/* Loading bar */}
      {loading && (
        <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center">
          <div className="flex items-center gap-2 px-4 py-1.5 bg-accent text-[#ffffff] text-xs font-medium rounded-b-lg shadow-lg">
            <Loader2 className="w-3 h-3 animate-spin" />
            Loading...
          </div>
        </div>
      )}

      {/* Error alerts */}
      {errors.length > 0 && (
        <div className="fixed inset-0 z-[9998] flex items-start justify-center pt-16" onClick={dismissAll}>
          <div className="w-full max-w-lg space-y-2" onClick={(e) => e.stopPropagation()}>
            {errors.map((err) => (
              <div
                key={err.id}
                className="bg-bg-primary border border-error/30 rounded-xl shadow-[0_8px_32px_rgba(239,68,68,0.15)] overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3 bg-error/10 border-b border-error/20">
                  <AlertTriangle className="w-4 h-4 text-error shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-error">Request Failed</p>
                    <p className="text-[11px] text-text-secondary mt-0.5 font-mono truncate">
                      {err.method} {err.url.replace(/^.*\/api/, '/api')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Tooltip content="Reload page" placement="top">
                      <button
                        onClick={() => window.location.reload()}
                        className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </Tooltip>
                    <Tooltip content="Dismiss" placement="top">
                      <button
                        onClick={() => dismissError(err.id)}
                        className="p-1.5 rounded-lg text-text-tertiary hover:text-error hover:bg-error-subtle transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </Tooltip>
                  </div>
                </div>

                {/* Status */}
                <div className="flex items-center gap-3 px-4 py-2.5">
                  {err.status > 0 ? (
                    <span className="px-2 py-0.5 text-[11px] font-mono font-medium bg-error/10 text-error rounded">{err.status}</span>
                  ) : (
                    <span className="px-2 py-0.5 text-[11px] font-mono font-medium bg-error/10 text-error rounded">ERR</span>
                  )}
                  <span className="text-xs text-text-secondary">{err.statusText || 'Connection failed'}</span>
                  <span className="ml-auto text-[10px] text-text-tertiary font-mono tabular-nums">
                    {new Date(err.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                {/* Debug toggle */}
                <div className="border-t border-border">
                  <button
                    onClick={() => setExpandedError(expandedError === err.id ? null : err.id)}
                    className="w-full flex items-center justify-between px-4 py-2 text-[11px] text-text-tertiary hover:text-text-secondary transition-colors"
                  >
                    <span>Debug Details</span>
                    {expandedError === err.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  {expandedError === err.id && (
                    <div className="px-4 pb-3">
                      <pre className="p-3 bg-code-bg border border-border rounded-lg text-[11px] font-mono text-text-secondary overflow-auto max-h-40 whitespace-pre-wrap break-words">
                        {err.body || '(empty response)'}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
