import { useState } from 'react';
import { useConnectionStore } from '../store/connectionStore';
import { testConnection } from '../lib/api';
import { ServerHealthIndicator } from './ServerHealthIndicator';
import type { ConnectionConfig, TestConnectionResult } from '../lib/api';
import { Database, Loader2, Sun, Moon, Star, Trash2, Server, Clock, ArrowRight, Search, Eye, EyeOff, CheckCircle2, XCircle, Zap, Upload } from 'lucide-react';
import { Tooltip } from './Tooltip';
import { ConfigImportModal } from './ConfigImportModal';

const SAVED_CONNECTIONS_KEY = 'firebird-saved-connections';

interface SavedConnection {
  id: string;
  name?: string;
  config: ConnectionConfig;
  savedAt: number;
  lastUsed?: number;
  lastDisconnected?: number;
}

function loadSavedConnections(): SavedConnection[] {
  try {
    return JSON.parse(localStorage.getItem(SAVED_CONNECTIONS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function persistConnections(connections: SavedConnection[]): void {
  localStorage.setItem(SAVED_CONNECTIONS_KEY, JSON.stringify(connections));
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return d.toLocaleDateString();
}

function useThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('firebird-theme', next ? 'dark' : 'light');
  };
  return { dark, toggle };
}

const INPUT_CLASS = 'w-full px-3 py-2 bg-bg-inset border border-border rounded-lg text-text-primary text-sm focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition-colors';

export function ConnectionPanel() {
  const { connect } = useConnectionStore();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { dark, toggle: toggleTheme } = useThemeToggle();
  const [saved, setSaved] = useState<SavedConnection[]>(loadSavedConnections);
  const [search, setSearch] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
  const [showConfigImport, setShowConfigImport] = useState(false);

  const [connectionName, setConnectionName] = useState('');
  const [form, setForm] = useState<ConnectionConfig>({
    host: import.meta.env.VITE_DEFAULT_HOST ?? 'localhost',
    port: Number(import.meta.env.VITE_DEFAULT_PORT ?? 3050),
    database: import.meta.env.VITE_DEFAULT_DATABASE ?? '',
    user: import.meta.env.VITE_DEFAULT_USER ?? 'SYSDBA',
    password: import.meta.env.VITE_DEFAULT_PASSWORD ?? '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await connect(form);
      // Update lastUsed on matching saved connection
      const updated = saved.map((s) =>
        s.config.host === form.host && s.config.port === form.port && s.config.database === form.database && s.config.user === form.user
          ? { ...s, lastUsed: Date.now() }
          : s,
      );
      setSaved(updated);
      persistConnections(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testConnection(form);
      setTestResult(result);
    } catch (err) {
      setTestResult({ ok: false, error: err instanceof Error ? err.message : 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  const update = (field: keyof ConnectionConfig, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveConnection = () => {
    const exists = saved.find(
      (s) =>
        s.config.host === form.host &&
        s.config.port === form.port &&
        s.config.database === form.database &&
        s.config.user === form.user,
    );
    if (exists) {
      const updated = saved.map((s) =>
        s.id === exists.id ? { ...s, config: { ...form }, name: connectionName || s.name, savedAt: Date.now() } : s,
      );
      setSaved(updated);
      persistConnections(updated);
      return;
    }
    const entry: SavedConnection = {
      id: crypto.randomUUID(),
      name: connectionName || undefined,
      config: { ...form },
      savedAt: Date.now(),
    };
    const updated = [entry, ...saved];
    setSaved(updated);
    persistConnections(updated);
  };

  const loadConnection = (conn: SavedConnection) => {
    setForm({ ...conn.config });
    setConnectionName(conn.name ?? '');
    setError(null);
  };

  const connectSaved = async (conn: SavedConnection) => {
    setForm({ ...conn.config });
    setConnectionName(conn.name ?? '');
    setError(null);
    setLoading(true);
    try {
      await connect(conn.config);
      const updated = saved.map((s) => s.id === conn.id ? { ...s, lastUsed: Date.now() } : s);
      setSaved(updated);
      persistConnections(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setLoading(false);
    }
  };

  const removeConnection = (id: string) => {
    const updated = saved.filter((s) => s.id !== id);
    setSaved(updated);
    persistConnections(updated);
  };

  const clearAll = () => {
    setSaved([]);
    persistConnections([]);
  };

  const isCurrentSaved = saved.some(
    (s) =>
      s.config.host === form.host &&
      s.config.port === form.port &&
      s.config.database === form.database &&
      s.config.user === form.user,
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-secondary relative p-6">
      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="absolute top-5 right-5 p-2.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
        aria-label="Toggle theme"
      >
        {dark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
      </button>

      {/* Two-panel layout */}
      <div className="w-full max-w-[900px] grid grid-cols-[40%_60%] bg-bg-primary border border-border rounded-2xl shadow-[0_8px_40px_var(--color-shadow)]">
        {/* Left: Recent connections — relative container so inner content scrolls within form-driven height */}
        <div className="border-r border-border bg-bg-secondary relative rounded-l-2xl overflow-hidden">
          <div className="absolute inset-0 flex flex-col overflow-hidden">
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-text-primary">Recent Connections</h2>
              {saved.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-[11px] text-text-tertiary hover:text-error transition-colors px-2 py-1 rounded-md hover:bg-error-subtle"
                >
                  Clear all
                </button>
              )}
            </div>
            <p className="text-xs text-text-tertiary">Click to connect, or load into the form</p>
          </div>

          {saved.length > 0 && (
            <div className="px-3 pb-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary" />
                <input
                  type="text"
                  placeholder="Search connections..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-bg-inset border border-border rounded-lg text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition-colors"
                />
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-3 pb-3">
            {saved.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
                <div className="w-12 h-12 rounded-2xl bg-bg-tertiary flex items-center justify-center mb-4">
                  <Server className="w-6 h-6 text-text-tertiary" />
                </div>
                <p className="text-sm text-text-secondary font-medium mb-1">No saved connections</p>
                <p className="text-xs text-text-tertiary leading-relaxed">
                  Connect to a database and save it for quick access next time
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {saved.filter((conn) => {
                  if (!search) return true;
                  const q = search.toLowerCase();
                  return (
                    conn.config.host.toLowerCase().includes(q) ||
                    conn.config.database.toLowerCase().includes(q) ||
                    conn.config.user.toLowerCase().includes(q) ||
                    String(conn.config.port).includes(q)
                  );
                }).map((conn) => {
                  const isActive =
                    conn.config.host === form.host &&
                    conn.config.port === form.port &&
                    conn.config.database === form.database &&
                    conn.config.user === form.user;
                  const dbName = conn.config.database.split('/').pop() ?? conn.config.database;

                  return (
                    <div
                      key={conn.id}
                      className={`group rounded-xl p-3 cursor-pointer transition-all ${
                        isActive
                          ? 'bg-accent-subtle ring-1 ring-accent/20'
                          : 'hover:bg-bg-primary'
                      }`}
                      onClick={() => loadConnection(conn)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                          isActive ? 'bg-accent/15' : 'bg-bg-tertiary'
                        }`}>
                          <Database className={`w-4 h-4 ${isActive ? 'text-accent' : 'text-text-tertiary'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          {conn.name && (
                            <div className={`text-[13px] font-semibold truncate ${isActive ? 'text-accent' : 'text-text-primary'}`}>
                              {conn.name}
                            </div>
                          )}
                          <div className={`text-[12px] font-medium font-mono truncate ${conn.name ? 'text-text-secondary' : isActive ? 'text-accent' : 'text-text-primary'}`}>
                            {dbName || 'No database'}
                          </div>
                          <div className="text-[11px] text-text-tertiary font-mono truncate mt-0.5">
                            {conn.config.user}@{conn.config.host}:{conn.config.port}
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-text-tertiary">
                            <span className="flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              Saved {formatDate(conn.savedAt)}
                            </span>
                            {conn.lastUsed && (
                              <span className="flex items-center gap-1">
                                <Zap className="w-2.5 h-2.5" />
                                Used {formatDate(conn.lastUsed)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              connectSaved(conn);
                            }}
                            className="p-1.5 rounded-lg text-text-tertiary hover:text-accent hover:bg-accent-subtle transition-colors"
                          >
                            <Tooltip content="Connect now" placement="top">
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Tooltip>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeConnection(conn.id);
                            }}
                            className="p-1.5 rounded-lg text-text-tertiary hover:text-error hover:bg-error-subtle transition-colors"
                          >
                            <Tooltip content="Remove" placement="top">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Tooltip>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          </div>{/* close absolute inner */}
        </div>

        {/* Right: Connection form */}
        <div className="flex flex-col bg-bg-primary">
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 p-6">
            <div className="flex items-center gap-3 mb-7">
              <div className="w-10 h-10 rounded-xl bg-accent-subtle flex items-center justify-center">
                <Database className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-text-primary">Firebird <span className="text-accent">Web Client</span></h1>
                <p className="text-xs text-text-secondary">Enter connection details</p>
              </div>
            </div>

            {error && (
              <div className="mb-4 px-4 py-3 bg-error-subtle border border-error/20 rounded-lg text-error text-sm">
                {error}
              </div>
            )}

            <div className="space-y-3.5">
              {/* Connection Name (optional) */}
              <div>
                <label className="block text-[11px] font-medium text-text-secondary mb-1 uppercase tracking-wide">
                  Connection Name <span className="text-text-tertiary font-normal normal-case">(optional)</span>
                </label>
                <input
                  type="text"
                  value={connectionName}
                  onChange={(e) => setConnectionName(e.target.value)}
                  placeholder="e.g. Production DB, Local Dev..."
                  className={`${INPUT_CLASS} placeholder:text-text-tertiary`}
                />
              </div>

              {/* Host + Port */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-[11px] font-medium text-text-secondary mb-1 uppercase tracking-wide">Host</label>
                  <input type="text" value={form.host} onChange={(e) => update('host', e.target.value)} className={INPUT_CLASS} required />
                </div>
                <div className="w-[88px]">
                  <label className="block text-[11px] font-medium text-text-secondary mb-1 uppercase tracking-wide">Port</label>
                  <input type="number" value={form.port} onChange={(e) => update('port', parseInt(e.target.value, 10))} className={INPUT_CLASS} required />
                </div>
              </div>

              {/* Username + Password */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-[11px] font-medium text-text-secondary mb-1 uppercase tracking-wide">Username</label>
                  <input type="text" value={form.user} onChange={(e) => update('user', e.target.value)} className={INPUT_CLASS} required />
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] font-medium text-text-secondary mb-1 uppercase tracking-wide">Password</label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => update('password', e.target.value)} className={`${INPUT_CLASS} pr-9`} />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Test connection */}
              <div className="relative flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testing || !form.host}
                className="flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover transition-colors disabled:opacity-40"
              >
                {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                Test Connection
              </button>
              {testResult && (
                <div className={`flex items-center gap-1.5 text-xs ${testResult.ok ? 'text-success' : 'text-error'}`}>
                  {testResult.ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  {testResult.ok ? (
                    <span>Connected — Firebird {testResult.firebirdVersion ?? '?'}</span>
                  ) : (
                    <span>{testResult.error}</span>
                  )}
                </div>
              )}

              {/* Floating aliases popover */}
              {testResult?.ok && testResult.aliases && testResult.aliases.length > 0 && (
                <div className="absolute top-1/2 -translate-y-1/2 right-full mr-2 w-72 rounded-xl overflow-hidden z-[999] border border-accent/30 shadow-[0_12px_40px_var(--color-shadow-lg)]" style={{
                  background: document.documentElement.classList.contains('dark') ? '#1a1f2e' : '#f0f4ff',
                }}>
                  <div className="flex items-center justify-between px-3 py-2 border-b border-accent/20" style={{
                    background: document.documentElement.classList.contains('dark') ? '#2563eb' : '#3b82f6',
                  }}>
                    <span className="text-[10px] text-[#ffffff] uppercase tracking-wide font-semibold">Databases &amp; Aliases</span>
                    <button
                      type="button"
                      onClick={() => setTestResult(null)}
                      className="p-0.5 text-white/60 hover:text-white transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto p-1">
                    {testResult.aliases.map((db) => (
                      <button
                        key={db.alias}
                        type="button"
                        onClick={() => { update('database', db.alias); setTestResult(null); }}
                        className="w-full flex items-center gap-2 px-2.5 py-2 text-xs rounded-lg transition-colors text-left group hover:bg-accent/10"
                      >
                        <Database className="w-3 h-3 text-accent shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span className="font-medium text-text-primary block">{db.alias}</span>
                          <span className="text-[10px] text-text-tertiary font-mono truncate block">{db.path}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              </div>

              <div className="border-t border-border" />

              {/* Database Path or Alias */}
              <div>
                <label className="block text-[11px] font-medium text-text-secondary mb-1 uppercase tracking-wide">
                  Database Path or{' '}
                  <span className="relative inline-block group">
                    <span className="text-accent cursor-help hover:underline">ALIAS</span>
                    <div className="absolute top-1/2 -translate-y-1/2 left-full pl-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[999]">
                      <div className="w-64 p-3 bg-[#1e293b] text-white text-[11px] leading-relaxed rounded-lg shadow-lg relative">
                        <p className="font-normal normal-case tracking-normal">A <strong>database alias</strong> is a short name that maps to a full database file path on the Firebird server, configured in <code className="text-accent text-[10px]">databases.conf</code>. It improves portability and security.</p>
                        <a href="https://firebirdsql.org/rlsnotesh/config-db-alias.html" target="_blank" rel="noopener noreferrer" className="inline-block mt-1.5 text-accent hover:underline normal-case tracking-normal">Read more →</a>
                        <div className="absolute top-1/2 -translate-y-1/2 -left-1 w-2 h-2 bg-[#1e293b] rotate-45" />
                      </div>
                    </div>
                  </span>
                </label>
                <input
                  type="text"
                  value={form.database}
                  onChange={(e) => update('database', e.target.value)}
                  placeholder="/path/to/database.fdb, alias, or leave empty"
                  className={`${INPUT_CLASS} placeholder:text-text-tertiary`}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5 pt-4 border-t border-border">
              <Tooltip content={isCurrentSaved ? 'Connection saved' : 'Save connection'} placement="top">
                <button
                  type="button"
                  onClick={saveConnection}
                  className={`px-3.5 py-2.5 text-sm font-medium rounded-lg border transition-all flex items-center gap-1.5 ${
                    isCurrentSaved
                      ? 'border-accent/30 bg-accent-subtle text-accent'
                      : 'border-border text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
                  }`}
                >
                  <Star className={`w-3.5 h-3.5 ${isCurrentSaved ? 'fill-accent' : ''}`} />
                  <span className="text-xs">{isCurrentSaved ? 'Saved' : 'Save'}</span>
                </button>
              </Tooltip>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 bg-accent hover:bg-accent-hover text-text-inverted font-medium text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  'Connect'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="col-span-2 border-t border-border px-6 py-3 grid grid-cols-3 items-center bg-bg-secondary rounded-b-2xl">
          <span className="text-[11px] text-text-tertiary">
            &copy; {new Date().getFullYear()}{' '}
            <a href="https://github.com/ZlatanOmerovic" target="_blank" rel="noopener noreferrer" className="text-text-secondary hover:text-accent transition-colors">
              Ascent Syst&egrave;mes
            </a>
          </span>
          <div className="flex items-center justify-center gap-3">
            <ServerHealthIndicator />
            <div className="w-px h-3 bg-border" />
            <button
              onClick={() => setShowConfigImport(true)}
              className="flex items-center gap-1 text-[11px] text-text-tertiary hover:text-accent transition-colors"
            >
              <Upload className="w-3 h-3" />
              Load Config
            </button>
          </div>
          <a
            href="https://github.com/ZlatanOmerovic/firebird-web-client"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-text-tertiary hover:text-accent transition-colors flex items-center gap-1.5 justify-self-end"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
            firebird-web-client
          </a>
        </div>
      </div>
      {showConfigImport && <ConfigImportModal onClose={() => setShowConfigImport(false)} />}
    </div>
  );
}
