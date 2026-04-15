import { useState, useEffect, useRef } from 'react';
import { useServerHealth } from '../hooks/useServerHealth';
import { Tooltip } from './Tooltip';
import { RefreshCw, ServerOff, Terminal, X } from 'lucide-react';

interface ServerHealthIndicatorProps {
  compact?: boolean;
}

export function ServerHealthIndicator({ compact = false }: ServerHealthIndicatorProps) {
  const online = useServerHealth();
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showAlert, setShowAlert] = useState(false);
  const wasOnlineRef = useRef<boolean | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval>>(null);

  // Track transitions: online → offline starts countdown; offline → online clears everything
  useEffect(() => {
    if (online === true) {
      // Server came back
      if (countdownRef.current) clearInterval(countdownRef.current);
      setCountdown(null);
      setShowAlert(false);
      wasOnlineRef.current = true;
    } else if (online === false && wasOnlineRef.current === true) {
      // Server just went offline — start 10s countdown
      setCountdown(10);
      setShowAlert(false);
      if (countdownRef.current) clearInterval(countdownRef.current);
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            setShowAlert(true);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (online === false && wasOnlineRef.current === null) {
      // Never was online (first load failed)
      wasOnlineRef.current = false;
      setShowAlert(true);
    }
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [online]);

  if (online === null) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-text-tertiary opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-text-tertiary" />
        </span>
        {!compact && <span className="text-[10px] text-text-tertiary">Checking...</span>}
      </div>
    );
  }

  const tooltipContent = online
    ? 'The API server is running and responding to requests.'
    : countdown !== null
      ? `Server not responding. Alert in ${countdown}s...`
      : 'The API server is not responding.';

  return (
    <>
      <Tooltip
        content={
          <div className="max-w-[200px] whitespace-normal">
            <p className="font-semibold mb-1">{online ? 'Server Online' : 'Server Offline'}</p>
            <p className="opacity-80 text-[10px] leading-relaxed">{tooltipContent}</p>
          </div>
        }
        placement="bottom"
      >
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            {online ? (
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
            ) : (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-error" />
              </>
            )}
          </span>
          {!compact && (
            <span className={`text-[10px] font-medium ${online ? 'text-success' : 'text-error'}`}>
              {online ? 'Server Online' : countdown !== null ? `Offline (${countdown}s)` : 'Server Offline'}
            </span>
          )}
        </div>
      </Tooltip>

      {/* Full-screen alert overlay */}
      {showAlert && !online && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-bg-secondary border border-border rounded-2xl shadow-2xl w-full max-w-xl mx-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-error/20 bg-error-subtle">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-error/10">
                  <ServerOff className="w-5 h-5 text-error" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Server Unreachable</h3>
                  <p className="text-[11px] text-text-secondary">The API server is not responding</p>
                </div>
              </div>
              <button onClick={() => setShowAlert(false)} className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-4">
              <p className="text-xs text-text-secondary leading-relaxed">
                The application cannot reach the backend server. This usually means the server process has stopped or the port is blocked.
              </p>

              <div className="space-y-2">
                <p className="text-[11px] font-medium text-text-primary uppercase tracking-wide">Start both client &amp; server:</p>
                <div className="flex items-center gap-2 px-3 py-2.5 bg-bg-tertiary rounded-lg border border-border">
                  <Terminal className="w-3.5 h-3.5 text-accent shrink-0" />
                  <code className="text-[12px] font-mono text-text-primary select-all">npm run dev</code>
                  <span className="text-[10px] text-text-tertiary ml-auto">starts both</span>
                </div>
                <p className="text-[11px] font-medium text-text-primary uppercase tracking-wide mt-3">Or start individually:</p>
                <div className="flex items-center gap-2 px-3 py-2 bg-bg-tertiary rounded-lg border border-border">
                  <Terminal className="w-3.5 h-3.5 text-accent shrink-0" />
                  <code className="text-[12px] font-mono text-text-primary select-all">npm run dev -w server</code>
                  <span className="text-[10px] text-text-tertiary ml-auto">port 3001</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-bg-tertiary rounded-lg border border-border">
                  <Terminal className="w-3.5 h-3.5 text-accent shrink-0" />
                  <code className="text-[12px] font-mono text-text-primary select-all">npm run dev -w client</code>
                  <span className="text-[10px] text-text-tertiary ml-auto">port 5173</span>
                </div>
              </div>

              <div className="text-[11px] text-text-tertiary leading-relaxed space-y-1">
                <p>Run commands from the project root directory. The server runs on port <code className="font-mono text-text-secondary">3001</code>, the client on <code className="font-mono text-text-secondary">5173</code>.</p>
                <p>The application will automatically reconnect when the server is back online.</p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-bg-tertiary">
              <span className="flex items-center gap-1.5 text-[10px] text-text-tertiary">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-error" />
                </span>
                Retrying every 10s...
              </span>
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent hover:bg-accent-hover text-[#ffffff] rounded-lg transition-colors shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
