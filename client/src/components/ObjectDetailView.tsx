import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getProcedureDetail,
  getTriggerDetail,
  getViewDetail,
  getTableRows,
  getProcedureDDL,
  getTriggerDDL,
  getDomainDDL,
  getGeneratorDDL,
  getGenerators,
  getDomains,
  createOrAlterView,
  dropView,
  createOrAlterProcedure,
  dropProcedure,
  createOrAlterTrigger,
  toggleTrigger,
  dropTrigger,
  createGenerator,
  setGeneratorValue,
  dropGenerator,
  createDomain,
  dropDomain,
  getTableSchema,
  deleteRow,
  updateRow,
  executeSql,
} from '../lib/api';
import { Loader2, Pencil, Trash2, Plus, Check, X, Power, RefreshCw, ChevronUp, ChevronDown, ArrowUpDown, Search, Download } from 'lucide-react';
import { PaginationBar } from './PaginationBar';
import { DataFilterBar } from './DataFilterBar';
import { TruncateCell } from './TruncateCell';
import { Checkbox } from './Checkbox';
import { BulkDeleteModal } from './BulkDeleteModal';
import { SelectAllPopover } from './SelectAllPopover';
import { InlineEditCell } from './InlineEditCell';
import { CopyCell } from './CopyCell';
import { RowCopyMenu } from './RowCopyMenu';
import { ExportModal, type ExportScope } from './ExportModal';
import { useColumnResize } from '../hooks/useColumnResize';
import { type FilterState, EMPTY_FILTER_STATE, hasActiveFilters } from '../lib/filters';
import { Tooltip } from './Tooltip';
import { useSettings } from '../hooks/useSettings';
import { FirebirdCodeEditor } from './FirebirdCodeEditor';
import { SqlHighlight } from './SqlHighlight';
import { RowEditor } from './RowEditor';
import { SchemaView } from './SchemaView';
import { actionToast, toast } from './Toast';

function Loading() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-5 h-5 animate-spin text-text-tertiary" />
    </div>
  );
}

function ErrorBanner({ error, onDismiss }: { error: string; onDismiss: () => void }) {
  return (
    <div className="flex items-start gap-2 px-4 py-3 bg-error-subtle border border-error/20 rounded-lg text-error text-sm">
      <span className="flex-1">{error}</span>
      <button onClick={onDismiss} className="text-error/50 hover:text-error"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}

function CodeViewer({ code }: { code: string | null }) {
  return <SqlHighlight code={code} />;
}

function BtnRefresh({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip content="Refresh" placement="bottom">
      <button onClick={onClick} className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary rounded-lg transition-colors">
        <RefreshCw className="w-3.5 h-3.5" />
      </button>
    </Tooltip>
  );
}

function BtnPrimary({ onClick, disabled, loading, children }: { onClick: () => void; disabled?: boolean; loading?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled || loading} className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-accent hover:bg-accent-hover text-text-inverted rounded-lg disabled:opacity-50 transition-colors shadow-sm">
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
      {children}
    </button>
  );
}

function BtnDanger({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-error hover:bg-error-subtle border border-error/20 rounded-lg disabled:opacity-50 transition-colors">
      {children}
    </button>
  );
}

function BtnSecondary({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary border border-border rounded-lg hover:bg-bg-tertiary transition-colors">
      {children}
    </button>
  );
}

// ── Views ───────────────────────────────────────────────────────

export function ViewDetailView({ name }: { name: string }) {
  const { data, isLoading } = useQuery({ queryKey: ['view', name], queryFn: () => getViewDetail(name) });
  const [activeTab, setActiveTab] = useState<'data' | 'schema' | 'source'>('data');
  const [page, setPage] = useState(1);
  const viewSettings = useSettings();
  const pageSize = viewSettings.pageSize;
  const [orderBy, setOrderBy] = useState<string | undefined>();
  const [orderDir, setOrderDir] = useState<'asc' | 'desc'>('asc');
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const [showInsert, setShowInsert] = useState(false);
  const [deletingPk, setDeletingPk] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDrop, setConfirmDrop] = useState(false);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTER_STATE);
  const queryClient = useQueryClient();

  const handleFiltersChange = (f: FilterState) => { setFilters(f); setPage(1); };

  // Shift+Enter to insert new row
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === 'Enter' && activeTab === 'data' && !showInsert && !editRow) {
        e.preventDefault();
        setShowInsert(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [activeTab, showInsert, editRow]);

  const schemaQuery = useQuery({
    queryKey: ['schema', name],
    queryFn: () => getTableSchema(name),
  });

  const pkColumn = schemaQuery.data?.find((c) => c.primaryKey)?.name;
  // Fall back to first column as row identifier when view has no PK
  const rowKeyColumn = pkColumn ?? schemaQuery.data?.[0]?.name ?? null;

  const viewSchemaMap = useMemo(() => {
    const map = new Map<string, { type: string; nullable: boolean; primaryKey: boolean; length?: number; defaultValue?: string }>();
    for (const col of schemaQuery.data ?? []) map.set(col.name, col);
    return map;
  }, [schemaQuery.data]);

  const handleViewInlineSave = async (keyValue: string, columnName: string, newValue: unknown) => {
    const result = await updateRow(name, keyValue, { [columnName]: newValue });
    actionToast('Row updated', result.sql, result.duration);
    queryClient.invalidateQueries({ queryKey: ['rows', name] });
    queryClient.invalidateQueries({ queryKey: ['sidebar'] });
  };
  const activeFilters = hasActiveFilters(filters) ? filters : undefined;
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [selectAllInDb, setSelectAllInDb] = useState(false);
  const [showSelectAllPopover, setShowSelectAllPopover] = useState(false);
  const viewSelectAllRef = useRef<HTMLDivElement>(null);
  const [exportScope, setExportScope] = useState<ExportScope | null>(null);

  const rowsQuery = useQuery({
    queryKey: ['rows', name, page, pageSize, orderBy, orderDir, activeFilters],
    queryFn: () => getTableRows(name, page, pageSize, orderBy, orderDir, activeFilters),
    enabled: activeTab === 'data',
  });

  const total = rowsQuery.data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  const viewDataKeys = useMemo(() => rowsQuery.data?.rows[0] ? Object.keys(rowsQuery.data.rows[0]) : [], [rowsQuery.data?.rows]);
  const { widths: viewColWidths, startResize: viewStartResize, totalWidth: viewColTotal } = useColumnResize(viewDataKeys, 150, `view-${name}`);

  const startEdit = () => { setSource(data?.source ?? ''); setEditing(true); setError(null); };

  const save = async () => {
    setLoading(true); setError(null);
    try {
      const result = await createOrAlterView(name, source);
      actionToast('View saved', result.sql, result.duration);
      queryClient.invalidateQueries({ queryKey: ['view', name] });
      queryClient.invalidateQueries({ queryKey: ['rows', name] });
      queryClient.invalidateQueries({ queryKey: ['schema', name] });
      queryClient.invalidateQueries({ queryKey: ['sidebar'] });
      setEditing(false);
    } catch (err) { toast(err instanceof Error ? err.message : 'Failed', 'error'); setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setLoading(false); }
  };

  const handleDrop = async () => {
    setLoading(true); setError(null);
    try {
      const result = await dropView(name);
      actionToast('View dropped', result.sql, result.duration);
      queryClient.invalidateQueries({ queryKey: ['views'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar'] });
    } catch (err) { toast(err instanceof Error ? err.message : 'Failed', 'error'); setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setLoading(false); setConfirmDrop(false); }
  };

  const handleDeleteRow = async (pkValue: string) => {
    try {
      const result = await deleteRow(name, pkValue);
      actionToast('Row deleted', result.sql, result.duration);
      setDeletingPk(null);
      queryClient.invalidateQueries({ queryKey: ['rows', name] });
      queryClient.invalidateQueries({ queryKey: ['sidebar'] });
    } catch (err) { toast(err instanceof Error ? err.message : 'Failed', 'error'); }
  };

  const toggleRow = (key: string) => {
    setSelectAllInDb(false);
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const allRowKeys = useMemo(() => {
    if (!rowKeyColumn || !rowsQuery.data?.rows) return [];
    return rowsQuery.data.rows.map((r) => String(r[rowKeyColumn] ?? ''));
  }, [rowsQuery.data?.rows, rowKeyColumn]);

  const allSelected = allRowKeys.length > 0 && allRowKeys.every((k) => selectedRows.has(k));
  const someSelected = allRowKeys.some((k) => selectedRows.has(k));

  const toggleAll = () => {
    if (allSelected || selectAllInDb) {
      setSelectedRows(new Set());
      setSelectAllInDb(false);
      setShowSelectAllPopover(false);
    } else {
      setSelectedRows(new Set(allRowKeys));
      if (total > allRowKeys.length) setShowSelectAllPopover(true);
    }
  };

  const handleSelectAllInDb = () => {
    setSelectAllInDb(true);
    setShowSelectAllPopover(false);
  };

  const handleBulkDelete = async () => {
    const start = performance.now();
    if (selectAllInDb) {
      const deleteQuery = `DELETE FROM "${name}"`;
      const result = await executeSql(deleteQuery);
      actionToast(`All rows deleted from ${name}`, deleteQuery, result.duration);
    } else {
      for (const pk of selectedRows) {
        await deleteRow(name, pk);
      }
      const elapsed = Math.round(performance.now() - start);
      actionToast(`${selectedRows.size} row(s) deleted`, undefined, elapsed);
    }
    setSelectedRows(new Set());
    setSelectAllInDb(false);
    queryClient.invalidateQueries({ queryKey: ['rows', name] });
    queryClient.invalidateQueries({ queryKey: ['sidebar'] });
  };

  if (isLoading) return <Loading />;
  if (!data) return null;

  const tabClass = (active: boolean) =>
    `px-4 py-2.5 text-sm font-medium transition-colors relative ${
      active
        ? 'text-accent after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-accent after:rounded-full'
        : 'text-text-secondary hover:text-text-primary'
    }`;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['view', name] });
    queryClient.invalidateQueries({ queryKey: ['rows', name] });
    queryClient.invalidateQueries({ queryKey: ['schema', name] });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center justify-between border-b border-border bg-bg-primary">
        <div className="flex">
          <button onClick={() => setActiveTab('data')} className={tabClass(activeTab === 'data')}>Data</button>
          <button onClick={() => setActiveTab('schema')} className={tabClass(activeTab === 'schema')}>Schema</button>
          <button onClick={() => { setActiveTab('source'); setEditing(false); }} className={tabClass(activeTab === 'source')}>Source</button>
        </div>
        <div className="flex items-center gap-2 mr-3">
          <BtnRefresh onClick={refresh} />
          {activeTab === 'data' && (selectedRows.size > 0 || selectAllInDb) && rowKeyColumn && (
            <button
              onClick={() => setShowBulkDelete(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-error hover:bg-red-600 text-white rounded-lg transition-colors shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {selectAllInDb ? `Delete all ${total.toLocaleString()} rows` : `Delete (${selectedRows.size})`}
            </button>
          )}
          {activeTab === 'data' && (
            <>
              <Tooltip content={selectedRows.size > 0 ? `Export ${selectedRows.size} rows` : 'Export view'} placement="bottom">
                <button
                  onClick={() => {
                    if (selectedRows.size > 0 && rowKeyColumn) {
                      const selected = (rowsQuery.data?.rows ?? []).filter((r) => selectedRows.has(String(r[rowKeyColumn] ?? '')));
                      setExportScope({ type: 'rows', tableName: name, columns: viewDataKeys, rows: selected });
                    } else {
                      setExportScope({ type: 'table', tableName: name, totalRows: total });
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary border border-border rounded-lg hover:bg-bg-tertiary transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />Export
                </button>
              </Tooltip>
              <button onClick={() => setShowInsert(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent hover:bg-accent-hover text-[#ffffff] rounded-lg transition-colors shadow-sm">
                <Plus className="w-3.5 h-3.5" />Add Row
              </button>
            </>
          )}
          {activeTab === 'source' && !editing && (
            <BtnSecondary onClick={startEdit}><Pencil className="w-3.5 h-3.5" />Edit</BtnSecondary>
          )}
          {activeTab === 'source' && editing && (
            <>
              <BtnPrimary onClick={save} loading={loading}><Check className="w-3.5 h-3.5" />Save</BtnPrimary>
              <BtnSecondary onClick={() => setEditing(false)}>Cancel</BtnSecondary>
            </>
          )}
          {!confirmDrop ? (
            <BtnDanger onClick={() => setConfirmDrop(true)}><Trash2 className="w-3.5 h-3.5" />Drop</BtnDanger>
          ) : (
            <>
              <BtnDanger onClick={handleDrop}><Trash2 className="w-3.5 h-3.5" />Confirm</BtnDanger>
              <BtnSecondary onClick={() => setConfirmDrop(false)}>Cancel</BtnSecondary>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-3"><ErrorBanner error={error} onDismiss={() => setError(null)} /></div>
      )}

      {/* Filter bar + top pagination for data tab */}
      {activeTab === 'data' && (
        <DataFilterBar
          filters={filters}
          onFiltersChange={handleFiltersChange}
          columns={(schemaQuery.data ?? []).map((c) => ({ name: c.name, type: c.type }))}
        />
      )}
      {activeTab === 'data' && (
        <PaginationBar page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
      )}

      {/* Data tab */}
      {activeTab === 'data' && (
        <div className="flex-1 overflow-auto bg-bg-primary">
          {rowsQuery.isLoading ? (
            <Loading />
          ) : rowsQuery.data?.rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 text-text-tertiary">
              {hasActiveFilters(filters) ? (
                <>
                  <Search className="w-10 h-10 mb-4 text-text-tertiary/50" />
                  <p className="text-sm font-medium text-text-secondary mb-1">No results found</p>
                  <p className="text-xs mb-4">No rows match your current filters. Try adjusting or clearing them.</p>
                  <button
                    onClick={() => handleFiltersChange(EMPTY_FILTER_STATE)}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-accent hover:bg-accent-hover text-[#ffffff] rounded-lg transition-colors shadow-sm"
                  >
                    Clear Filters
                  </button>
                </>
              ) : (
                <>
                  <svg className="w-10 h-10 mb-4 text-text-tertiary/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" /><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" /></svg>
                  <p className="text-sm font-medium text-text-secondary mb-1">No data yet</p>
                  <p className="text-xs mb-4">This view is empty. Add some rows to get started.</p>
                  <button
                    onClick={() => setShowInsert(true)}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-accent hover:bg-accent-hover text-[#ffffff] rounded-lg transition-colors shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />Add First Row
                  </button>
                </>
              )}
            </div>
          ) : (
            <>
              <table className="text-sm" style={{ tableLayout: 'fixed', width: viewColTotal + 100 }}>
                <thead className="sticky top-0 bg-bg-secondary z-10">
                  <tr className="border-b border-border">
                    <th className="px-2 py-2.5 text-left" style={{ width: 100 }}>
                      <div ref={viewSelectAllRef} className="flex items-center">
                        {rowKeyColumn && <Checkbox checked={allSelected || selectAllInDb} indeterminate={!allSelected && someSelected && !selectAllInDb} onChange={toggleAll} />}
                      </div>
                      <SelectAllPopover
                        totalCount={total}
                        pageCount={allRowKeys.length}
                        visible={showSelectAllPopover && allSelected && !selectAllInDb}
                        anchorRef={viewSelectAllRef}
                        onSelectAll={handleSelectAllInDb}
                        onClose={() => setShowSelectAllPopover(false)}
                        itemLabel="row"
                      />
                    </th>
                    {rowsQuery.data?.rows[0] && Object.keys(rowsQuery.data.rows[0]).map((key) => (
                      <th
                        key={key}
                        onClick={() => {
                          if (orderBy === key) {
                            setOrderDir((d) => d === 'asc' ? 'desc' : 'asc');
                          } else {
                            setOrderBy(key);
                            setOrderDir('asc');
                          }
                          setPage(1);
                        }}
                        className="relative px-3 py-2.5 text-left text-xs font-medium text-text-secondary uppercase tracking-wide font-mono cursor-pointer hover:text-text-primary select-none transition-colors"
                        style={{ width: viewColWidths[key] }}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="truncate">{key}</span>
                          {orderBy === key ? (
                            orderDir === 'asc' ? <ChevronUp className="w-3 h-3 text-accent shrink-0" /> : <ChevronDown className="w-3 h-3 text-accent shrink-0" />
                          ) : (
                            <ArrowUpDown className="w-2.5 h-2.5 text-text-tertiary shrink-0" />
                          )}
                        </div>
                        <div className="col-resize-handle" onMouseDown={(e) => { e.stopPropagation(); viewStartResize(key, e.clientX); }} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rowsQuery.data?.rows.map((row, i) => {
                    const keyVal = rowKeyColumn ? String(row[rowKeyColumn] ?? '') : '';
                    const isDeleting = deletingPk === keyVal;
                    const isChecked = selectedRows.has(keyVal);
                    return (
                    <tr key={i} onClick={() => rowKeyColumn && toggleRow(keyVal)} className={`border-b border-border-subtle group transition-colors cursor-pointer ${isDeleting ? 'bg-error-subtle' : isChecked ? 'bg-accent-subtle' : 'even:bg-row-alt hover:bg-row-hover'}`}>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1">
                          {rowKeyColumn && <Checkbox checked={isChecked} onChange={() => toggleRow(keyVal)} />}
                          {isDeleting ? (
                            <div className="flex gap-1.5 ml-1">
                              <button onClick={() => handleDeleteRow(keyVal)} className="text-error text-xs font-medium hover:underline">Yes</button>
                              <button onClick={() => setDeletingPk(null)} className="text-text-secondary text-xs hover:underline">No</button>
                            </div>
                          ) : (
                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <RowCopyMenu columns={viewDataKeys} row={row} tableName={name} />
                              <button onClick={() => setEditRow(row)} className="p-1 rounded text-text-tertiary hover:text-accent hover:bg-accent-subtle transition-colors">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              {rowKeyColumn && (
                                <button onClick={() => setDeletingPk(keyVal)} className="p-1 rounded text-text-tertiary hover:text-error hover:bg-error-subtle transition-colors">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      {Object.entries(row).map(([key, val], j) => {
                        const colDef = viewSchemaMap.get(key);
                        const displayStr = val === null ? '' : String(val);
                        const isArrayVal = typeof val === 'string' && val === '[ARRAY]';
                        const displayContent = val === null
                          ? <span className="text-text-tertiary italic text-xs">{viewSettings.nullDisplay || '\u00A0'}</span>
                          : String(val);
                        return (
                          <td key={j} className="px-3 py-2 text-text-primary font-mono text-[13px] overflow-hidden" style={{ width: viewColWidths[key] }}>
                            <CopyCell value={displayStr}>
                              {rowKeyColumn && colDef ? (
                                <InlineEditCell
                                  value={val}
                                  columnName={key}
                                  columnType={colDef.type}
                                  nullable={colDef.nullable}
                                  hasDefault={!!colDef.defaultValue}
                                  maxLength={colDef.length}
                                  isPrimaryKey={colDef.primaryKey}
                                  isArray={isArrayVal}
                                  onSave={(newVal) => handleViewInlineSave(keyVal, key, newVal)}
                                >
                                  <TruncateCell value={displayStr}>{displayContent}</TruncateCell>
                                </InlineEditCell>
                              ) : (
                                <TruncateCell value={displayStr}>{displayContent}</TruncateCell>
                              )}
                            </CopyCell>
                          </td>
                        );
                      })}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
              <PaginationBar page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
            </>
          )}
        </div>
      )}

      {/* Schema tab */}
      {activeTab === 'schema' && (
        <div className="flex-1 overflow-auto bg-bg-primary">
          <SchemaView tableName={name} />
        </div>
      )}

      {/* Source tab */}
      {activeTab === 'source' && (
        <div className="flex-1 overflow-auto bg-bg-primary p-4">
          {editing ? (
            <FirebirdCodeEditor value={source} onChange={setSource} height="300px" />
          ) : (
            <CodeViewer code={data.source} />
          )}
        </div>
      )}

      {/* Row Editor Modal */}
      {(showInsert || editRow) && schemaQuery.data && (
        <RowEditor
          tableName={name}
          columns={schemaQuery.data}
          row={editRow}
          onClose={() => {
            setShowInsert(false);
            setEditRow(null);
          }}
        />
      )}
      {showBulkDelete && (
        <BulkDeleteModal
          count={selectAllInDb ? total : selectedRows.size}
          itemLabel="row"
          onConfirm={handleBulkDelete}
          onClose={() => setShowBulkDelete(false)}
        />
      )}
      {exportScope && <ExportModal scope={exportScope} onClose={() => setExportScope(null)} />}
    </div>
  );
}

// ── Procedures ──────────────────────────────────────────────────

export function ProcedureView({ name }: { name: string }) {
  const { data, isLoading } = useQuery({ queryKey: ['procedure', name], queryFn: () => getProcedureDetail(name) });
  const [activeTab, setActiveTab] = useState<'source' | 'ddl'>('source');
  const [editing, setEditing] = useState(false);
  const [sql, setSql] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDrop, setConfirmDrop] = useState(false);
  const [exportScope, setExportScope] = useState<ExportScope | null>(null);
  const queryClient = useQueryClient();

  const ddlQuery = useQuery({
    queryKey: ['ddl-procedure', name],
    queryFn: () => getProcedureDDL(name),
    enabled: activeTab === 'ddl',
  });

  const startEdit = () => {
    const ddl = ddlQuery.data?.ddl;
    if (ddl) { setSql(ddl); } else {
      const params = data?.inputParams.length ? `(${data.inputParams.join(', ')})` : '';
      const returns = data?.outputParams.length ? `\nRETURNS (${data.outputParams.join(', ')})` : '';
      const body = data?.source ?? 'BEGIN\n  /* ... */\nSUSPEND;\nEND';
      setSql(`CREATE OR ALTER PROCEDURE "${name}"${params}${returns}\nAS\n${body}`);
    }
    setEditing(true); setActiveTab('source'); setError(null);
  };

  const save = async () => {
    setLoading(true); setError(null);
    try {
      const result = await createOrAlterProcedure(sql);
      actionToast('Procedure saved', result.sql, result.duration);
      queryClient.invalidateQueries({ queryKey: ['procedure', name] });
      queryClient.invalidateQueries({ queryKey: ['ddl-procedure', name] });
      queryClient.invalidateQueries({ queryKey: ['procedures'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar'] });
      setEditing(false);
    } catch (err) { toast(err instanceof Error ? err.message : 'Failed', 'error'); setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setLoading(false); }
  };

  const handleDrop = async () => {
    setLoading(true); setError(null);
    try {
      const result = await dropProcedure(name);
      actionToast('Procedure dropped', result.sql, result.duration);
      queryClient.invalidateQueries({ queryKey: ['procedures'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar'] });
    } catch (err) { toast(err instanceof Error ? err.message : 'Failed', 'error'); setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setLoading(false); setConfirmDrop(false); }
  };

  if (isLoading) return <Loading />;
  if (!data) return null;

  const tabClass = (active: boolean) =>
    `px-4 py-2.5 text-sm font-medium transition-colors relative ${active ? 'text-accent after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-accent after:rounded-full' : 'text-text-secondary hover:text-text-primary'}`;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['procedure', name] });
    queryClient.invalidateQueries({ queryKey: ['ddl-procedure', name] });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-border bg-bg-primary">
        <div className="flex items-center gap-3">
          <div className="flex">
            <button onClick={() => { setActiveTab('source'); setEditing(false); }} className={tabClass(activeTab === 'source')}>Source</button>
            <button onClick={() => { setActiveTab('ddl'); setEditing(false); }} className={tabClass(activeTab === 'ddl')}>DDL</button>
          </div>
          {data.inputParams.length > 0 && (
            <div className="flex gap-1 ml-2">
              {data.inputParams.map((p) => <span key={p} className="px-1.5 py-0.5 rounded bg-accent-subtle text-accent text-[10px] font-mono">{p}</span>)}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 mr-3">
          <BtnRefresh onClick={refresh} />
          <Tooltip content="Export" placement="bottom">
            <button
              onClick={() => setExportScope({ type: 'rows', tableName: name, columns: ['DDL'], rows: [{ DDL: data?.source ?? '' }] })}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary border border-border rounded-lg hover:bg-bg-tertiary transition-colors"
            >
              <Download className="w-3.5 h-3.5" />Export DDL
            </button>
          </Tooltip>
          {activeTab === 'source' && !editing && <BtnSecondary onClick={startEdit}><Pencil className="w-3.5 h-3.5" />Edit</BtnSecondary>}
          {editing && <BtnPrimary onClick={save} loading={loading}><Check className="w-3.5 h-3.5" />Save</BtnPrimary>}
          {editing && <BtnSecondary onClick={() => setEditing(false)}>Cancel</BtnSecondary>}
          {!confirmDrop && <BtnDanger onClick={() => setConfirmDrop(true)}><Trash2 className="w-3.5 h-3.5" />Drop</BtnDanger>}
          {confirmDrop && <BtnDanger onClick={handleDrop}>Confirm</BtnDanger>}
          {confirmDrop && <BtnSecondary onClick={() => setConfirmDrop(false)}>Cancel</BtnSecondary>}
        </div>
      </div>
      {error && <div className="mx-4 mt-3"><ErrorBanner error={error} onDismiss={() => setError(null)} /></div>}

      {activeTab === 'source' && (
        <div className="flex-1 overflow-auto bg-bg-primary p-4">
          {editing ? (
            <FirebirdCodeEditor value={sql} onChange={setSql} height="400px" />
          ) : (
            <CodeViewer code={data.source} />
          )}
        </div>
      )}

      {activeTab === 'ddl' && (
        <div className="flex-1 overflow-auto bg-bg-primary p-4">
          {ddlQuery.isLoading ? <Loading /> : (
            <SqlHighlight code={ddlQuery.data?.ddl ?? '-- Failed to load DDL'} />
          )}
        </div>
      )}
      {exportScope && <ExportModal scope={exportScope} onClose={() => setExportScope(null)} />}
    </div>
  );
}

// ── Triggers ────────────────────────────────────────────────────

export function TriggerView({ name }: { name: string }) {
  const { data, isLoading } = useQuery({ queryKey: ['trigger', name], queryFn: () => getTriggerDetail(name) });
  const [activeTab, setActiveTab] = useState<'source' | 'ddl'>('source');
  const [editing, setEditing] = useState(false);
  const [sql, setSql] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDrop, setConfirmDrop] = useState(false);
  const [exportScope, setExportScope] = useState<ExportScope | null>(null);
  const queryClient = useQueryClient();

  const ddlQuery = useQuery({
    queryKey: ['ddl-trigger', name],
    queryFn: () => getTriggerDDL(name),
    enabled: activeTab === 'ddl',
  });

  const triggerTypeLabel = (type: number): string => {
    const phase = type % 2 === 1 ? 'BEFORE' : 'AFTER';
    const event = Math.ceil(type / 2);
    const events = ['INSERT', 'UPDATE', 'DELETE'];
    return `${phase} ${events[event - 1] ?? `TYPE ${type}`}`;
  };

  const startEdit = () => {
    const ddl = ddlQuery.data?.ddl;
    if (ddl) { setSql(ddl); } else {
      const typeLabel = data ? triggerTypeLabel(data.type) : 'BEFORE INSERT';
      const table = data?.table ? ` FOR "${data.table}"` : '';
      const body = data?.source ?? 'AS\nBEGIN\n  /* ... */\nEND';
      setSql(`CREATE OR ALTER TRIGGER "${name}"${table}\n${typeLabel}\n${body}`);
    }
    setEditing(true); setActiveTab('source'); setError(null);
  };

  const save = async () => {
    setLoading(true); setError(null);
    try {
      const result = await createOrAlterTrigger(sql);
      actionToast('Trigger saved', result.sql, result.duration);
      queryClient.invalidateQueries({ queryKey: ['trigger', name] });
      queryClient.invalidateQueries({ queryKey: ['ddl-trigger', name] });
      queryClient.invalidateQueries({ queryKey: ['triggers'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar'] });
      setEditing(false);
    } catch (err) { toast(err instanceof Error ? err.message : 'Failed', 'error'); setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setLoading(false); }
  };

  const handleToggle = async () => {
    if (!data) return;
    setLoading(true); setError(null);
    try {
      const result = await toggleTrigger(name, data.inactive);
      actionToast(data.inactive ? 'Trigger activated' : 'Trigger deactivated', result.sql, result.duration);
      queryClient.invalidateQueries({ queryKey: ['trigger', name] });
      queryClient.invalidateQueries({ queryKey: ['ddl-trigger', name] });
      queryClient.invalidateQueries({ queryKey: ['triggers'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar'] });
    } catch (err) { toast(err instanceof Error ? err.message : 'Failed', 'error'); setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setLoading(false); }
  };

  const handleDrop = async () => {
    setLoading(true); setError(null);
    try {
      const result = await dropTrigger(name);
      actionToast('Trigger dropped', result.sql, result.duration);
      queryClient.invalidateQueries({ queryKey: ['triggers'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar'] });
    } catch (err) { toast(err instanceof Error ? err.message : 'Failed', 'error'); setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setLoading(false); setConfirmDrop(false); }
  };

  if (isLoading) return <Loading />;
  if (!data) return null;

  const tabClass = (active: boolean) =>
    `px-4 py-2.5 text-sm font-medium transition-colors relative ${active ? 'text-accent after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-accent after:rounded-full' : 'text-text-secondary hover:text-text-primary'}`;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['trigger', name] });
    queryClient.invalidateQueries({ queryKey: ['ddl-trigger', name] });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-border bg-bg-primary">
        <div className="flex items-center gap-3">
          <div className="flex">
            <button onClick={() => { setActiveTab('source'); setEditing(false); }} className={tabClass(activeTab === 'source')}>Source</button>
            <button onClick={() => { setActiveTab('ddl'); setEditing(false); }} className={tabClass(activeTab === 'ddl')}>DDL</button>
          </div>
          {data.table && <span className="text-xs text-text-tertiary font-mono ml-2">{data.table}</span>}
          <span className="px-1.5 py-0.5 rounded bg-accent-subtle text-accent text-[10px] font-mono">{triggerTypeLabel(data.type)}</span>
          {data.inactive && <span className="px-1.5 py-0.5 text-[10px] font-medium bg-error-subtle text-error rounded">INACTIVE</span>}
        </div>
        <div className="flex items-center gap-2 mr-3">
          <BtnRefresh onClick={refresh} />
          <Tooltip content="Export" placement="bottom">
            <button
              onClick={() => setExportScope({ type: 'rows', tableName: name, columns: ['DDL'], rows: [{ DDL: data?.source ?? '' }] })}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary border border-border rounded-lg hover:bg-bg-tertiary transition-colors"
            >
              <Download className="w-3.5 h-3.5" />Export DDL
            </button>
          </Tooltip>
          <button onClick={handleToggle} disabled={loading} className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${data.inactive ? 'text-success border-success/20 hover:bg-success-subtle' : 'text-warning border-warning/20 hover:bg-warning/10'}`}>
            <Power className="w-3.5 h-3.5" />{data.inactive ? 'Activate' : 'Deactivate'}
          </button>
          {activeTab === 'source' && !editing && <BtnSecondary onClick={startEdit}><Pencil className="w-3.5 h-3.5" />Edit</BtnSecondary>}
          {editing && <BtnPrimary onClick={save} loading={loading}><Check className="w-3.5 h-3.5" />Save</BtnPrimary>}
          {editing && <BtnSecondary onClick={() => setEditing(false)}>Cancel</BtnSecondary>}
          {!confirmDrop && <BtnDanger onClick={() => setConfirmDrop(true)}><Trash2 className="w-3.5 h-3.5" />Drop</BtnDanger>}
          {confirmDrop && <BtnDanger onClick={handleDrop}>Confirm</BtnDanger>}
          {confirmDrop && <BtnSecondary onClick={() => setConfirmDrop(false)}>Cancel</BtnSecondary>}
        </div>
      </div>
      {error && <div className="mx-4 mt-3"><ErrorBanner error={error} onDismiss={() => setError(null)} /></div>}

      {activeTab === 'source' && (
        <div className="flex-1 overflow-auto bg-bg-primary p-4">
          {editing ? (
            <FirebirdCodeEditor value={sql} onChange={setSql} height="300px" />
          ) : (
            <CodeViewer code={data.source} />
          )}
        </div>
      )}

      {activeTab === 'ddl' && (
        <div className="flex-1 overflow-auto bg-bg-primary p-4">
          {ddlQuery.isLoading ? <Loading /> : (
            <SqlHighlight code={ddlQuery.data?.ddl ?? '-- Failed to load DDL'} />
          )}
        </div>
      )}
      {exportScope && <ExportModal scope={exportScope} onClose={() => setExportScope(null)} />}
    </div>
  );
}

// ── Generators ──────────────────────────────────────────────────

export function GeneratorsView() {
  const { data, isLoading } = useQuery({ queryKey: ['generators'], queryFn: getGenerators });
  const [activeTab, setActiveTab] = useState<'list' | 'ddl'>('list');
  const [adding, setAdding] = useState(false);
  const [sortCol, setSortCol] = useState<'name' | 'value' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState(0);
  const [editingGen, setEditingGen] = useState<string | null>(null);
  const [editValue, setEditValue] = useState(0);
  const [droppingGen, setDroppingGen] = useState<string | null>(null);
  const [ddlGen, setDdlGen] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportScope, setExportScope] = useState<ExportScope | null>(null);
  const queryClient = useQueryClient();

  const ddlQuery = useQuery({
    queryKey: ['ddl-generator', ddlGen],
    queryFn: () => getGeneratorDDL(ddlGen!),
    enabled: !!ddlGen,
  });

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setLoading(true); setError(null);
    try {
      const result = await createGenerator(newName.trim(), newValue || undefined);
      actionToast('Generator created', result.sql, result.duration);
      queryClient.invalidateQueries({ queryKey: ['generators'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar'] });
      setAdding(false); setNewName(''); setNewValue(0);
    } catch (err) { toast(err instanceof Error ? err.message : 'Failed', 'error'); setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setLoading(false); }
  };

  const handleSetValue = async (genName: string) => {
    setLoading(true); setError(null);
    try {
      const result = await setGeneratorValue(genName, editValue);
      actionToast('Generator value set', result.sql, result.duration);
      queryClient.invalidateQueries({ queryKey: ['generators'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar'] });
      setEditingGen(null);
    } catch (err) { toast(err instanceof Error ? err.message : 'Failed', 'error'); setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setLoading(false); }
  };

  const handleDrop = async (genName: string) => {
    setLoading(true); setError(null);
    try {
      const result = await dropGenerator(genName);
      actionToast('Generator dropped', result.sql, result.duration);
      queryClient.invalidateQueries({ queryKey: ['generators'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar'] });
      setDroppingGen(null);
    } catch (err) { toast(err instanceof Error ? err.message : 'Failed', 'error'); setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setLoading(false); }
  };

  if (isLoading) return <Loading />;

  const tabClass = (active: boolean) =>
    `px-4 py-2.5 text-sm font-medium transition-colors relative ${active ? 'text-accent after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-accent after:rounded-full' : 'text-text-secondary hover:text-text-primary'}`;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-border bg-bg-primary">
        <div className="flex">
          <button onClick={() => { setActiveTab('list'); setDdlGen(null); }} className={tabClass(activeTab === 'list')}>List</button>
          <button onClick={() => setActiveTab('ddl')} className={tabClass(activeTab === 'ddl')}>DDL</button>
        </div>
        <div className="flex items-center gap-2 mr-3">
          <BtnRefresh onClick={() => queryClient.invalidateQueries({ queryKey: ['generators'] })} />
          <Tooltip content="Export" placement="bottom">
            <button
              onClick={() => setExportScope({ type: 'rows', tableName: 'generators', columns: ['name', 'value'], rows: (data ?? []).map(g => ({ name: g.name, value: g.value })) })}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary border border-border rounded-lg hover:bg-bg-tertiary transition-colors"
            >
              <Download className="w-3.5 h-3.5" />Export
            </button>
          </Tooltip>
          <button onClick={() => { setAdding(true); setError(null); setActiveTab('list'); }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent hover:bg-accent-hover text-text-inverted rounded-lg transition-colors shadow-sm">
            <Plus className="w-3.5 h-3.5" />New
          </button>
        </div>
      </div>

      {activeTab === 'ddl' && (
        <div className="flex-1 overflow-auto bg-bg-primary p-4">
          {!ddlGen ? (
            <div className="flex items-center justify-center h-full text-text-tertiary text-sm">Click DDL on a generator row to view its DDL</div>
          ) : ddlQuery.isLoading ? <Loading /> : (
            <SqlHighlight code={ddlQuery.data?.ddl ?? '-- Failed'} />
          )}
        </div>
      )}

      {activeTab === 'list' && (
      <div className="flex-1 overflow-auto bg-bg-primary p-4">
      {error && <div className="mb-4"><ErrorBanner error={error} onDismiss={() => setError(null)} /></div>}
      {(() => {
        const toggleGenSort = (col: 'name' | 'value') => {
          if (sortCol === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
          else { setSortCol(col); setSortDir('asc'); }
        };
        const sorted = data && sortCol ? [...data].sort((a, b) => {
          const av = sortCol === 'name' ? a.name : (a.value ?? 0);
          const bv = sortCol === 'name' ? b.name : (b.value ?? 0);
          const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
          return sortDir === 'asc' ? cmp : -cmp;
        }) : data;
        const totalValue = data?.reduce((s, g) => s + (Number(g.value) || 0), 0) ?? 0;
        const thCls = "px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wide cursor-pointer hover:text-text-primary select-none transition-colors";
        const SortI = ({ col }: { col: 'name' | 'value' }) => sortCol === col ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-accent" /> : <ChevronDown className="w-3 h-3 text-accent" />) : <ArrowUpDown className="w-2.5 h-2.5 text-text-tertiary" />;
        return (<>
      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-secondary text-left">
              <th onClick={() => toggleGenSort('name')} className={thCls}><div className="flex items-center gap-1.5">Name <SortI col="name" /></div></th>
              <th onClick={() => toggleGenSort('value')} className={thCls}><div className="flex items-center gap-1.5">Current Value <SortI col="value" /></div></th>
              <th className="px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wide w-28"></th>
            </tr>
          </thead>
          <tbody>
            {adding && (
              <tr className="border-b border-border bg-accent-subtle/50">
                <td className="px-4 py-2.5">
                  <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="GENERATOR_NAME" className="px-2 py-1 bg-bg-primary border border-border rounded text-text-primary font-mono text-[13px] focus:border-accent focus:outline-none w-full" autoFocus />
                </td>
                <td className="px-4 py-2.5">
                  <input type="number" value={newValue} onChange={(e) => setNewValue(parseInt(e.target.value, 10) || 0)} className="px-2 py-1 bg-bg-primary border border-border rounded text-text-primary font-mono text-[13px] focus:border-accent focus:outline-none w-28" />
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-1">
                    <button onClick={handleAdd} disabled={loading} className="p-1 rounded text-success hover:bg-success-subtle"><Check className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setAdding(false)} className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary"><X className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            )}
            {sorted?.map((gen) => (
              <tr key={gen.name} className={`border-b border-border-subtle last:border-b-0 even:bg-row-alt hover:bg-row-hover transition-colors group ${droppingGen === gen.name ? 'bg-error-subtle' : ''}`}>
                <td className="px-4 py-2.5 text-text-primary font-mono text-[13px]">{gen.name}</td>
                <td className="px-4 py-2.5 font-mono text-[13px] tabular-nums">
                  {editingGen === gen.name ? (
                    <div className="flex items-center gap-1">
                      <input type="number" value={editValue} onChange={(e) => setEditValue(parseInt(e.target.value, 10) || 0)} className="px-2 py-1 bg-bg-primary border border-border rounded text-text-primary font-mono text-[13px] focus:border-accent focus:outline-none w-28" autoFocus />
                      <button onClick={() => handleSetValue(gen.name)} disabled={loading} className="p-1 rounded text-success hover:bg-success-subtle"><Check className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setEditingGen(null)} className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded bg-accent-subtle text-accent text-xs">{gen.value ?? '\u2014'}</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {droppingGen === gen.name ? (
                    <div className="flex gap-1.5">
                      <button onClick={() => handleDrop(gen.name)} className="text-error text-xs font-medium hover:underline">Drop</button>
                      <button onClick={() => setDroppingGen(null)} className="text-text-secondary text-xs hover:underline">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingGen(gen.name); setEditValue(Number(gen.value) || 0); }} className="p-1 rounded text-text-tertiary hover:text-accent hover:bg-accent-subtle"><Pencil className="w-3.5 h-3.5" /></button>
                      <Tooltip content="Show DDL" placement="top"><button onClick={() => { setDdlGen(gen.name); setActiveTab('ddl'); }} className="p-1 rounded text-text-tertiary hover:text-accent hover:bg-accent-subtle"><code className="text-[9px]">DDL</code></button></Tooltip>
                      <button onClick={() => setDroppingGen(gen.name)} className="p-1 rounded text-text-tertiary hover:text-error hover:bg-error-subtle"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Footer */}
      <div className="mt-3 flex items-center justify-between text-[11px] text-text-secondary">
        <span>{data?.length ?? 0} generators</span>
        <span className="font-mono tabular-nums">Sum: {totalValue.toLocaleString()}</span>
      </div>
      </>); })()}
      </div>
      )}
      {exportScope && <ExportModal scope={exportScope} onClose={() => setExportScope(null)} />}
    </div>
  );
}

// ── Domains ─────────────────────────────────────────────────────

export function DomainsView() {
  const [domSortCol, setDomSortCol] = useState<string | null>(null);
  const [domSortDir, setDomSortDir] = useState<'asc' | 'desc'>('asc');
  const { data, isLoading } = useQuery({ queryKey: ['domains'], queryFn: getDomains });
  const [activeTab, setActiveTab] = useState<'list' | 'ddl'>('list');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'VARCHAR', length: 255, nullable: true, defaultValue: '', check: '' });
  const [droppingDomain, setDroppingDomain] = useState<string | null>(null);
  const [ddlDomain, setDdlDomain] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportScope, setExportScope] = useState<ExportScope | null>(null);
  const queryClient = useQueryClient();

  const ddlQuery = useQuery({
    queryKey: ['ddl-domain', ddlDomain],
    queryFn: () => getDomainDDL(ddlDomain!),
    enabled: !!ddlDomain,
  });

  const TYPES = ['SMALLINT', 'INTEGER', 'BIGINT', 'FLOAT', 'DOUBLE PRECISION', 'DATE', 'TIME', 'TIMESTAMP', 'CHAR', 'VARCHAR', 'BLOB'];
  const needsLength = form.type === 'VARCHAR' || form.type === 'CHAR';

  const handleAdd = async () => {
    if (!form.name.trim() || !form.type) return;
    setLoading(true); setError(null);
    try {
      const result = await createDomain({
        name: form.name.trim(),
        type: form.type,
        length: needsLength ? form.length : undefined,
        nullable: form.nullable,
        defaultValue: form.defaultValue.trim() || undefined,
        check: form.check.trim() || undefined,
      });
      actionToast('Domain created', result.sql, result.duration);
      queryClient.invalidateQueries({ queryKey: ['domains'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar'] });
      setAdding(false);
      setForm({ name: '', type: 'VARCHAR', length: 255, nullable: true, defaultValue: '', check: '' });
    } catch (err) { toast(err instanceof Error ? err.message : 'Failed', 'error'); setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setLoading(false); }
  };

  const handleDrop = async (domName: string) => {
    setLoading(true); setError(null);
    try {
      const result = await dropDomain(domName);
      actionToast('Domain dropped', result.sql, result.duration);
      queryClient.invalidateQueries({ queryKey: ['domains'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar'] });
      setDroppingDomain(null);
    } catch (err) { toast(err instanceof Error ? err.message : 'Failed', 'error'); setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setLoading(false); }
  };

  if (isLoading) return <Loading />;

  const tabClass2 = (active: boolean) =>
    `px-4 py-2.5 text-sm font-medium transition-colors relative ${active ? 'text-accent after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-accent after:rounded-full' : 'text-text-secondary hover:text-text-primary'}`;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-border bg-bg-primary">
        <div className="flex">
          <button onClick={() => { setActiveTab('list'); setDdlDomain(null); }} className={tabClass2(activeTab === 'list')}>List</button>
          <button onClick={() => setActiveTab('ddl')} className={tabClass2(activeTab === 'ddl')}>DDL</button>
        </div>
        <div className="flex items-center gap-2 mr-3">
          <BtnRefresh onClick={() => queryClient.invalidateQueries({ queryKey: ['domains'] })} />
          <Tooltip content="Export" placement="bottom">
            <button
              onClick={() => setExportScope({ type: 'rows', tableName: 'domains', columns: ['name', 'type', 'length', 'nullable', 'defaultValue', 'check'], rows: (data ?? []).map(d => ({ name: d.name, type: d.type, length: d.length, nullable: d.nullable, defaultValue: d.defaultValue, check: d.check })) })}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary border border-border rounded-lg hover:bg-bg-tertiary transition-colors"
            >
              <Download className="w-3.5 h-3.5" />Export
            </button>
          </Tooltip>
          <button onClick={() => { setAdding(true); setError(null); setActiveTab('list'); }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent hover:bg-accent-hover text-text-inverted rounded-lg transition-colors shadow-sm">
            <Plus className="w-3.5 h-3.5" />New
          </button>
        </div>
      </div>

      {activeTab === 'ddl' && (
        <div className="flex-1 overflow-auto bg-bg-primary p-4">
          {!ddlDomain ? (
            <div className="flex items-center justify-center h-full text-text-tertiary text-sm">Click DDL on a domain row to view its DDL</div>
          ) : ddlQuery.isLoading ? <Loading /> : (
            <SqlHighlight code={ddlQuery.data?.ddl ?? '-- Failed'} />
          )}
        </div>
      )}

      {activeTab === 'list' && (
      <div className="flex-1 overflow-auto bg-bg-primary p-4">
      {error && <div className="mb-4"><ErrorBanner error={error} onDismiss={() => setError(null)} /></div>}

      {adding && (
        <div className="mb-4 p-4 bg-bg-secondary border border-border rounded-xl space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-text-secondary mb-1 uppercase tracking-wide">Name</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="DOMAIN_NAME" className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded-lg text-text-primary font-mono text-sm focus:border-accent focus:outline-none" autoFocus />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-text-secondary mb-1 uppercase tracking-wide">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded-lg text-text-primary text-sm focus:border-accent focus:outline-none">
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {needsLength && (
              <div>
                <label className="block text-[11px] font-medium text-text-secondary mb-1 uppercase tracking-wide">Length</label>
                <input type="number" value={form.length} onChange={(e) => setForm({ ...form, length: parseInt(e.target.value, 10) || 0 })} className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded-lg text-text-primary font-mono text-sm focus:border-accent focus:outline-none" />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-text-secondary mb-1 uppercase tracking-wide">Default</label>
              <input type="text" value={form.defaultValue} onChange={(e) => setForm({ ...form, defaultValue: e.target.value })} placeholder="e.g. 0 or 'text'" className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded-lg text-text-primary font-mono text-sm focus:border-accent focus:outline-none placeholder:text-text-tertiary" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-text-secondary mb-1 uppercase tracking-wide">Check constraint</label>
              <input type="text" value={form.check} onChange={(e) => setForm({ ...form, check: e.target.value })} placeholder="e.g. VALUE > 0" className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded-lg text-text-primary font-mono text-sm focus:border-accent focus:outline-none placeholder:text-text-tertiary" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
              <input type="checkbox" checked={form.nullable} onChange={(e) => setForm({ ...form, nullable: e.target.checked })} className="w-3.5 h-3.5 rounded border-border text-accent" />
              Nullable
            </label>
            <div className="flex gap-2">
              <BtnSecondary onClick={() => setAdding(false)}>Cancel</BtnSecondary>
              <BtnPrimary onClick={handleAdd} loading={loading} disabled={!form.name.trim()}>Create</BtnPrimary>
            </div>
          </div>
        </div>
      )}

      {(() => {
        const toggleDomSort = (col: string) => {
          if (domSortCol === col) setDomSortDir((d) => d === 'asc' ? 'desc' : 'asc');
          else { setDomSortCol(col); setDomSortDir('asc'); }
        };
        const sortedDomains = data && domSortCol ? [...data].sort((a, b) => {
          const av = (a as unknown as Record<string, unknown>)[domSortCol];
          const bv = (b as unknown as Record<string, unknown>)[domSortCol];
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
          return domSortDir === 'asc' ? cmp : -cmp;
        }) : data;
        const nullableCount = data?.filter((d) => d.nullable).length ?? 0;
        const notNullCount = data?.filter((d) => !d.nullable).length ?? 0;
        const dthCls = "px-3 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wide cursor-pointer hover:text-text-primary select-none transition-colors";
        const DSortI = ({ col }: { col: string }) => domSortCol === col ? (domSortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-accent" /> : <ChevronDown className="w-3 h-3 text-accent" />) : <ArrowUpDown className="w-2.5 h-2.5 text-text-tertiary" />;
        return (<>
      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-secondary text-left">
              <th onClick={() => toggleDomSort('name')} className={dthCls}><div className="flex items-center gap-1.5">Name <DSortI col="name" /></div></th>
              <th onClick={() => toggleDomSort('type')} className={dthCls}><div className="flex items-center gap-1.5">Type <DSortI col="type" /></div></th>
              <th onClick={() => toggleDomSort('length')} className={`${dthCls} w-16`}><div className="flex items-center gap-1.5">Len <DSortI col="length" /></div></th>
              <th onClick={() => toggleDomSort('nullable')} className={`${dthCls} w-16`}><div className="flex items-center gap-1.5">Null <DSortI col="nullable" /></div></th>
              <th className="px-3 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wide">Default</th>
              <th className="px-3 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wide">Check</th>
              <th className="px-2 py-2.5 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {sortedDomains?.map((d) => (
              <tr key={d.name} className={`border-b border-border-subtle last:border-b-0 even:bg-row-alt hover:bg-row-hover transition-colors group ${droppingDomain === d.name ? 'bg-error-subtle' : ''}`}>
                <td className="px-3 py-2 text-text-primary font-mono text-[13px] whitespace-nowrap">{d.name}</td>
                <td className="px-3 py-2 whitespace-nowrap"><span className="px-1.5 py-0.5 rounded bg-accent-subtle text-accent text-xs">{d.type}</span></td>
                <td className="px-3 py-2 text-text-secondary font-mono text-[13px]">{d.length ?? '\u2014'}</td>
                <td className="px-3 py-2">
                  {d.nullable ? <span className="text-text-tertiary text-xs">YES</span> : <span className="text-xs px-1 py-0.5 rounded bg-error-subtle text-error whitespace-nowrap">NOT NULL</span>}
                </td>
                <td className="px-3 py-2 text-text-secondary font-mono text-xs max-w-28 truncate">{d.defaultValue ?? '\u2014'}</td>
                <td className="px-3 py-2 text-text-secondary font-mono text-xs max-w-32 truncate">{d.check ?? '\u2014'}</td>
                <td className="px-2 py-2 whitespace-nowrap">
                  {droppingDomain === d.name ? (
                    <div className="flex gap-1">
                      <button onClick={() => handleDrop(d.name)} className="text-error text-[11px] font-medium hover:underline">Drop</button>
                      <button onClick={() => setDroppingDomain(null)} className="text-text-secondary text-[11px] hover:underline">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex gap-0 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      <Tooltip content="Show DDL" placement="top"><button onClick={() => { setDdlDomain(d.name); setActiveTab('ddl'); }} className="p-1 rounded text-text-tertiary hover:text-accent hover:bg-accent-subtle"><code className="text-[9px]">DDL</code></button></Tooltip>
                      <button onClick={() => setDroppingDomain(d.name)} className="p-1 rounded text-text-tertiary hover:text-error hover:bg-error-subtle"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Footer */}
      <div className="mt-3 flex items-center justify-between text-[11px] text-text-secondary">
        <span>{data?.length ?? 0} domains</span>
        <span><span className="text-text-tertiary">{nullableCount} nullable</span> · <span className="text-error">{notNullCount} NOT NULL</span></span>
      </div>
      </>); })()}
      </div>
      )}
      {exportScope && <ExportModal scope={exportScope} onClose={() => setExportScope(null)} />}
    </div>
  );
}
