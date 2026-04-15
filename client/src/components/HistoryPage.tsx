import { useState, useMemo, useRef } from 'react';
import { History, Play, Copy, Check, Trash2, Search, X, Clock, Terminal, Pencil, ChevronDown, ChevronUp } from 'lucide-react';
import { Tooltip } from './Tooltip';
import { Checkbox } from './Checkbox';
import { BulkDeleteModal } from './BulkDeleteModal';
import { SelectAllPopover } from './SelectAllPopover';
import { SqlHighlight } from './SqlHighlight';
import type { DbObjectSelection } from './Sidebar';

const HISTORY_KEY = 'firebird-sql-history-v2';
const LEGACY_KEY = 'firebird-sql-history';

export interface HistoryEntry {
  query: string;
  name?: string;
  timestamp: number;
  duration?: number;
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) return JSON.parse(raw);
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const queries: string[] = JSON.parse(legacy);
      const migrated: HistoryEntry[] = queries.map((q, i) => ({
        query: q,
        timestamp: Date.now() - i * 60000,
      }));
      localStorage.setItem(HISTORY_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch { /* ignore */ }
  return [];
}

export function saveHistory(entries: HistoryEntry[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
  localStorage.setItem(LEGACY_KEY, JSON.stringify(entries.map((e) => e.query)));
}

export function addHistoryEntry(query: string, duration?: number, name?: string): void {
  const entries = loadHistory().filter((e) => e.query !== query);
  const entry: HistoryEntry = { query, timestamp: Date.now(), duration };
  if (name?.trim()) entry.name = name.trim();
  entries.unshift(entry);
  try {
    const settings = JSON.parse(localStorage.getItem('firebird-settings') ?? '{}');
    const limit = settings.queryHistoryLimit;
    const max = typeof limit === 'number' ? limit : (limit === '∞' ? 99999 : 20);
    entries.splice(max);
  } catch { entries.splice(20); }
  saveHistory(entries);
}

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return new Date(ts).toLocaleDateString();
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

interface HistoryPageProps {
  onNavigate: (sel: DbObjectSelection) => void;
}

export function HistoryPage({ onNavigate }: HistoryPageProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>(loadHistory);
  const [search, setSearch] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [editingName, setEditingName] = useState<number | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [selectAllInDb, setSelectAllInDb] = useState(false);
  const [showSelectAllPopover, setShowSelectAllPopover] = useState(false);
  const historySelectAllRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!search) return entries;
    const q = search.toLowerCase();
    return entries.filter((e) => e.query.toLowerCase().includes(q) || (e.name?.toLowerCase().includes(q) ?? false));
  }, [entries, search]);

  const handleCopy = (query: string, index: number) => {
    navigator.clipboard.writeText(query).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
    });
  };

  const handleDelete = (index: number) => {
    const query = filtered[index].query;
    const updated = entries.filter((e) => e.query !== query);
    setEntries(updated);
    saveHistory(updated);
  };

  const handleClearAll = () => {
    setEntries([]);
    saveHistory([]);
  };

  const handleRun = (query: string) => {
    sessionStorage.setItem('firebird-run-query', query);
    onNavigate({ kind: 'sql' });
  };

  const allHistorySelected = filtered.length > 0 && filtered.every((_, i) => selectedIndices.has(i));
  const someHistorySelected = filtered.some((_, i) => selectedIndices.has(i));

  const toggleHistoryRow = (i: number) => {
    setSelectAllInDb(false);
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const toggleAllHistory = () => {
    if (allHistorySelected || selectAllInDb) {
      setSelectedIndices(new Set());
      setSelectAllInDb(false);
      setShowSelectAllPopover(false);
    } else {
      setSelectedIndices(new Set(filtered.map((_, i) => i)));
      if (entries.length > filtered.length) setShowSelectAllPopover(true);
    }
  };

  const handleSelectAllHistory = () => {
    setSelectAllInDb(true);
    setShowSelectAllPopover(false);
  };

  const handleBulkDeleteHistory = async () => {
    if (selectAllInDb) {
      setEntries([]);
      saveHistory([]);
    } else {
      const toRemove = new Set(Array.from(selectedIndices).map((i) => filtered[i].query));
      const updated = entries.filter((e) => !toRemove.has(e.query));
      setEntries(updated);
      saveHistory(updated);
    }
    setSelectedIndices(new Set());
    setSelectAllInDb(false);
  };

  const startEditName = (index: number) => {
    setEditingName(index);
    setEditNameValue(filtered[index].name ?? '');
  };

  const saveEditName = (index: number) => {
    const query = filtered[index].query;
    const updated = entries.map((e) =>
      e.query === query ? { ...e, name: editNameValue.trim() || undefined } : e
    );
    setEntries(updated);
    saveHistory(updated);
    setEditingName(null);
  };

  return (
    <div className="h-full overflow-auto bg-bg-primary">
      <div className="p-5 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-bg-tertiary flex items-center justify-center">
              <History className="w-4.5 h-4.5 text-text-secondary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-text-primary">Query History</h1>
              <p className="text-xs text-text-tertiary">{entries.length} {entries.length === 1 ? 'query' : 'queries'} stored</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(selectedIndices.size > 0 || selectAllInDb) && (
              <button onClick={() => setShowBulkDelete(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-error hover:bg-red-600 text-white rounded-lg transition-colors shadow-sm">
                <Trash2 className="w-3.5 h-3.5" />
                {selectAllInDb ? `Delete all ${entries.length} queries` : `Delete (${selectedIndices.size})`}
              </button>
            )}
            {entries.length > 0 && (
              <button onClick={handleClearAll} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-error hover:bg-error-subtle border border-error/20 rounded-lg transition-colors">
                <Trash2 className="w-3.5 h-3.5" />Clear All
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        {entries.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search queries..." className="w-full pl-9 pr-3 py-2 bg-bg-secondary border border-border rounded-lg text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"><X className="w-3.5 h-3.5" /></button>}
          </div>
        )}

        {/* Entries */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
            <Terminal className="w-8 h-8 mb-3" />
            <p className="text-sm font-medium">{search ? 'No matching queries' : 'No queries yet'}</p>
            <p className="text-xs mt-1">{search ? 'Try a different search term' : 'Run some SQL to see your history here'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.length > 1 && (
              <div className="flex items-center gap-2 px-1">
                <div ref={historySelectAllRef} className="flex items-center">
                  <Checkbox checked={allHistorySelected || selectAllInDb} indeterminate={!allHistorySelected && someHistorySelected && !selectAllInDb} onChange={toggleAllHistory} />
                </div>
                <span className="text-[11px] text-text-tertiary">Select all</span>
                <SelectAllPopover
                  totalCount={entries.length}
                  pageCount={filtered.length}
                  visible={showSelectAllPopover && allHistorySelected && !selectAllInDb}
                  anchorRef={historySelectAllRef}
                  onSelectAll={handleSelectAllHistory}
                  onClose={() => setShowSelectAllPopover(false)}
                  itemLabel="query"
                />
              </div>
            )}
            {filtered.map((entry, i) => (
              <div key={`${entry.timestamp}-${i}`} className={`border rounded-xl overflow-hidden group ${selectedIndices.has(i) ? 'border-accent/40 bg-accent-subtle/30' : 'border-border'}`}>
                {/* Panel header */}
                <div className="flex items-center gap-2 px-4 py-2 bg-bg-secondary border-b border-border">
                  <Checkbox checked={selectedIndices.has(i)} onChange={() => toggleHistoryRow(i)} />
                  {editingName === i ? (
                    <input
                      type="text"
                      value={editNameValue}
                      onChange={(e) => setEditNameValue(e.target.value)}
                      onBlur={() => saveEditName(i)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEditName(i); if (e.key === 'Escape') setEditingName(null); }}
                      className="flex-1 px-2 py-0.5 text-xs bg-bg-primary border border-accent rounded text-text-primary focus:outline-none"
                      autoFocus
                      placeholder="Enter query name..."
                    />
                  ) : (
                    <button onClick={() => startEditName(i)} className="flex items-center gap-1.5 min-w-0 flex-1 text-left">
                      {entry.name ? (
                        <span className="text-xs font-medium text-text-primary truncate">{entry.name}</span>
                      ) : (
                        <span className="text-xs text-text-tertiary italic">(not set)</span>
                      )}
                      <Pencil className="w-2.5 h-2.5 text-text-tertiary opacity-0 group-hover:opacity-100 shrink-0" />
                    </button>
                  )}

                  <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Tooltip content="Run in SQL Editor" placement="top">
                      <button onClick={() => handleRun(entry.query)} className="p-1 rounded text-accent hover:bg-accent-subtle transition-colors">
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    </Tooltip>
                    <Tooltip content="Copy" placement="top">
                      <button onClick={() => handleCopy(entry.query, i)} className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors">
                        {copiedIndex === i ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </Tooltip>
                    <Tooltip content="Delete" placement="top">
                      <button onClick={() => handleDelete(i)} className="p-1 rounded text-text-tertiary hover:text-error hover:bg-error-subtle transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </Tooltip>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Tooltip content={formatTimestamp(entry.timestamp)} placement="top">
                      <span className="flex items-center gap-1 text-[10px] text-text-tertiary">
                        <Clock className="w-2.5 h-2.5" />
                        {formatTimeAgo(entry.timestamp)}
                      </span>
                    </Tooltip>
                    {entry.duration !== undefined && (
                      <span className="text-[10px] text-text-tertiary font-mono tabular-nums">{entry.duration}ms</span>
                    )}
                  </div>
                </div>

                {/* SQL with syntax highlighting */}
                {(() => {
                  const lines = entry.query.split('\n').length;
                  const isLong = lines > 5;
                  const isExpanded = expanded.has(i);
                  return (
                    <div>
                      <div className={isLong && !isExpanded ? 'max-h-[6.5rem] overflow-hidden relative' : ''}>
                        <div className="[&>pre]:border-0 [&>pre]:rounded-none [&>pre]:border-t-0">
                          <SqlHighlight code={isLong && !isExpanded ? entry.query.split('\n').slice(0, 5).join('\n') + '\n...' : entry.query} />
                        </div>
                        {isLong && !isExpanded && (
                          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-bg-primary to-transparent" />
                        )}
                      </div>
                      {isLong && (
                        <button
                          onClick={() => setExpanded((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })}
                          className="w-full flex items-center justify-center gap-1 py-1.5 text-[10px] text-text-tertiary hover:text-accent border-t border-border-subtle transition-colors"
                        >
                          {isExpanded ? <><ChevronUp className="w-3 h-3" />Collapse</> : <><ChevronDown className="w-3 h-3" />Show {lines - 5} more lines</>}
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        )}

      </div>
      {showBulkDelete && (
        <BulkDeleteModal
          count={selectAllInDb ? entries.length : selectedIndices.size}
          itemLabel="query"
          onConfirm={handleBulkDeleteHistory}
          onClose={() => setShowBulkDelete(false)}
        />
      )}
    </div>
  );
}
