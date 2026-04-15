import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { EditorView } from '@codemirror/view';
import { indentUnit } from '@codemirror/language';
import { FirebirdSQL } from '../lib/firebirdDialect';
import { firebirdDarkTheme, firebirdLightTheme } from '../lib/firebirdTheme';
import { useSettings, modKey } from '../hooks/useSettings';
import { useSql } from '../hooks/useSql';
import type { QueryResult } from '../lib/api';
import { Play, Loader2, Clock, ChevronDown, ChevronUp, Trash2, ArrowUpDown, Search, Download } from 'lucide-react';
import { PaginationBar } from './PaginationBar';
import { DataFilterBar } from './DataFilterBar';
import { TruncateCell } from './TruncateCell';
import { CopyCell } from './CopyCell';
import { ExportModal, type ExportScope } from './ExportModal';
import { useColumnResize } from '../hooks/useColumnResize';
import { type FilterState, EMPTY_FILTER_STATE, applyClientFilters, hasActiveFilters } from '../lib/filters';

import { loadHistory, addHistoryEntry } from './HistoryPage';

function useFirebirdTheme() {
  return document.documentElement.classList.contains('dark') ? firebirdDarkTheme : firebirdLightTheme;
}

interface SqlEditorProps {
  onStatusUpdate: (info: { duration?: number }) => void;
}

export function SqlEditor({ onStatusUpdate }: SqlEditorProps) {
  const [query, setQuery] = useState('');
  const [queryName, setQueryName] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [sqlPage, setSqlPage] = useState(1);
  const [sqlFilters, setSqlFilters] = useState<FilterState>(EMPTY_FILTER_STATE);
  const SQL_PAGE_SIZE = 50;

  const handleSqlFiltersChange = useCallback((f: FilterState) => {
    setSqlFilters(f);
    setSqlPage(1);
  }, []);

  const sqlColumnKeys = useMemo(() => result?.fields.map((f) => f.name) ?? [], [result?.fields]);
  const [exportScope, setExportScope] = useState<ExportScope | null>(null);
  const { widths: sqlColWidths, startResize: sqlStartResize, totalWidth: sqlColTotal } = useColumnResize(sqlColumnKeys, 150, 'sql-results');
  const DEFAULT_EDITOR_HEIGHT = 250;
  const [editorHeight, setEditorHeight] = useState(() => {
    try {
      const saved = parseInt(localStorage.getItem('firebird-editor-height') ?? '', 10);
      return saved >= 120 && saved <= 600 ? saved : DEFAULT_EDITOR_HEIGHT;
    } catch { return DEFAULT_EDITOR_HEIGHT; }
  });
  const resizingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);
  const editorTheme = useFirebirdTheme();
  const settings = useSettings();

  const mutation = useSql();

  // Pick up query from History page "Run" button
  useEffect(() => {
    const pending = sessionStorage.getItem('firebird-run-query');
    if (pending) {
      setQuery(pending);
      sessionStorage.removeItem('firebird-run-query');
    }
  }, []);

  const execute = useCallback(() => {
    if (!query.trim()) return;
    setError(null);
    setSortCol(null);
    setSortDir('asc');
    runQuery(query.trim(), true);
  }, [query]);

  const runQuery = useCallback((sql: string, saveToHistory = false) => {
    setError(null);
    mutation.mutate(sql, {
      onSuccess: (data) => {
        if (saveToHistory) addHistoryEntry(query.trim(), data.duration, queryName);
        setResult(data);
        setSqlPage(1);
        setSqlFilters(EMPTY_FILTER_STATE);
        onStatusUpdate({ duration: data.duration });
      },
      onError: (err) => {
        setError(err instanceof Error ? err.message : 'Query failed');
        setResult(null);
      },
    });
  }, [query, queryName, mutation, onStatusUpdate]);

  const handleSort = useCallback((col: string) => {
    if (!query.trim()) return;
    const newDir = sortCol === col && sortDir === 'asc' ? 'desc' : 'asc';
    setSortCol(col);
    setSortDir(newDir);
    // Wrap original query with ORDER BY
    const baseQuery = query.trim().replace(/;\s*$/, '');
    const sortedSql = `SELECT * FROM (${baseQuery}) ORDER BY "${col}" ${newDir.toUpperCase()}`;
    runQuery(sortedSql);
  }, [query, sortCol, sortDir, runQuery]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = editorHeight;
    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = ev.clientY - startYRef.current;
      const h = Math.max(120, Math.min(600, startHeightRef.current + delta));
      setEditorHeight(h);
    };
    const onUp = () => {
      resizingRef.current = false;
      localStorage.setItem('firebird-editor-height', String(Math.max(120, Math.min(600, startHeightRef.current + (0)))));
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [editorHeight]);

  // Save height after state settles
  useEffect(() => {
    localStorage.setItem('firebird-editor-height', String(editorHeight));
  }, [editorHeight]);

  const handleResizeDoubleClick = useCallback(() => {
    setEditorHeight(DEFAULT_EDITOR_HEIGHT);
  }, []);

  const historyEntries = loadHistory();
  const history = historyEntries.map((e) => e.query);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="border-b border-border bg-bg-primary">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <button
              onClick={execute}
              disabled={mutation.isPending || !query.trim()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-accent hover:bg-accent-hover text-text-inverted rounded-lg disabled:opacity-50 transition-colors shadow-sm"
            >
              {mutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              Run
            </button>
            {settings.executeOnCtrlEnter && (
              <span className="text-[11px] text-text-tertiary font-mono">{modKey}+Enter</span>
            )}
          </div>

          {historyEntries.length > 0 && (
            <div className="relative">
              <button
                onClick={() => { setShowHistory(!showHistory); setHistorySearch(''); }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-lg transition-colors"
              >
                <Clock className="w-3 h-3" />
                History
                <span className="text-[10px] text-text-tertiary tabular-nums">{historyEntries.length}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
              </button>
              {showHistory && (
                <div className="absolute right-0 top-full mt-1 w-[420px] bg-bg-elevated border border-border rounded-xl shadow-[0_8px_24px_var(--color-shadow-lg)] z-20 overflow-hidden">
                  {/* Search */}
                  <div className="px-3 py-2 border-b border-border">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-tertiary" />
                      <input
                        type="text"
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                        placeholder="Search history..."
                        className="w-full pl-7 pr-2 py-1 bg-bg-primary border border-border rounded-md text-[11px] text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
                        autoFocus
                      />
                    </div>
                  </div>
                  {/* Items */}
                  <div className="max-h-72 overflow-y-auto">
                    {historyEntries
                      .filter((e) => !historySearch || e.query.toLowerCase().includes(historySearch.toLowerCase()) || (e.name?.toLowerCase().includes(historySearch.toLowerCase()) ?? false))
                      .slice(0, historySearch ? undefined : 7)
                      .map((entry, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setQuery(entry.query);
                          if (entry.name) setQueryName(entry.name);
                          setShowHistory(false);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-bg-tertiary border-b border-border-subtle last:border-b-0 transition-colors group"
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[11px] font-medium text-text-primary truncate flex-1">
                            {entry.name || <span className="text-text-tertiary font-normal italic">Unnamed query</span>}
                          </span>
                          <span className="flex items-center gap-1 text-[9px] text-text-tertiary shrink-0">
                            <Clock className="w-2 h-2" />
                            {(() => {
                              const diff = Date.now() - entry.timestamp;
                              if (diff < 60000) return 'now';
                              if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
                              if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
                              return `${Math.floor(diff / 86400000)}d`;
                            })()}
                          </span>
                          {entry.duration !== undefined && (
                            <span className="text-[9px] text-text-tertiary font-mono tabular-nums shrink-0">{entry.duration}ms</span>
                          )}
                        </div>
                        <p className="text-[11px] font-mono text-text-tertiary truncate">{entry.query}</p>
                      </button>
                    ))}
                    {historyEntries.filter((e) => !historySearch || e.query.toLowerCase().includes(historySearch.toLowerCase()) || (e.name?.toLowerCase().includes(historySearch.toLowerCase()) ?? false)).slice(0, historySearch ? undefined : 7).length === 0 && (
                      <div className="px-3 py-4 text-center text-[11px] text-text-tertiary">No matching queries</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <CodeMirror
          value={query}
          onChange={setQuery}
          extensions={[
            sql({ dialect: FirebirdSQL }),
            settings.editorWordWrap ? EditorView.lineWrapping : [],
            indentUnit.of(' '.repeat(settings.editorTabSize)),
          ].flat()}
          theme={editorTheme}
          height={`${editorHeight}px`}
          style={{ fontSize: `${settings.editorFontSize}px` }}
          basicSetup={{
            lineNumbers: settings.editorLineNumbers,
            foldGutter: false,
          }}
          onKeyDown={(e) => {
            if (settings.executeOnCtrlEnter && (e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault();
              execute();
            }
          }}
        />

        {/* Bottom action bar */}
        <div className="flex items-center gap-3 px-3 py-1.5 border-t border-border bg-bg-secondary">
          <div className="flex items-center gap-2 text-[11px] text-text-tertiary">
            <span>{query.split('\n').length} lines</span>
            <span className="text-border">|</span>
            <span>{query.length} chars</span>
          </div>
          <input
            type="text"
            value={queryName}
            onChange={(e) => setQueryName(e.target.value)}
            placeholder="Query name (optional)"
            className="flex-1 px-2.5 py-1 bg-bg-primary border border-accent/30 rounded-md text-[11px] text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
          />
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { setQuery(''); setQueryName(''); setResult(null); setError(null); }}
              disabled={!query}
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-text-tertiary hover:text-text-primary border border-border rounded-md hover:bg-bg-tertiary transition-colors disabled:opacity-30"
            >
              <Trash2 className="w-3 h-3" />Clear
            </button>
            <button
              onClick={execute}
              disabled={mutation.isPending || !query.trim()}
              className="flex items-center gap-1 px-3 py-1 text-[11px] font-medium bg-accent hover:bg-accent-hover text-[#ffffff] rounded-md disabled:opacity-50 transition-colors shadow-sm"
            >
              {mutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              Run
            </button>
          </div>
        </div>
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleResizeStart}
        onDoubleClick={handleResizeDoubleClick}
        className="h-1.5 bg-border hover:bg-accent/40 cursor-ns-resize transition-colors flex items-center justify-center"
      >
        <div className="w-8 h-0.5 bg-text-tertiary/30 rounded-full" />
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto bg-bg-primary">
        {error && (
          <div className="m-4 px-4 py-3 bg-error-subtle border border-error/20 rounded-lg text-error text-sm">
            {error}
          </div>
        )}

        {result && (() => {
          const filteredRows = hasActiveFilters(sqlFilters)
            ? applyClientFilters(result.rows, sqlFilters)
            : result.rows;
          const totalRows = filteredRows.length;
          const sqlTotalPages = Math.ceil(totalRows / SQL_PAGE_SIZE);
          const pageRows = totalRows > SQL_PAGE_SIZE
            ? filteredRows.slice((sqlPage - 1) * SQL_PAGE_SIZE, sqlPage * SQL_PAGE_SIZE)
            : filteredRows;

          const isFiltered = hasActiveFilters(sqlFilters);

          return (
            <>
              {/* Result stats */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-border text-xs text-text-secondary">
                <div className="flex items-center gap-4">
                  <span className="font-medium">
                    {isFiltered ? `${totalRows.toLocaleString()} of ${result.rows.length.toLocaleString()} rows` : `${totalRows.toLocaleString()} rows`}
                  </span>
                  <span className="flex items-center gap-1 font-mono tabular-nums">
                    <Clock className="w-3 h-3" />
                    {result.duration}ms
                  </span>
                  {result.rowsAffected !== result.rows.length && (
                    <span className="font-medium">{result.rowsAffected} affected</span>
                  )}
                </div>
                {totalRows > 0 && (
                  <button
                    onClick={() => setExportScope({ type: 'rows', tableName: 'query_result', columns: sqlColumnKeys, rows: filteredRows })}
                    className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-text-tertiary hover:text-text-primary border border-border rounded-md hover:bg-bg-tertiary transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    Export
                  </button>
                )}
              </div>

              {/* Filter bar */}
              <DataFilterBar
                filters={sqlFilters}
                onFiltersChange={handleSqlFiltersChange}
                columns={result.fields.map((f) => ({ name: f.name, type: f.type }))}
              />
              {totalRows > SQL_PAGE_SIZE && (
                <PaginationBar page={sqlPage} totalPages={sqlTotalPages} total={totalRows} pageSize={SQL_PAGE_SIZE} onPageChange={setSqlPage} />
              )}

              {/* Result table */}
              {totalRows > 0 && (
                <div className="overflow-x-auto">
                  <table className="text-sm" style={{ tableLayout: 'fixed', width: sqlColTotal }}>
                    <thead className="sticky top-0 bg-bg-secondary">
                      <tr className="border-b border-border">
                        {result.fields.map((f) => (
                          <th
                            key={f.name}
                            onClick={() => handleSort(f.name)}
                            className="relative px-3 py-2.5 text-left text-xs font-medium text-text-secondary uppercase tracking-wide font-mono cursor-pointer hover:text-text-primary select-none transition-colors"
                            style={{ width: sqlColWidths[f.name] }}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="truncate">{f.name}</span>
                              {sortCol === f.name ? (
                                sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-accent shrink-0" /> : <ChevronDown className="w-3 h-3 text-accent shrink-0" />
                              ) : (
                                <ArrowUpDown className="w-2.5 h-2.5 text-text-tertiary shrink-0" />
                              )}
                            </div>
                            <div className="col-resize-handle" onMouseDown={(e) => { e.stopPropagation(); sqlStartResize(f.name, e.clientX); }} />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((row, i) => (
                        <tr
                          key={(sqlPage - 1) * SQL_PAGE_SIZE + i}
                          className="border-b border-border-subtle even:bg-row-alt hover:bg-row-hover transition-colors"
                        >
                          {result.fields.map((f) => (
                            <td key={f.name} className="px-3 py-2 text-text-primary font-mono text-[13px] overflow-hidden" style={{ width: sqlColWidths[f.name] }}>
                              <CopyCell value={row[f.name] === null ? '' : String(row[f.name])}>
                                <TruncateCell value={row[f.name] === null ? '' : String(row[f.name])}>
                                  {row[f.name] === null ? (
                                    <span className="text-text-tertiary italic text-xs">{settings.nullDisplay || '\u00A0'}</span>
                                  ) : (
                                    String(row[f.name])
                                  )}
                                </TruncateCell>
                              </CopyCell>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Bottom pagination */}
              {totalRows > SQL_PAGE_SIZE && (
                <PaginationBar page={sqlPage} totalPages={sqlTotalPages} total={totalRows} pageSize={SQL_PAGE_SIZE} onPageChange={setSqlPage} />
              )}
            </>
          );
        })()}
      </div>
      {exportScope && <ExportModal scope={exportScope} onClose={() => setExportScope(null)} />}
    </div>
  );
}
