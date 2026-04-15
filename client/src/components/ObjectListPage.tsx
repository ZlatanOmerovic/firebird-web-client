import { useState, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSidebarData, dropTable, dropView, dropProcedure, dropTrigger, dropGenerator, dropDomain } from '../lib/api';
import { useConnectionStore } from '../store/connectionStore';
import type { DbObjectSelection } from './Sidebar';
import { NewTableModal, NewViewModal, NewProcedureModal, NewTriggerModal, NewGeneratorModal, NewDomainModal } from './NewObjectView';
import { Tooltip } from './Tooltip';
import { Table2, Eye, Play, Zap, Hash, Box, Search, Plus, ArrowRight, RefreshCw, ChevronUp, ChevronDown, ArrowUpDown, Trash2 } from 'lucide-react';
import { Checkbox } from './Checkbox';
import { BulkDeleteModal } from './BulkDeleteModal';
import { actionToast, toast } from './Toast';
import { SelectAllPopover } from './SelectAllPopover';
import { TruncateCell } from './TruncateCell';
import { useColumnResize } from '../hooks/useColumnResize';

export type ObjectKind = 'tables-list' | 'views-list' | 'procedures-list' | 'triggers-list' | 'generators' | 'domains';

const CONFIG: Record<ObjectKind, {
  title: string;
  icon: React.ElementType;
  itemKind: string;
  newKind?: string;
  columns: { key: string; label: string; sortable: boolean }[];
}> = {
  'tables-list': {
    title: 'Tables', icon: Table2, itemKind: 'table', newKind: 'new-table',
    columns: [{ key: 'name', label: 'Name', sortable: true }, { key: 'rows', label: 'Rows', sortable: true }],
  },
  'views-list': {
    title: 'Views', icon: Eye, itemKind: 'view', newKind: 'new-view',
    columns: [{ key: 'name', label: 'Name', sortable: true }],
  },
  'procedures-list': {
    title: 'Procedures', icon: Play, itemKind: 'procedure', newKind: 'new-procedure',
    columns: [{ key: 'name', label: 'Name', sortable: true }],
  },
  'triggers-list': {
    title: 'Triggers', icon: Zap, itemKind: 'trigger', newKind: 'new-trigger',
    columns: [{ key: 'name', label: 'Name', sortable: true }, { key: 'table', label: 'Table', sortable: true }, { key: 'typeLabel', label: 'Type', sortable: true }, { key: 'status', label: 'Status', sortable: true }],
  },
  'generators': {
    title: 'Generators', icon: Hash, itemKind: 'generators', newKind: 'new-generator',
    columns: [{ key: 'name', label: 'Name', sortable: true }, { key: 'value', label: 'Current Value', sortable: true }],
  },
  'domains': {
    title: 'Domains', icon: Box, itemKind: 'domains', newKind: 'new-domain',
    columns: [{ key: 'name', label: 'Name', sortable: true }, { key: 'type', label: 'Type', sortable: true }, { key: 'length', label: 'Length', sortable: true }, { key: 'nullable', label: 'Nullable', sortable: true }, { key: 'defaultValue', label: 'Default', sortable: false }, { key: 'check', label: 'Check', sortable: false }],
  },
};

type Row = Record<string, unknown> & { name: string };

interface ObjectListPageProps {
  kind: ObjectKind;
  onNavigate: (sel: DbObjectSelection) => void;
}

export function ObjectListPage({ kind, onNavigate }: ObjectListPageProps) {
  const sidebar = useQuery({ queryKey: ['sidebar'], queryFn: getSidebarData, staleTime: 30000, enabled: !!useConnectionStore.getState().currentDatabase });
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [selectAllInDb, setSelectAllInDb] = useState(false);
  const [showSelectAllPopover, setShowSelectAllPopover] = useState(false);
  const listSelectAllRef = useRef<HTMLDivElement>(null);
  const config = CONFIG[kind];
  const Icon = config.icon;
  const data = sidebar.data;
  const listColKeys = useMemo(() => config.columns.map((c) => c.key), [config.columns]);
  const { widths: listColWidths, startResize: listStartResize, totalWidth: listColTotal } = useColumnResize(listColKeys, 150, `list-${kind}`);

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const triggerTypeLabel = (type: number): string => {
    const phase = type % 2 === 1 ? 'BEFORE' : 'AFTER';
    const event = Math.ceil(type / 2);
    const events = ['INSERT', 'UPDATE', 'DELETE'];
    return `${phase} ${events[event - 1] ?? `TYPE ${type}`}`;
  };

  const allRows: Row[] = useMemo(() => {
    if (!data) return [];
    switch (kind) {
      case 'tables-list':
        return (data.tables as string[]).map((name) => ({ name, rows: data.counts[name] ?? 0 }));
      case 'views-list':
        return (data.views as string[]).map((name) => ({ name }));
      case 'procedures-list':
        return (data.procedures as string[]).map((name) => ({ name }));
      case 'triggers-list':
        return data.triggers.map((t) => ({ name: t.name, table: t.table ?? '—', typeLabel: triggerTypeLabel(t.type), status: t.inactive ? 'INACTIVE' : 'ACTIVE', inactive: t.inactive }));
      case 'generators':
        return data.generators.map((g) => ({ name: g.name, value: g.value ?? 0 }));
      case 'domains':
        return data.domains.map((d) => ({ name: d.name, type: d.type, length: d.length ?? null, nullable: d.nullable, defaultValue: d.defaultValue, check: d.check }));
      default:
        return [];
    }
  }, [data, kind]);

  const filtered = useMemo(() => {
    let result = allRows;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((r) => Object.values(r).some((v) => v !== null && String(v).toLowerCase().includes(q)));
    }
    if (sortCol) {
      result = [...result].sort((a, b) => {
        let av = a[sortCol] as unknown, bv = b[sortCol] as unknown;
        if (av == null) av = '';
        if (bv == null) bv = '';
        const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return result;
  }, [allRows, search, sortCol, sortDir]);

  const handleRowClick = (row: Row) => {
    if (kind === 'generators' || kind === 'domains') return;
    onNavigate({ kind: config.itemKind, name: row.name } as DbObjectSelection);
  };

  const toggleRow = (name: string) => {
    setSelectAllInDb(false);
    setSelectedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const allFilteredNames = filtered.map((r) => r.name);
  const allObjectNames = allRows.map((r) => r.name);
  const allSelected = allFilteredNames.length > 0 && allFilteredNames.every((n) => selectedNames.has(n));
  const someSelected = allFilteredNames.some((n) => selectedNames.has(n));

  const toggleAll = () => {
    if (allSelected || selectAllInDb) {
      setSelectedNames(new Set());
      setSelectAllInDb(false);
      setShowSelectAllPopover(false);
    } else {
      setSelectedNames(new Set(allFilteredNames));
      // Only show popover if there are more objects than what's currently filtered/visible
      if (allRows.length > filtered.length) setShowSelectAllPopover(true);
    }
  };

  const handleSelectAllInDb = () => {
    setSelectAllInDb(true);
    setSelectedNames(new Set(allObjectNames));
    setShowSelectAllPopover(false);
  };

  const dropFn: Record<string, (name: string) => Promise<unknown>> = {
    'tables-list': dropTable,
    'views-list': dropView,
    'procedures-list': dropProcedure,
    'triggers-list': dropTrigger,
    'generators': dropGenerator,
    'domains': dropDomain,
  };

  const handleBulkDelete = async () => {
    const fn = dropFn[kind];
    const names = selectAllInDb ? allObjectNames : Array.from(selectedNames);
    const start = performance.now();
    try {
      for (const n of names) {
        await fn(n);
      }
      const elapsed = Math.round(performance.now() - start);
      actionToast(`${names.length} ${config.title.toLowerCase()} dropped`, undefined, elapsed);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    }
    setSelectedNames(new Set());
    setSelectAllInDb(false);
    queryClient.invalidateQueries({ queryKey: ['sidebar'] });
  };

  // Summary stats
  const summaryParts: string[] = [];
  summaryParts.push(`${filtered.length} of ${allRows.length} ${config.title.toLowerCase()}`);

  if (kind === 'tables-list') {
    const total = allRows.reduce((s, r) => s + ((r.rows as number) ?? 0), 0);
    const filteredTotal = filtered.reduce((s, r) => s + ((r.rows as number) ?? 0), 0);
    summaryParts.push(search && filteredTotal !== total ? `${filteredTotal.toLocaleString()} / ${total.toLocaleString()} total rows` : `${total.toLocaleString()} total rows`);
  }
  if (kind === 'generators') {
    const total = allRows.reduce((s, r) => s + (Number(r.value) || 0), 0);
    summaryParts.push(`Sum: ${total.toLocaleString()}`);
  }
  if (kind === 'domains') {
    const nullable = allRows.filter((r) => r.nullable === true).length;
    const notNull = allRows.filter((r) => r.nullable === false).length;
    summaryParts.push(`${nullable} nullable · ${notNull} NOT NULL`);
  }
  if (kind === 'triggers-list') {
    const active = filtered.filter((r) => r.status === 'ACTIVE').length;
    const inactive = filtered.filter((r) => r.status === 'INACTIVE').length;
    summaryParts.push(`${active} active` + (inactive > 0 ? ` · ${inactive} inactive` : ''));
  }

  const SortIcon = ({ col }: { col: string }) => (
    sortCol === col
      ? sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-accent" /> : <ChevronDown className="w-3 h-3 text-accent" />
      : <ArrowUpDown className="w-2.5 h-2.5 text-text-tertiary" />
  );

  const renderCell = (row: Row, col: { key: string }) => {
    const val = row[col.key];

    // Special rendering per column
    if (col.key === 'rows' || col.key === 'value' || col.key === 'length') {
      return <span className="font-mono tabular-nums">{val != null ? Number(val).toLocaleString() : '—'}</span>;
    }
    if (col.key === 'typeLabel') {
      return <span className="px-1.5 py-0.5 rounded bg-accent-subtle text-accent text-[11px] font-mono">{String(val)}</span>;
    }
    if (col.key === 'status') {
      return val === 'INACTIVE'
        ? <span className="px-1.5 py-0.5 text-[11px] font-medium bg-error-subtle text-error rounded">INACTIVE</span>
        : <span className="px-1.5 py-0.5 text-[11px] font-medium bg-success-subtle text-success rounded">ACTIVE</span>;
    }
    if (col.key === 'type') {
      return <span className="px-1.5 py-0.5 rounded bg-accent-subtle text-accent text-xs">{String(val)}</span>;
    }
    if (col.key === 'nullable') {
      return val ? <span className="text-text-tertiary text-xs">YES</span> : <span className="text-xs px-1 py-0.5 rounded bg-error-subtle text-error">NOT NULL</span>;
    }
    if (val === null || val === undefined) return <span className="text-text-tertiary">—</span>;
    return <span className="font-mono">{String(val)}</span>;
  };

  const isClickable = kind !== 'generators' && kind !== 'domains';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-bg-primary">
        <div className="flex items-center gap-2.5">
          <Icon className="w-4 h-4 text-text-tertiary" />
          <h1 className="text-sm font-semibold text-text-primary">{config.title}</h1>
          <span className="text-xs text-text-tertiary tabular-nums">({allRows.length})</span>
        </div>
        <div className="flex items-center gap-2">
          {allRows.length > 0 && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-tertiary" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Filter ${config.title.toLowerCase()}...`}
                className="pl-7 pr-3 py-1.5 bg-bg-secondary border border-border rounded-lg text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none w-52"
              />
            </div>
          )}
          {(selectedNames.size > 0 || selectAllInDb) && (
            <button
              onClick={() => setShowBulkDelete(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-error hover:bg-red-600 text-white rounded-lg transition-colors shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {selectAllInDb ? `Drop all ${allRows.length} ${config.title.toLowerCase()}` : `Drop (${selectedNames.size})`}
            </button>
          )}
          <Tooltip content="Refresh" placement="bottom">
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: ['sidebar'] })}
              className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary rounded-lg transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
          {config.newKind && (
            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent hover:bg-accent-hover text-[#ffffff] rounded-lg transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />New
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto bg-bg-primary">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
            <Icon className="w-8 h-8 mb-3 opacity-50" />
            <p className="text-sm font-medium text-text-secondary">{search ? 'No matches' : `No ${config.title.toLowerCase()}`}</p>
          </div>
        ) : (
          <table className="text-sm" style={{ tableLayout: 'fixed', width: listColTotal + 80 + (isClickable ? 40 : 0) }}>
            <thead className="sticky top-0 bg-bg-secondary z-10">
              <tr className="border-b border-border">
                <th className="px-3 py-2.5 text-left" style={{ width: 40 }}>
                  <div ref={listSelectAllRef} className="flex items-center">
                    <Checkbox checked={allSelected || selectAllInDb} indeterminate={!allSelected && someSelected && !selectAllInDb} onChange={toggleAll} />
                  </div>
                  <SelectAllPopover
                    totalCount={allRows.length}
                    pageCount={filtered.length}
                    visible={showSelectAllPopover && allSelected && !selectAllInDb}
                    anchorRef={listSelectAllRef}
                    onSelectAll={handleSelectAllInDb}
                    onClose={() => setShowSelectAllPopover(false)}
                    itemLabel={config.itemKind}
                  />
                </th>
                <th className="px-2 py-2.5 text-left text-xs font-medium text-text-secondary uppercase tracking-wide" style={{ width: 40 }}>#</th>
                {config.columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                    className={`relative px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase tracking-wide ${col.sortable ? 'cursor-pointer hover:text-text-primary select-none' : ''} transition-colors`}
                    style={{ width: listColWidths[col.key] }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="truncate">{col.label}</span>
                      {col.sortable && <SortIcon col={col.key} />}
                    </div>
                    <div className="col-resize-handle" onMouseDown={(e) => { e.stopPropagation(); listStartResize(col.key, e.clientX); }} />
                  </th>
                ))}
                {isClickable && <th className="px-4 py-2.5" style={{ width: 40 }}></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const isChecked = selectedNames.has(row.name);
                return (
                <tr
                  key={row.name}
                  onClick={() => toggleRow(row.name)}
                  onDoubleClick={() => handleRowClick(row)}
                  className={`border-b border-border-subtle transition-colors cursor-pointer ${isChecked ? 'bg-accent-subtle' : 'even:bg-row-alt hover:bg-row-hover'} group`}
                >
                  <td className="px-3 py-2.5" style={{ width: 40 }}>
                    <Checkbox checked={isChecked} onChange={() => toggleRow(row.name)} />
                  </td>
                  <td className="px-2 py-2.5 text-text-tertiary text-xs tabular-nums" style={{ width: 40 }}>{i + 1}</td>
                  {config.columns.map((col) => {
                    const val = row[col.key];
                    const displayStr = val === null || val === undefined ? '' : String(val);
                    return (
                      <td key={col.key} className="px-4 py-2.5 text-text-primary text-[13px] overflow-hidden" style={{ width: listColWidths[col.key] }}>
                        <TruncateCell value={displayStr}>
                          {renderCell(row, col)}
                        </TruncateCell>
                      </td>
                    );
                  })}
                  {isClickable && (
                    <td className="px-4 py-2.5" style={{ width: 40 }}>
                      <ArrowRight className="w-3 h-3 text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
                    </td>
                  )}
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-2 border-t border-border bg-bg-secondary text-[11px] text-text-secondary">
        <div className="flex items-center gap-4">
          {summaryParts.map((p, i) => (
            <span key={i} className={i > 0 ? 'font-mono tabular-nums' : ''}>{p}</span>
          ))}
        </div>
        <span className="text-text-tertiary">{config.title}</span>
      </div>

      {/* New object modals */}
      {showNewModal && kind === 'tables-list' && <NewTableModal onClose={() => setShowNewModal(false)} />}
      {showNewModal && kind === 'views-list' && <NewViewModal onClose={() => setShowNewModal(false)} />}
      {showNewModal && kind === 'procedures-list' && <NewProcedureModal onClose={() => setShowNewModal(false)} />}
      {showNewModal && kind === 'triggers-list' && <NewTriggerModal onClose={() => setShowNewModal(false)} />}
      {showNewModal && kind === 'generators' && <NewGeneratorModal onClose={() => setShowNewModal(false)} />}
      {showNewModal && kind === 'domains' && <NewDomainModal onClose={() => setShowNewModal(false)} />}
      {showBulkDelete && (
        <BulkDeleteModal
          count={selectAllInDb ? allRows.length : selectedNames.size}
          itemLabel={config.itemKind}
          onConfirm={handleBulkDelete}
          onClose={() => setShowBulkDelete(false)}
        />
      )}
    </div>
  );
}
