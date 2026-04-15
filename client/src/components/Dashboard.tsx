import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getServerInfo, getSidebarData, executeSql } from '../lib/api';
import { useConnectionStore } from '../store/connectionStore';
import { modKey } from '../hooks/useSettings';
import type { DbObjectSelection } from './Sidebar';
import type { QueryResult } from '../lib/api';
import {
  Table2, Eye, Play, Zap, Hash, Box, Terminal,
  Database, Server, Clock, HardDrive, User, Globe,
  Plus, Loader2, History, Copy, Check, Settings,
  Keyboard, Lightbulb, BarChart3, Layers, BookOpen, ExternalLink, Download,
} from 'lucide-react';

import { loadHistory } from './HistoryPage';
import { Tooltip } from './Tooltip';
import { ExportModal } from './ExportModal';

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return '—';
  const cleaned = dateStr.replace(/\s+\S+\/\S+$/, '').replace(' ', 'T') + 'Z';
  const d = new Date(cleaned);
  if (isNaN(d.getTime())) {
    const d2 = new Date(dateStr);
    if (isNaN(d2.getTime())) return '—';
    return formatDiff(Date.now() - d2.getTime());
  }
  return formatDiff(Date.now() - d.getTime());
}

function formatDiff(diff: number): string {
  if (diff < 0) return 'Just now';
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

const TIPS = [
  'Use aliases in databases.conf to connect with short names instead of full paths.',
  'Double-click a column header in the data grid to auto-sort.',
  'Firebird supports EXECUTE BLOCK for running anonymous PL/SQL-like code.',
  'Use GEN_UUID() to generate unique identifiers in Firebird.',
  'Views can be updatable in Firebird if they reference a single table with a primary key.',
  'FIRST and SKIP are Firebird\'s equivalent of LIMIT and OFFSET.',
  'Use RECREATE to drop and recreate a procedure/trigger in one statement.',
  'Firebird\'s LIST() aggregate function concatenates values — like GROUP_CONCAT in MySQL.',
];

interface DashboardProps {
  onNavigate: (sel: DbObjectSelection) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const currentDatabase = useConnectionStore((s) => s.currentDatabase);
  const serverInfo = useQuery({ queryKey: ['server-info'], queryFn: getServerInfo, staleTime: 60000, enabled: !!currentDatabase });
  const sidebar = useQuery({ queryKey: ['sidebar'], queryFn: getSidebarData, staleTime: 30000, enabled: !!currentDatabase });
  const { config, rawPassword } = useConnectionStore();
  const [copied, setCopied] = useState(false);
  const [quickSql, setQuickSql] = useState('');
  const [quickResult, setQuickResult] = useState<QueryResult | null>(null);
  const [quickError, setQuickError] = useState<string | null>(null);
  const [showDbExport, setShowDbExport] = useState(false);

  const info = serverInfo.data;
  const data = sidebar.data;
  const historyEntries = loadHistory();
  const history = historyEntries.map((e) => e.query);

  const connString = config ? `${config.user}:${rawPassword ?? '****'}@${config.host}:${config.port}/${config.database}` : '';
  const maskedConnString = config ? `${config.user}:****@${config.host}:${config.port}/${config.database}` : '';

  const handleCopy = () => {
    if (!connString) return;
    navigator.clipboard.writeText(connString).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  // Database overview
  const totalRows = data ? Object.values(data.counts).reduce((a, b) => a + b, 0) : 0;
  const totalObjects = data ? data.tables.length + data.views.length + data.procedures.length + data.triggers.length + data.generators.length + data.domains.length : 0;

  // Quick SQL
  const sqlMutation = useMutation({ mutationFn: (q: string) => executeSql(q) });

  const runQuickSql = useCallback(() => {
    if (!quickSql.trim()) return;
    setQuickError(null);
    setQuickResult(null);
    sqlMutation.mutate(quickSql.trim(), {
      onSuccess: (r) => setQuickResult(r),
      onError: (e) => setQuickError(e instanceof Error ? e.message : 'Query failed'),
    });
  }, [quickSql, sqlMutation]);

  // Rotating tips
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * TIPS.length));
  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((i) => (i + 1) % TIPS.length);
    }, 7000);
    return () => clearInterval(interval);
  }, []);

  const stats = [
    { label: 'Tables', count: data?.tables.length ?? 0, icon: Table2, color: 'text-blue-500 bg-blue-500/10' },
    { label: 'Views', count: data?.views.length ?? 0, icon: Eye, color: 'text-purple-500 bg-purple-500/10' },
    { label: 'Procedures', count: data?.procedures.length ?? 0, icon: Play, color: 'text-green-500 bg-green-500/10' },
    { label: 'Triggers', count: data?.triggers.length ?? 0, icon: Zap, color: 'text-yellow-500 bg-yellow-500/10' },
    { label: 'Generators', count: data?.generators.length ?? 0, icon: Hash, color: 'text-orange-500 bg-orange-500/10' },
    { label: 'Domains', count: data?.domains.length ?? 0, icon: Box, color: 'text-pink-500 bg-pink-500/10' },
  ];

  const statActions: Record<string, () => void> = {
    Tables: () => data?.tables[0] && onNavigate({ kind: 'table', name: data.tables[0] }),
    Views: () => data?.views[0] && onNavigate({ kind: 'view', name: data.views[0] }),
    Procedures: () => data?.procedures[0] && onNavigate({ kind: 'procedure', name: data.procedures[0] }),
    Triggers: () => data?.triggers[0] && onNavigate({ kind: 'trigger', name: data.triggers[0].name }),
    Generators: () => onNavigate({ kind: 'generators' }),
    Domains: () => onNavigate({ kind: 'domains' }),
  };

  const shortcuts = [
    { keys: `${modKey}+Enter`, desc: 'Run SQL query' },
    { keys: `${modKey}+S`, desc: 'Save (in editors)' },
    { keys: `${modKey}+K`, desc: 'Focus search' },
    { keys: 'Click column', desc: 'Sort asc/desc' },
    { keys: 'Scroll down', desc: 'Load more (infinite)' },
  ];

  return (
    <div className="h-full overflow-auto bg-bg-primary p-5">
      <div className="space-y-4">

        {/* Header + Quick Actions */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Dashboard</h1>
            <p className="text-xs text-text-tertiary mt-0.5">
              {info?.databasePath ? info.databasePath.split('/').pop() ?? info.databasePath : 'Loading...'}
              {info?.firebirdVersion && <span className="ml-2 text-accent">Firebird {info.firebirdVersion}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onNavigate({ kind: 'settings' } as DbObjectSelection)} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary border border-border rounded-lg hover:bg-bg-tertiary transition-colors">
              <Settings className="w-3.5 h-3.5" />Settings
            </button>
            <div className="flex items-center bg-accent-subtle border border-accent/20 rounded-lg overflow-hidden">
              <span className="px-2 py-1.5 text-[10px] text-accent font-semibold uppercase tracking-wide border-r border-accent/20 bg-accent/20">New</span>
              <button onClick={() => onNavigate({ kind: 'new-table' })} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 transition-colors border-r border-accent/20">
                <Table2 className="w-3 h-3" />Table
              </button>
              <button onClick={() => onNavigate({ kind: 'new-view' })} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 transition-colors border-r border-accent/20">
                <Eye className="w-3 h-3" />View
              </button>
              <button onClick={() => onNavigate({ kind: 'new-procedure' })} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 transition-colors">
                <Play className="w-3 h-3" />Proc
              </button>
            </div>
            <button onClick={() => onNavigate({ kind: 'sql' })} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent hover:bg-accent-hover text-[#ffffff] rounded-lg transition-colors shadow-sm">
              <Terminal className="w-3.5 h-3.5" />SQL Editor
            </button>
            <button onClick={() => setShowDbExport(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary border border-border rounded-lg hover:bg-bg-tertiary transition-colors">
              <Download className="w-3.5 h-3.5" />Export DB
            </button>
          </div>
        </div>

        {/* Database Overview — compact bar */}
        <div className="flex gap-3">
          <div className="flex items-center gap-2.5 px-4 py-2 bg-bg-secondary border border-border rounded-xl">
            <BarChart3 className="w-3.5 h-3.5 text-accent" />
            <span className="text-[11px] text-text-secondary">Total Rows</span>
            <span className="text-sm font-bold text-text-primary tabular-nums">{totalRows.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2.5 px-4 py-2 bg-bg-secondary border border-border rounded-xl">
            <Layers className="w-3.5 h-3.5 text-accent" />
            <span className="text-[11px] text-text-secondary">Total Objects</span>
            <span className="text-sm font-bold text-text-primary tabular-nums">{totalObjects}</span>
          </div>
          <div className="flex items-center gap-2.5 px-4 py-2 bg-bg-secondary border border-border rounded-xl">
            <History className="w-3.5 h-3.5 text-accent" />
            <span className="text-[11px] text-text-secondary">Queries Run</span>
            <span className="text-sm font-bold text-text-primary tabular-nums">{history.length}</span>
          </div>
          <div className="flex-1 flex items-center gap-2.5 px-4 py-2 bg-accent-subtle border border-accent/20 rounded-xl">
            <Lightbulb className="w-3.5 h-3.5 text-accent shrink-0" />
            <span key={tipIndex} className="text-[11px] text-text-secondary truncate flex-1 animate-[fadeIn_0.5s_ease-out]">{TIPS[tipIndex]}</span>
            <a
              href="https://www.firebirdsql.org/file/documentation/html/en/refdocs/fblangref50/firebird-50-language-reference.html"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-[10px] text-accent hover:underline whitespace-nowrap"
            >
              Docs →
            </a>
          </div>

          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(4px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>

        {/* Stats Grid */}
        <div className="flex gap-2">
          {stats.map((s) => (
            <button
              key={s.label}
              onClick={statActions[s.label]}
              className="flex-1 flex items-center gap-2.5 px-3 py-2.5 bg-bg-secondary border border-border rounded-xl hover:bg-bg-tertiary transition-colors"
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${s.color}`}>
                <s.icon className="w-3.5 h-3.5" />
              </div>
              <div className="text-left min-w-0">
                <span className="text-lg font-bold text-text-primary tabular-nums leading-none">{s.count}</span>
                <span className="block text-[10px] text-text-tertiary uppercase tracking-wide mt-0.5">{s.label}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Quick SQL */}
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 bg-bg-secondary border-b border-border">
            <Terminal className="w-3.5 h-3.5 text-text-tertiary" />
            <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">Quick SQL</span>
            <span className="ml-auto text-[10px] text-text-tertiary font-mono">{modKey}+Enter to run</span>
          </div>
          <div className="flex items-center gap-2 p-2">
            <input
              type="text"
              value={quickSql}
              onChange={(e) => setQuickSql(e.target.value)}
              onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runQuickSql(); } }}
              placeholder="SELECT * FROM ..."
              className="flex-1 px-3 py-2 bg-bg-primary border border-border rounded-lg text-xs font-mono text-text-primary placeholder:text-text-tertiary focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
            />
            <button
              onClick={runQuickSql}
              disabled={sqlMutation.isPending || !quickSql.trim()}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-accent hover:bg-accent-hover text-[#ffffff] rounded-lg disabled:opacity-50 transition-colors"
            >
              {sqlMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              Run
            </button>
          </div>
          {quickError && (
            <div className="px-4 py-2 text-xs text-error bg-error-subtle border-t border-error/10">{quickError}</div>
          )}
          {quickResult && (
            <div className="border-t border-border">
              <div className="px-4 py-1.5 text-[11px] text-text-secondary flex items-center gap-3 bg-bg-secondary">
                <span>{quickResult.rows.length} rows</span>
                <span className="font-mono tabular-nums">{quickResult.duration}ms</span>
                {quickResult.rows.length > 0 && (
                  <button onClick={() => onNavigate({ kind: 'sql' })} className="ml-auto text-accent hover:underline text-[10px]">Open in SQL Editor →</button>
                )}
              </div>
              {quickResult.rows.length > 0 && (
                <div className="max-h-40 overflow-auto">
                  <table className="w-full text-[11px]">
                    <thead className="sticky top-0 bg-bg-secondary">
                      <tr className="border-b border-border">
                        {quickResult.fields.map((f) => (
                          <th key={f.name} className="px-3 py-1.5 text-left font-medium text-text-secondary font-mono">{f.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {quickResult.rows.slice(0, 10).map((row, i) => (
                        <tr key={i} className="border-b border-border-subtle even:bg-row-alt">
                          {quickResult.fields.map((f) => (
                            <td key={f.name} className="px-3 py-1 font-mono text-text-primary truncate max-w-[200px]">
                              {row[f.name] === null ? <span className="text-text-tertiary italic">NULL</span> : String(row[f.name])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {quickResult.rows.length > 10 && (
                    <div className="px-4 py-1.5 text-[10px] text-text-tertiary bg-bg-secondary border-t border-border">
                      Showing 10 of {quickResult.rows.length} rows — <button onClick={() => onNavigate({ kind: 'sql' })} className="text-accent hover:underline">open full results</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Connection Info */}
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 bg-bg-secondary border-b border-border">
            <Server className="w-3.5 h-3.5 text-text-tertiary" />
            <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">Connection Info</span>
          </div>
          <div className="grid grid-cols-5 divide-x divide-border-subtle">
            {[
              { label: 'Host', value: info ? `${info.host}:${info.port}` : '—' },
              { label: 'User', value: info?.currentUser ?? '—' },
              { label: 'Firebird', value: info?.firebirdVersion ?? '—' },
              { label: 'Connection', value: info?.connectionId ? `#${info.connectionId}` : '—' },
              { label: 'Connected', value: formatTimeAgo(info?.connectedAt ?? null) },
            ].map((item) => (
              <div key={item.label} className="px-4 py-2.5 text-center">
                <span className="block text-[10px] text-text-tertiary uppercase tracking-wide">{item.label}</span>
                <span className="block text-xs font-mono text-text-primary mt-0.5">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">

          {/* Server Info */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 bg-bg-secondary border-b border-border">
              <Server className="w-3.5 h-3.5 text-text-tertiary" />
              <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">Server</span>
            </div>
            {serverInfo.isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-4 h-4 animate-spin text-text-tertiary" />
              </div>
            ) : (
              <div className="divide-y divide-border-subtle">
                {[
                  { icon: User, label: 'User', value: info?.currentUser ?? '—' },
                  { icon: Globe, label: 'Protocol', value: info?.protocol ?? '—' },
                  { icon: Server, label: 'Host', value: info ? `${info.host}:${info.port}` : '—' },
                  { icon: Database, label: 'Database', value: info?.databasePath.split('/').pop() ?? '—' },
                  { icon: HardDrive, label: 'Conn ID', value: info?.connectionId ? `#${info.connectionId}` : '—' },
                  { icon: Clock, label: 'Connected', value: formatTimeAgo(info?.connectedAt ?? null) },
                ].map((row) => (
                  <div key={row.label} className="flex items-center gap-2.5 px-4 py-2">
                    <row.icon className="w-3 h-3 text-text-tertiary shrink-0" />
                    <span className="text-[11px] text-text-secondary">{row.label}</span>
                    <span className="text-[11px] font-mono text-text-primary ml-auto truncate max-w-[60%] text-right">{row.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Largest Tables */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 bg-bg-secondary border-b border-border">
              <Table2 className="w-3.5 h-3.5 text-text-tertiary" />
              <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">Largest Tables</span>
            </div>
            {data && data.tables.length > 0 ? (
              <div className="divide-y divide-border-subtle">
                {[...data.tables]
                  .sort((a, b) => (data.counts[b] ?? 0) - (data.counts[a] ?? 0))
                  .slice(0, 7)
                  .map((t) => (
                    <button
                      key={t}
                      onClick={() => onNavigate({ kind: 'table', name: t })}
                      className="w-full flex items-center justify-between px-4 py-1.5 hover:bg-bg-tertiary transition-colors"
                    >
                      <span className="text-[11px] font-mono text-text-primary">{t}</span>
                      <span className="text-[10px] font-mono text-text-tertiary tabular-nums">{(data.counts[t] ?? 0).toLocaleString()}</span>
                    </button>
                  ))}
              </div>
            ) : (
              <div className="flex items-center justify-center py-6 text-text-tertiary text-xs">No tables</div>
            )}
          </div>

          {/* Recent Queries + Shortcuts + Resources */}
          <div className="space-y-3">
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 bg-bg-secondary border-b border-border">
                <History className="w-3.5 h-3.5 text-text-tertiary" />
                <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">Recent Queries</span>
              </div>
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-text-tertiary">
                  <Terminal className="w-4 h-4 mb-1.5" />
                  <span className="text-[11px]">No queries yet</span>
                </div>
              ) : (
                <div className="divide-y divide-border-subtle">
                  {historyEntries.slice(0, 5).map((entry, i) => (
                    <button
                      key={i}
                      onClick={() => onNavigate({ kind: 'sql' })}
                      className="w-full px-4 py-1.5 text-left hover:bg-bg-tertiary transition-colors"
                    >
                      {entry.name && (
                        <span className="inline-block px-1 py-0.5 mb-0.5 text-[8px] font-medium bg-accent-subtle text-accent rounded">{entry.name}</span>
                      )}
                      <p className="text-[11px] font-mono text-text-primary truncate">{entry.query}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Keyboard Shortcuts */}
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 bg-bg-secondary border-b border-border">
                <Keyboard className="w-3.5 h-3.5 text-text-tertiary" />
                <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">Shortcuts</span>
              </div>
              <div className="divide-y divide-border-subtle">
                {shortcuts.map((s) => (
                  <div key={s.keys} className="flex items-center justify-between px-4 py-1.5">
                    <span className="text-[11px] text-text-secondary">{s.desc}</span>
                    <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-bg-tertiary border border-border rounded text-text-primary">{s.keys}</kbd>
                  </div>
                ))}
              </div>
            </div>

            {/* Firebird Resources */}
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 bg-bg-secondary border-b border-border">
                <BookOpen className="w-3.5 h-3.5 text-text-tertiary" />
                <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">Resources</span>
              </div>
              <div className="divide-y divide-border-subtle">
                {[
                  { label: 'Firebird 5.0 Language Reference', url: 'https://www.firebirdsql.org/file/documentation/html/en/refdocs/fblangref50/firebird-50-language-reference.html' },
                  { label: 'Release Notes', url: 'https://www.firebirdsql.org/en/release-notes/' },
                  { label: 'Reference Manuals', url: 'https://www.firebirdsql.org/en/reference-manuals/' },
                  { label: 'Database Aliases', url: 'https://firebirdsql.org/rlsnotesh/config-db-alias.html' },
                  { label: 'Firebird Official Site', url: 'https://www.firebirdsql.org/' },
                ].map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between px-4 py-1.5 hover:bg-bg-tertiary transition-colors"
                  >
                    <span className="text-[11px] text-text-secondary hover:text-accent transition-colors">{link.label}</span>
                    <ExternalLink className="w-2.5 h-2.5 text-text-tertiary" />
                  </a>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* Database path + Connection string */}
        <div className="flex gap-3">
          <div className="flex-1 flex items-center gap-2 px-4 py-2 bg-bg-secondary border border-border rounded-xl">
            <Database className="w-3 h-3 text-text-tertiary shrink-0" />
            <span className="text-[10px] text-text-tertiary shrink-0">Database:</span>
            <span className="text-[10px] font-mono text-text-secondary truncate">{info?.databasePath ?? '—'}</span>
          </div>
          <div className="flex-1 flex items-center gap-2 px-4 py-2 bg-bg-secondary border border-border rounded-xl">
            <Server className="w-3 h-3 text-text-tertiary shrink-0" />
            <span className="text-[10px] text-text-tertiary shrink-0">Connection:</span>
            <span className="text-[10px] font-mono text-text-secondary truncate">{maskedConnString}</span>
            {connString && (
              <Tooltip content="Copy full connection string" placement="top">
                <button
                  onClick={handleCopy}
                  className="shrink-0 p-0.5 rounded text-text-tertiary hover:text-text-primary transition-colors ml-auto"
                >
                  {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                </button>
              </Tooltip>
            )}
          </div>
        </div>

      </div>
      {showDbExport && <ExportModal scope={{ type: 'database' }} onClose={() => setShowDbExport(false)} />}
    </div>
  );
}
