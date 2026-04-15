import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import { useQueryClient, useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { deleteRow, dropTable, getTableDDL, getTableRows, getTableSchema, executeSql, updateRow } from '../lib/api';
import { actionToast, toast } from './Toast';
import { SelectAllPopover } from './SelectAllPopover';
import { InlineEditCell } from './InlineEditCell';
import { CopyCell } from './CopyCell';
import { RowCopyMenu } from './RowCopyMenu';
import { ExportModal, type ExportScope } from './ExportModal';
import { SchemaView } from './SchemaView';
import { RowEditor } from './RowEditor';
import { SqlHighlight } from './SqlHighlight';
import { useSettings } from '../hooks/useSettings';

function formatDate(d: Date, fmt: string): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = d.getFullYear(), m = pad(d.getMonth() + 1), day = pad(d.getDate());
  const h = pad(d.getHours()), min = pad(d.getMinutes()), s = pad(d.getSeconds());
  const time = `${h}:${min}:${s}`;
  switch (fmt) {
    case 'eu': return `${day}.${m}.${y} ${time}`;
    case 'us': return `${m}/${day}/${y} ${time}`;
    case 'relative': {
      const diff = Date.now() - d.getTime();
      if (diff < 60000) return 'Just now';
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
      if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
      return `${y}-${m}-${day}`;
    }
    default: return `${y}-${m}-${day} ${time}`;
  }
}
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Plus,
  Loader2,
  ArrowUpDown,
  RefreshCw,
  Database,
  Search,
  Download,
} from 'lucide-react';
import { Tooltip } from './Tooltip';
import { Checkbox } from './Checkbox';
import { BulkDeleteModal } from './BulkDeleteModal';
import { PaginationBar } from './PaginationBar';
import { DataFilterBar } from './DataFilterBar';
import { TruncateCell } from './TruncateCell';
import { useColumnResize } from '../hooks/useColumnResize';
import { type FilterState, EMPTY_FILTER_STATE, hasActiveFilters } from '../lib/filters';

interface TableViewProps {
  tableName: string;
  onStatusUpdate: (info: { table: string; total: number; duration?: number }) => void;
}

export function TableView({ tableName, onStatusUpdate }: TableViewProps) {
  const settings = useSettings();
  const pageSize = settings.pageSize;
  const lazyLoad = settings.lazyLoadLists;
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [activeTab, setActiveTab] = useState<'data' | 'schema' | 'ddl'>('data');
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const [showInsert, setShowInsert] = useState(false);
  const [deletingPk, setDeletingPk] = useState<string | null>(null);
  const [confirmDropTable, setConfirmDropTable] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [selectAllInDb, setSelectAllInDb] = useState(false);
  const [showSelectAllPopover, setShowSelectAllPopover] = useState(false);
  const [exportScope, setExportScope] = useState<ExportScope | null>(null);
  const selectAllRef = useRef<HTMLDivElement>(null);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTER_STATE);

  const handleFiltersChange = useCallback((f: FilterState) => {
    setFilters(f);
    setPage(1);
  }, []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

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

  const orderBy = sorting[0]?.id;
  const orderDir = sorting[0]?.desc ? 'desc' as const : 'asc' as const;

  // Schema query — always runs
  const schemaQuery = useQuery({
    queryKey: ['schema', tableName],
    queryFn: () => getTableSchema(tableName),
  });

  const activeFilters = hasActiveFilters(filters) ? filters : undefined;

  // Paginated query — only when lazy load is OFF
  const rowsQuery = useQuery({
    queryKey: ['rows', tableName, page, pageSize, orderBy, orderDir, activeFilters],
    queryFn: () => getTableRows(tableName, page, pageSize, orderBy, orderDir, activeFilters),
    enabled: !lazyLoad,
  });

  // Infinite query — only when lazy load is ON
  const infiniteQuery = useInfiniteQuery({
    queryKey: ['rows-infinite', tableName, pageSize, orderBy, orderDir, activeFilters],
    queryFn: ({ pageParam = 1 }) => getTableRows(tableName, pageParam as number, pageSize, orderBy, orderDir, activeFilters),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.length * pageSize;
      return loaded < lastPage.total ? allPages.length + 1 : undefined;
    },
    initialPageParam: 1,
    enabled: lazyLoad,
  });

  // Intersection observer for infinite scroll
  useEffect(() => {
    if (!lazyLoad || !sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && infiniteQuery.hasNextPage && !infiniteQuery.isFetchingNextPage) {
          infiniteQuery.fetchNextPage();
        }
      },
      { root: scrollRef.current, threshold: 0.1 },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [lazyLoad, infiniteQuery.hasNextPage, infiniteQuery.isFetchingNextPage, infiniteQuery.fetchNextPage]);

  const queryClient = useQueryClient();

  // Merge data from either source
  const allRows = useMemo(() => {
    if (lazyLoad) return infiniteQuery.data?.pages.flatMap((p) => p.rows) ?? [];
    return rowsQuery.data?.rows ?? [];
  }, [lazyLoad, infiniteQuery.data?.pages, rowsQuery.data?.rows]);

  const total = lazyLoad
    ? infiniteQuery.data?.pages[0]?.total ?? 0
    : rowsQuery.data?.total ?? 0;

  const isLoading = lazyLoad ? infiniteQuery.isLoading : rowsQuery.isLoading;
  const totalPages = Math.ceil(total / pageSize);

  const dataColumnKeys = useMemo(() => allRows.length > 0 ? Object.keys(allRows[0]) : [], [allRows]);
  const { widths: colWidths, startResize, totalWidth: dataColTotal } = useColumnResize(dataColumnKeys, 150, `table-${tableName}`);

  const pkColumn = schemaQuery.data?.find((c) => c.primaryKey)?.name;

  const schemaMap = useMemo(() => {
    const map = new Map<string, { type: string; nullable: boolean; primaryKey: boolean; length?: number; defaultValue?: string }>();
    for (const col of schemaQuery.data ?? []) map.set(col.name, col);
    return map;
  }, [schemaQuery.data]);

  const handleInlineSave = useCallback(async (pkValue: string, columnName: string, newValue: unknown) => {
    const result = await updateRow(tableName, pkValue, { [columnName]: newValue });
    queryClient.invalidateQueries({ queryKey: ['rows', tableName] });
    queryClient.invalidateQueries({ queryKey: ['rows-infinite', tableName] });
    actionToast(`Updated ${columnName} in ${tableName}`, result.sql, result.duration);
  }, [tableName, queryClient]);

  const columnHelper = createColumnHelper<Record<string, unknown>>();

  const columns = useMemo(() => {
    if (!allRows.length) return [];
    const keys = Object.keys(allRows[0]);
    return keys.map((key) =>
      columnHelper.accessor(key, {
        header: key,
        cell: (info) => {
          const val = info.getValue();
          if (val === null) return <span className="text-text-tertiary italic text-xs">{settings.nullDisplay || '\u00A0'}</span>;
          if (val instanceof Date) return formatDate(val, settings.dateFormat);
          // Check if string looks like ISO date
          if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
            const d = new Date(val);
            if (!isNaN(d.getTime())) return formatDate(d, settings.dateFormat);
          }
          return String(val);
        },
      }),
    );
  }, [allRows, columnHelper]);

  const table = useReactTable({
    data: allRows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualSorting: true,
  });

  useEffect(() => {
    if (total > 0) {
      onStatusUpdate({ table: tableName, total });
    }
  }, [tableName, total, onStatusUpdate]);

  const handleDelete = async (pkValue: string) => {
    try {
      const result = await deleteRow(tableName, pkValue);
      setDeletingPk(null);
      queryClient.invalidateQueries({ queryKey: ['rows', tableName] });
      queryClient.invalidateQueries({ queryKey: ['rows-infinite', tableName] });
      queryClient.invalidateQueries({ queryKey: ['sidebar'] });
      actionToast(`Deleted row from ${tableName}`, result.sql, result.duration);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Delete failed', 'error');
    }
  };

  const handleDropTable = async () => {
    try {
      const result = await dropTable(tableName);
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar'] });
      actionToast(`Dropped table ${tableName}`, result.sql, result.duration);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Drop failed', 'error');
    }
  };

  const toggleRow = (pk: string) => {
    setSelectAllInDb(false);
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(pk)) next.delete(pk); else next.add(pk);
      return next;
    });
  };

  const allPks = useMemo(() => {
    if (!pkColumn) return [];
    return allRows.map((r) => String(r[pkColumn] ?? ''));
  }, [allRows, pkColumn]);

  const allSelected = allPks.length > 0 && allPks.every((pk) => selectedRows.has(pk));
  const someSelected = allPks.some((pk) => selectedRows.has(pk));

  const toggleAll = () => {
    if (allSelected || selectAllInDb) {
      setSelectedRows(new Set());
      setSelectAllInDb(false);
      setShowSelectAllPopover(false);
    } else {
      setSelectedRows(new Set(allPks));
      // Only show popover if there are more records in DB than currently loaded
      if (total > allRows.length) setShowSelectAllPopover(true);
    }
  };

  const handleSelectAllInDb = () => {
    setSelectAllInDb(true);
    setShowSelectAllPopover(false);
  };

  const handleBulkDelete = async () => {
    const start = performance.now();
    const count = selectAllInDb ? total : selectedRows.size;
    const sql = selectAllInDb ? `DELETE FROM "${tableName}"` : `-- Deleted ${count} rows from "${tableName}"`;
    if (selectAllInDb) {
      await executeSql(`DELETE FROM "${tableName}"`);
    } else {
      for (const pk of selectedRows) {
        await deleteRow(tableName, pk);
      }
    }
    const dur = Math.round(performance.now() - start);
    setSelectedRows(new Set());
    setSelectAllInDb(false);
    queryClient.invalidateQueries({ queryKey: ['rows', tableName] });
    queryClient.invalidateQueries({ queryKey: ['rows-infinite', tableName] });
    queryClient.invalidateQueries({ queryKey: ['sidebar'] });
    actionToast(`Deleted ${count} rows from ${tableName}`, sql, dur);
  };

  const tabClass = (active: boolean) =>
    `px-4 py-2.5 text-sm font-medium transition-colors relative ${
      active
        ? 'text-accent after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-accent after:rounded-full'
        : 'text-text-secondary hover:text-text-primary'
    }`;

  const ddlQuery = useQuery({
    queryKey: ['ddl', tableName],
    queryFn: () => getTableDDL(tableName),
    enabled: activeTab === 'ddl',
  });
  const ddlSql = ddlQuery.data?.ddl ?? '-- Loading...';

  if (activeTab === 'ddl') {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between border-b border-border bg-bg-primary">
          <div className="flex">
            <button onClick={() => setActiveTab('data')} className={tabClass(false)}>Data</button>
            <button onClick={() => setActiveTab('schema')} className={tabClass(false)}>Schema</button>
            <button onClick={() => setActiveTab('ddl')} className={tabClass(true)}>DDL</button>
          </div>
          <Tooltip content="Refresh" placement="bottom">
            <button
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['ddl', tableName] });
              }}
              className="p-1.5 mr-3 text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary rounded-lg transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        </div>
        <div className="flex-1 overflow-auto bg-bg-primary p-4">
          <SqlHighlight code={ddlSql} />
        </div>
      </div>
    );
  }

  if (activeTab === 'schema') {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between border-b border-border bg-bg-primary">
          <div className="flex">
            <button onClick={() => setActiveTab('data')} className={tabClass(false)}>
              Data
            </button>
            <button onClick={() => setActiveTab('schema')} className={tabClass(true)}>
              Schema
            </button>
            <button onClick={() => setActiveTab('ddl')} className={tabClass(false)}>
              DDL
            </button>
          </div>
          <div className="flex items-center gap-2 mr-3">
            <Tooltip content="Refresh" placement="bottom">
              <button
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['schema', tableName] });
                  queryClient.invalidateQueries({ queryKey: ['rows', tableName] });
                queryClient.invalidateQueries({ queryKey: ['rows-infinite', tableName] });
                }}
                className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary rounded-lg transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
            {!confirmDropTable ? (
              <button
                onClick={() => setConfirmDropTable(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-error hover:bg-error-subtle border border-error/20 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />Drop Table
              </button>
            ) : (
              <>
                <button onClick={handleDropTable} className="px-2.5 py-1.5 text-xs font-medium text-error hover:bg-error-subtle border border-error/20 rounded-lg transition-colors">Confirm Drop</button>
                <button onClick={() => setConfirmDropTable(false)} className="px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary border border-border rounded-lg hover:bg-bg-tertiary transition-colors">Cancel</button>
              </>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-bg-primary">
          <SchemaView tableName={tableName} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center justify-between border-b border-border bg-bg-primary">
        <div className="flex">
          <button onClick={() => setActiveTab('data')} className={tabClass(true)}>
            Data
          </button>
          <button onClick={() => setActiveTab('schema')} className={tabClass(false)}>
            Schema
          </button>
          <button onClick={() => setActiveTab('ddl')} className={tabClass(false)}>
            DDL
          </button>
        </div>
        <div className="flex items-center gap-2 mr-3">
          <Tooltip content="Refresh" placement="bottom">
            <button
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['rows', tableName] });
                queryClient.invalidateQueries({ queryKey: ['rows-infinite', tableName] });
                queryClient.invalidateQueries({ queryKey: ['schema', tableName] });
              }}
              className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary rounded-lg transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
          <Tooltip content={selectedRows.size > 0 ? `Export ${selectedRows.size} rows` : 'Export table'} placement="bottom">
            <button
              onClick={() => {
                if (selectedRows.size > 0) {
                  const selected = allRows.filter((r) => pkColumn && selectedRows.has(String(r[pkColumn] ?? '')));
                  setExportScope({ type: 'rows', tableName, columns: dataColumnKeys, rows: selected });
                } else {
                  setExportScope({ type: 'table', tableName, totalRows: total });
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary border border-border rounded-lg hover:bg-bg-tertiary transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export{selectedRows.size > 0 ? ` (${selectedRows.size})` : ''}
            </button>
          </Tooltip>
          {(selectedRows.size > 0 || selectAllInDb) && pkColumn && (
            <button
              onClick={() => setShowBulkDelete(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-error hover:bg-red-600 text-white rounded-lg transition-colors shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {selectAllInDb ? `Delete all ${total.toLocaleString()} rows` : `Delete (${selectedRows.size})`}
            </button>
          )}
          <button
            onClick={() => setShowInsert(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent hover:bg-accent-hover text-text-inverted rounded-lg transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Row
          </button>
          {!confirmDropTable ? (
            <button
              onClick={() => setConfirmDropTable(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-error hover:bg-error-subtle border border-error/20 rounded-lg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />Drop
            </button>
          ) : (
            <>
              <button onClick={handleDropTable} className="px-2.5 py-1.5 text-xs font-medium text-error hover:bg-error-subtle border border-error/20 rounded-lg transition-colors">Confirm Drop</button>
              <button onClick={() => setConfirmDropTable(false)} className="px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary border border-border rounded-lg hover:bg-bg-tertiary transition-colors">Cancel</button>
            </>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <DataFilterBar
        filters={filters}
        onFiltersChange={handleFiltersChange}
        columns={(schemaQuery.data ?? []).map((c) => ({ name: c.name, type: c.type }))}
      />

      {/* Top pagination */}
      {!lazyLoad && <PaginationBar page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />}

      {/* Table */}
      <div ref={scrollRef} className="flex-1 overflow-auto bg-bg-primary">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-text-tertiary" />
          </div>
        ) : allRows.length === 0 ? (
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
                <Database className="w-10 h-10 mb-4 text-text-tertiary/50" />
                <p className="text-sm font-medium text-text-secondary mb-1">No data yet</p>
                <p className="text-xs mb-4">This table is empty. Add some rows to get started.</p>
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
          <table className="text-sm" style={{ tableLayout: 'fixed', width: dataColTotal + 100 }}>
            <thead className="sticky top-0 bg-bg-secondary z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-border">
                  <th className="px-2 py-2.5 text-left" style={{ width: 100 }}>
                    <div ref={selectAllRef} className="flex items-center">
                      {pkColumn && <Checkbox checked={allSelected || selectAllInDb} indeterminate={!allSelected && someSelected && !selectAllInDb} onChange={toggleAll} />}
                    </div>
                    <SelectAllPopover
                      totalCount={total}
                      pageCount={allRows.length}
                      visible={showSelectAllPopover && allSelected && !selectAllInDb}
                      anchorRef={selectAllRef}
                      onSelectAll={handleSelectAllInDb}
                      onClose={() => setShowSelectAllPopover(false)}
                      itemLabel="row"
                    />
                  </th>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className="relative px-3 py-2.5 text-left text-xs font-medium text-text-secondary uppercase tracking-wide cursor-pointer hover:text-text-primary select-none transition-colors"
                      style={{ width: colWidths[header.id] }}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono truncate">{flexRender(header.column.columnDef.header, header.getContext())}</span>
                        {header.column.getIsSorted() === 'asc' && <ChevronUp className="w-3 h-3 text-accent shrink-0" />}
                        {header.column.getIsSorted() === 'desc' && <ChevronDown className="w-3 h-3 text-accent shrink-0" />}
                        {!header.column.getIsSorted() && <ArrowUpDown className="w-2.5 h-2.5 text-text-tertiary shrink-0" />}
                      </div>
                      <div className="col-resize-handle" onMouseDown={(e) => { e.stopPropagation(); startResize(header.id, e.clientX); }} />
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => {
                const pkVal = pkColumn ? String(row.original[pkColumn] ?? '') : '';
                const isDeleting = deletingPk === pkVal;
                const isChecked = selectedRows.has(pkVal);

                return (
                  <tr
                    key={row.id}
                    onClick={() => pkColumn && toggleRow(pkVal)}
                    className={`border-b border-border-subtle group transition-colors cursor-pointer ${
                      isDeleting
                        ? 'bg-error-subtle'
                        : isChecked
                          ? 'bg-accent-subtle'
                          : 'even:bg-row-alt hover:bg-row-hover'
                    }`}
                  >
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1">
                        {pkColumn && <Checkbox checked={isChecked} onChange={() => toggleRow(pkVal)} />}
                        {isDeleting ? (
                          <div className="flex gap-1.5 ml-1">
                            <button
                              onClick={() => handleDelete(pkVal)}
                              className="text-error text-xs font-medium hover:underline"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setDeletingPk(null)}
                              className="text-text-secondary text-xs hover:underline"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <RowCopyMenu columns={dataColumnKeys} row={row.original} tableName={tableName} />
                            <button
                              onClick={() => setEditRow(row.original)}
                              className="p-1 rounded text-text-tertiary hover:text-accent hover:bg-accent-subtle transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {pkColumn && (
                              <button
                                onClick={() => setDeletingPk(pkVal)}
                                className="p-1 rounded text-text-tertiary hover:text-error hover:bg-error-subtle transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    {row.getVisibleCells().map((cell) => {
                      const val = cell.getValue();
                      const colId = cell.column.id;
                      const colDef = schemaMap.get(colId);
                      const displayStr = val === null ? '' : String(val);
                      const isArrayVal = typeof val === 'string' && val === '[ARRAY]';
                      return (
                        <td key={cell.id} className="px-3 py-2 text-text-primary font-mono text-[13px] overflow-hidden" style={{ width: colWidths[colId] }}>
                          <CopyCell value={displayStr}>
                            {pkColumn && colDef ? (
                              <InlineEditCell
                                value={val}
                                columnName={colId}
                                columnType={colDef.type}
                                nullable={colDef.nullable}
                                hasDefault={!!colDef.defaultValue}
                                maxLength={colDef.length}
                                isPrimaryKey={colDef.primaryKey}
                                isArray={isArrayVal}
                                onSave={(newVal) => handleInlineSave(pkVal, colId, newVal)}
                              >
                                <TruncateCell value={displayStr}>
                                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </TruncateCell>
                              </InlineEditCell>
                            ) : (
                              <TruncateCell value={displayStr}>
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </TruncateCell>
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
        )}

        {/* Lazy load sentinel — must be inside the scroll container */}
        {lazyLoad && (
          <div ref={sentinelRef} className="py-3 flex items-center justify-center">
            {infiniteQuery.isFetchingNextPage ? (
              <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Loading more...</span>
              </div>
            ) : infiniteQuery.hasNextPage ? (
              <div className="h-4" />
            ) : total > 0 ? (
              <span className="text-[11px] text-text-tertiary">All {total.toLocaleString()} rows loaded</span>
            ) : null}
          </div>
        )}
      </div>

      {/* Footer pagination */}
      {lazyLoad ? (
        <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-bg-secondary text-xs text-text-secondary">
          <span className="font-mono tabular-nums">
            {allRows.length.toLocaleString()} of {total.toLocaleString()} rows
          </span>
          <span className="text-text-tertiary">Infinite scroll</span>
        </div>
      ) : (
        <PaginationBar page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
      )}

      {(showInsert || editRow) && schemaQuery.data && (
        <RowEditor
          tableName={tableName}
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
      {exportScope && (
        <ExportModal scope={exportScope} onClose={() => setExportScope(null)} />
      )}
    </div>
  );
}
