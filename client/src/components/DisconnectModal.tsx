import { useState } from 'react';
import { useConnectionStore } from '../store/connectionStore';
import { X, LogOut, Star, Trash2, Copy, Check, AlertTriangle } from 'lucide-react';
import { Tooltip } from './Tooltip';

const SAVED_CONNECTIONS_KEY = 'firebird-saved-connections';

interface SavedConnection {
  id: string;
  name?: string;
  config: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
  savedAt: number;
  lastUsed?: number;
  lastDisconnected?: number;
}

function loadSaved(): SavedConnection[] {
  try {
    return JSON.parse(localStorage.getItem(SAVED_CONNECTIONS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function persistSaved(connections: SavedConnection[]): void {
  localStorage.setItem(SAVED_CONNECTIONS_KEY, JSON.stringify(connections));
}

interface DisconnectModalProps {
  onClose: () => void;
}

export function DisconnectModal({ onClose }: DisconnectModalProps) {
  const { config, rawPassword, disconnect } = useConnectionStore();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!config) return null;

  const saved = loadSaved();
  const isSaved = saved.some(
    (s) =>
      s.config.host === config.host &&
      s.config.port === config.port &&
      s.config.database === config.database &&
      s.config.user === config.user,
  );

  const dbName = config.database.split('/').pop() ?? config.database;
  const connString = `${config.user}:${rawPassword ?? '****'}@${config.host}:${config.port}/${config.database}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(connString).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleDisconnect = async () => {
    setLoading(true);
    // Record lastDisconnected on matching saved connection
    if (config) {
      const updated = saved.map((s) =>
        s.config.host === config.host && s.config.port === config.port && s.config.database === config.database && s.config.user === config.user
          ? { ...s, lastDisconnected: Date.now() }
          : s,
      );
      persistSaved(updated);
    }
    await disconnect();
    onClose();
  };

  const handleSaveAndDisconnect = async () => {
    setLoading(true);
    const existing = saved.find(
      (s) =>
        s.config.host === config.host &&
        s.config.port === config.port &&
        s.config.database === config.database &&
        s.config.user === config.user,
    );
    if (existing) {
      const updated = saved.map((s) =>
        s.id === existing.id
          ? { ...s, config: { ...config, password: rawPassword ?? '' }, savedAt: Date.now() }
          : s,
      );
      persistSaved(updated);
    } else {
      const entry: SavedConnection = {
        id: crypto.randomUUID(),
        config: { ...config, password: rawPassword ?? '' },
        savedAt: Date.now(),
      };
      persistSaved([entry, ...saved]);
    }
    await disconnect();
    onClose();
  };

  const handleRemoveAndDisconnect = async () => {
    setLoading(true);
    const updated = saved.filter(
      (s) =>
        !(s.config.host === config.host &&
          s.config.port === config.port &&
          s.config.database === config.database &&
          s.config.user === config.user),
    );
    persistSaved(updated);
    await disconnect();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-overlay z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-bg-primary border border-error/20 rounded-2xl shadow-[0_8px_40px_rgba(239,68,68,0.12)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — red accent */}
        <div className="relative px-5 pt-5 pb-4">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-error/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-error" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">Disconnect</h2>
              <p className="text-[11px] text-text-tertiary">Your session will be closed</p>
            </div>
          </div>
        </div>

        {/* Connection card */}
        <div className="px-5 pb-4">
          <div className="p-3 bg-error/[0.03] border border-error/10 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-text-primary">{dbName}</p>
              {isSaved && (
                <span className="px-1.5 py-0.5 text-[9px] font-medium bg-accent-subtle text-accent rounded">Saved</span>
              )}
            </div>
            <p className="text-[11px] text-text-secondary font-mono">{config.user}@{config.host}:{config.port}</p>

            {/* Copyable connection string */}
            <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-error/10">
              <p className="flex-1 text-[10px] text-text-tertiary font-mono truncate">{connString}</p>
              <Tooltip content="Copy connection string" placement="top">
                <button
                  onClick={handleCopy}
                  className="shrink-0 p-1 rounded text-text-tertiary hover:text-text-primary transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                </button>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 space-y-2">
          <div className="flex gap-2">
            <button
              onClick={handleSaveAndDisconnect}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium bg-accent hover:bg-accent-hover text-[#ffffff] rounded-lg transition-colors disabled:opacity-50"
            >
              <Star className="w-3.5 h-3.5" />
              {isSaved ? 'Update & Exit' : 'Save & Exit'}
            </button>
            <button
              onClick={handleDisconnect}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium bg-error/90 hover:bg-error text-[#ffffff] rounded-lg transition-colors disabled:opacity-50"
            >
              <LogOut className="w-3.5 h-3.5" />
              Disconnect
            </button>
          </div>

          {isSaved && (
            <button
              onClick={handleRemoveAndDisconnect}
              disabled={loading}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-medium text-error/70 hover:text-error hover:bg-error/5 rounded-lg transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3 h-3" />
              Remove from saved & disconnect
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
