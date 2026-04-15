import { useState } from 'react';
import { useConnectionStore } from '../store/connectionStore';
import { Copy, Check } from 'lucide-react';
import { Tooltip } from './Tooltip';

interface StatusBarProps {
  selectedTable: string | null;
  rowCount: number | null;
  lastQueryTime: number | null;
}

export function StatusBar({ selectedTable, rowCount, lastQueryTime }: StatusBarProps) {
  const { connected, config, rawPassword } = useConnectionStore();
  const [copied, setCopied] = useState(false);

  const maskedConnString = config ? `${config.user}:****@${config.host}:${config.port}/${config.database}` : '';
  const fullConnString = config ? `${config.user}:${rawPassword ?? '****'}@${config.host}:${config.port}/${config.database}` : '';

  const handleCopy = () => {
    if (!fullConnString) return;
    navigator.clipboard.writeText(fullConnString).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="flex items-center justify-between px-3 py-1.5 border-t border-border bg-bg-secondary text-[11px] text-text-secondary">
      {/* Left: connection string + copy */}
      <div className="flex items-center gap-2 min-w-0 flex-1 basis-0">
        <span className={`w-1 h-1 rounded-full shrink-0 ${connected ? 'bg-success' : 'bg-error'}`} />
        <span className="font-mono truncate text-[10px]">{maskedConnString || 'Disconnected'}</span>
        {maskedConnString && (
          <Tooltip content="Copy connection string" placement="top">
            <button
              onClick={handleCopy}
              className="shrink-0 p-0.5 rounded text-text-tertiary hover:text-text-primary transition-colors"
            >
              {copied ? <Check className="w-2.5 h-2.5 text-success" /> : <Copy className="w-2.5 h-2.5" />}
            </button>
          </Tooltip>
        )}
      </div>

      {/* Center: links */}
      <div className="flex items-center justify-center gap-3 px-4 shrink-0">
        <span className="text-text-tertiary">&copy; {new Date().getFullYear()} Ascent Syst&egrave;mes</span>
        <span className="text-text-tertiary">&middot;</span>
        <a href="https://github.com/ZlatanOmerovic/firebird-web-client" target="_blank" rel="noopener noreferrer" className="hover:text-text-primary transition-colors flex items-center gap-1">
          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
          firebird-web-client
        </a>
      </div>

      {/* Right: selected object + query time */}
      <div className="flex items-center justify-end gap-3 font-mono flex-1 basis-0">
        {selectedTable && (
          <span>
            {selectedTable}
            {rowCount !== null && ` \u2014 ${rowCount.toLocaleString()} rows`}
          </span>
        )}
        {lastQueryTime !== null && (
          <span className="tabular-nums text-text-tertiary">{lastQueryTime}ms</span>
        )}
      </div>
    </div>
  );
}
