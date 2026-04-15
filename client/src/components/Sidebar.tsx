import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useConnectionStore } from '../store/connectionStore';
import { getSidebarData } from '../lib/api';
import { Tooltip } from './Tooltip';
import {
  Table2,
  Search,
  Loader2,
  Eye,
  Zap,
  Play,
  Hash,
  Box,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  RefreshCw,
  Terminal,
  Database,
  ChevronDown as ChevronDownIcon,
} from 'lucide-react';

export type DbObjectSelection =
  | { kind: 'table'; name: string }
  | { kind: 'view'; name: string }
  | { kind: 'procedure'; name: string }
  | { kind: 'trigger'; name: string }
  | { kind: 'generators' }
  | { kind: 'domains' }
  | { kind: 'sql' }
  | { kind: 'new-table' }
  | { kind: 'new-view' }
  | { kind: 'new-procedure' }
  | { kind: 'new-trigger' }
  | { kind: 'settings' }
  | { kind: 'history' }
  | { kind: 'new-generator' }
  | { kind: 'new-domain' }
  | { kind: 'tables-list' }
  | { kind: 'views-list' }
  | { kind: 'procedures-list' }
  | { kind: 'triggers-list' };

interface SidebarProps {
  selection: DbObjectSelection | null;
  onSelect: (sel: DbObjectSelection) => void;
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="bg-yellow-400/30 text-yellow-300 dark:text-yellow-300 rounded px-0.5">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

function SidebarSection({
  label,
  icon: Icon,
  items,
  isLoading,
  kind,
  selection,
  onSelect,
  search,
  onAdd,
  onRefresh,
  itemCounts,
  sectionBg,
}: {
  label: string;
  icon: React.ElementType;
  items: string[] | undefined;
  isLoading: boolean;
  kind: 'table' | 'view' | 'procedure' | 'trigger';
  selection: DbObjectSelection | null;
  onSelect: (sel: DbObjectSelection) => void;
  search: string;
  onAdd?: () => void;
  onRefresh?: () => void;
  itemCounts?: Record<string, number>;
  sectionBg?: string;
}) {
  const [open, setOpen] = useState(kind === 'table');
  const filtered = items?.filter((t) => t.toLowerCase().includes(search.toLowerCase()));
  const count = items?.length ?? 0;
  const isSearching = search.length > 0;
  const isOpen = isSearching || open;

  return (
    <div className={`mb-0.5 ${sectionBg ?? ''}`}>
      <div className="flex items-center">
        <button
          onClick={() => setOpen(!open)}
          className="flex-1 flex items-center gap-2 px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/50 transition-colors uppercase tracking-wide"
        >
          {isOpen ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
          <Icon className="w-3.5 h-3.5 shrink-0" />
          <span>{label}</span>
          <span className="ml-auto text-text-tertiary text-[10px] tabular-nums">{count}</span>
        </button>
        {onRefresh && (
          <Tooltip content={`Refresh ${label.toLowerCase()}`} placement="right">
            <button
              onClick={(e) => { e.stopPropagation(); onRefresh(); }}
              className="px-1.5 py-1.5 text-text-tertiary hover:text-text-primary transition-colors"
            >
              <RefreshCw className="w-2.5 h-2.5" />
            </button>
          </Tooltip>
        )}
        {onAdd && (
          <Tooltip content={`New ${label.slice(0, -1)}`} placement="right">
            <button
              onClick={(e) => { e.stopPropagation(); onAdd(); }}
              className="px-1.5 py-1.5 text-text-tertiary hover:text-accent transition-colors"
            >
              <Plus className="w-3 h-3" />
            </button>
          </Tooltip>
        )}
      </div>

      {isOpen && (
        <div className="pb-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-text-tertiary" />
            </div>
          ) : filtered && filtered.length === 0 ? (
            <p className="px-9 py-3 text-[11px] text-text-tertiary italic">No results</p>
          ) : (
            filtered?.map((name) => {
              const isActive =
                selection !== null &&
                'name' in selection &&
                selection.kind === kind &&
                selection.name === name;
              return (
                <button
                  key={name}
                  onClick={() => onSelect({ kind, name } as DbObjectSelection)}
                  className={`w-full flex items-center gap-2 pl-9 pr-3 py-1.5 text-[13px] font-mono text-left transition-colors rounded-r-md ${
                    isActive
                      ? 'text-accent bg-accent-subtle border-l-2 border-accent font-medium'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/50 border-l-2 border-transparent'
                  }`}
                >
                  <Tooltip content={<span className="font-mono">{name}</span>} placement="right" delay={500} className="truncate">
                    <span className="truncate">{isSearching ? highlightMatch(name, search) : name}</span>
                  </Tooltip>
                  {itemCounts && itemCounts[name] !== undefined && (
                    <span className="ml-auto text-[10px] text-text-tertiary tabular-nums shrink-0">{itemCounts[name].toLocaleString()}</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function DatabaseDropdown({
  databases,
  currentDatabase,
  switching,
  onSelect,
  onRefresh,
}: {
  databases: { name: string; path: string; source: string }[];
  currentDatabase: string | null;
  switching: boolean;
  onSelect: (path: string) => void;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [dbSearch, setDbSearch] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const currentDb = databases.find((d) => d.path === currentDatabase || d.name === currentDatabase);
  const rawName = currentDb?.name ?? currentDatabase ?? '';
  const displayName = rawName.includes('/') ? rawName.split('/').pop() ?? rawName : rawName;

  const filtered = dbSearch
    ? databases.filter((d) => d.name.toLowerCase().includes(dbSearch.toLowerCase()) || d.path.toLowerCase().includes(dbSearch.toLowerCase()))
    : databases;

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => { setHighlighted(0); }, [dbSearch]);

  // Scroll highlighted into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[highlighted] as HTMLElement | undefined;
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [highlighted, open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter' && filtered[highlighted]) {
      e.preventDefault();
      const db = filtered[highlighted];
      onSelect(db.source === 'alias' ? db.name : db.path);
      setOpen(false);
      setDbSearch('');
    } else if (e.key === 'Escape') {
      setOpen(false);
      setDbSearch('');
    }
  };

  const loading = databases.length === 0;

  return (
    <div className="relative mb-1">
      {/* Trigger button */}
      <button
        onClick={() => { if (!switching) setOpen(!open); }}
        disabled={switching}
        className={`w-full flex items-center gap-2 px-3 py-2 bg-bg-primary border-b text-left transition-colors ${
          open ? 'border-accent' : 'border-border hover:bg-bg-secondary'
        } ${switching ? 'opacity-50' : ''}`}
      >
        <Database className="w-3 h-3 text-text-tertiary shrink-0" />
        {loading ? (
          <span className="flex-1 text-[11px] text-text-tertiary italic">Resolving databases...</span>
        ) : switching ? (
          <span className="flex-1 text-[11px] text-accent flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" />Switching...
          </span>
        ) : displayName ? (
          <Tooltip content={currentDb?.path ?? displayName} placement="bottom" delay={500}>
            <span className="flex-1 text-[11px] font-mono text-text-primary truncate">{displayName}</span>
          </Tooltip>
        ) : (
          <span className="flex-1 text-[11px] text-text-tertiary">Select database...</span>
        )}
        <RefreshCw
          className="w-3 h-3 text-text-tertiary shrink-0 hover:text-accent transition-colors"
          onClick={(e) => { e.stopPropagation(); onRefresh(); }}
        />
        <ChevronDownIcon className={`w-3 h-3 text-text-tertiary shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => { setOpen(false); setDbSearch(''); }} />
          <div className="absolute left-0 right-0 top-full z-40 bg-bg-secondary border-b border-x border-border rounded-b-lg shadow-xl overflow-hidden">
            {/* Search */}
            <div className="p-1.5">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-tertiary" />
                <input
                  ref={inputRef}
                  type="text"
                  value={dbSearch}
                  onChange={(e) => setDbSearch(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search databases..."
                  className="w-full pl-6 pr-2 py-1.5 bg-bg-primary border border-border rounded-md text-[11px] text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
                />
              </div>
            </div>

            {/* List */}
            <div ref={listRef} className="max-h-48 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-center text-[11px] text-text-tertiary">No databases found</div>
              ) : (
                filtered.map((db, i) => {
                  const isActive = db.path === currentDatabase || db.name === currentDatabase;
                  const isHighlighted = i === highlighted;
                  return (
                    <button
                      key={db.path + db.name}
                      onClick={() => {
                        onSelect(db.source === 'alias' ? db.name : db.path);
                        setOpen(false);
                        setDbSearch('');
                      }}
                      onMouseEnter={() => setHighlighted(i)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                        isHighlighted ? 'bg-bg-tertiary' : ''
                      } ${isActive ? 'text-accent' : 'text-text-primary'}`}
                    >
                      <Database className={`w-3 h-3 shrink-0 ${isActive ? 'text-accent' : 'text-text-tertiary'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-medium font-mono truncate">{db.name}</div>
                        {db.source === 'file' && (
                          <div className="text-[9px] text-text-tertiary font-mono truncate">{db.path}</div>
                        )}
                      </div>
                      {db.source === 'alias' && (
                        <span className="text-[8px] font-medium text-accent/60 uppercase tracking-wide shrink-0">alias</span>
                      )}
                      {isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function Sidebar({ selection, onSelect }: SidebarProps) {
  const connected = useConnectionStore((s) => s.connected);
  const databases = useConnectionStore((s) => s.databases);
  const currentDatabase = useConnectionStore((s) => s.currentDatabase);
  const switchDatabase = useConnectionStore((s) => s.switchDatabase);
  const [search, setSearch] = useState('');
  const [dbSwitching, setDbSwitching] = useState(false);
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('firebird-sidebar-collapsed') === '1');

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('firebird-sidebar-collapsed', next ? '1' : '0');
    window.dispatchEvent(new CustomEvent('sidebar-toggle', { detail: next }));
  };

  const sidebar = useQuery({ queryKey: ['sidebar'], queryFn: getSidebarData, enabled: connected && !!currentDatabase, staleTime: 30000 });

  const handleSwitchDb = async (dbPath: string) => {
    setDbSwitching(true);
    try {
      await switchDatabase(dbPath);
      queryClient.invalidateQueries();
    } catch { /* toast error */ }
    finally { setDbSwitching(false); }
  };
  const data = sidebar.data;

  const triggerNames = data?.triggers.map((t) => t.name);

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['sidebar'] });
  };

  const sectionColors: Record<string, { bg: string; activeBg: string; dot: string }> = {
    table: { bg: 'bg-blue-500/[0.06]', activeBg: 'bg-blue-500/15', dot: 'bg-blue-500' },
    view: { bg: 'bg-purple-500/[0.06]', activeBg: 'bg-purple-500/15', dot: 'bg-purple-500' },
    procedure: { bg: 'bg-emerald-500/[0.06]', activeBg: 'bg-emerald-500/15', dot: 'bg-emerald-500' },
    trigger: { bg: 'bg-amber-500/[0.06]', activeBg: 'bg-amber-500/15', dot: 'bg-amber-500' },
    generators: { bg: 'bg-cyan-500/[0.06]', activeBg: 'bg-cyan-500/15', dot: 'bg-cyan-500' },
    domains: { bg: 'bg-rose-500/[0.06]', activeBg: 'bg-rose-500/15', dot: 'bg-rose-500' },
  };

  const collapsedIconClass = (active: boolean, colorKey?: string) => {
    const colors = colorKey ? sectionColors[colorKey] : null;
    if (active) return `w-full flex items-center justify-center py-2.5 transition-colors text-accent ${colors?.activeBg ?? 'bg-accent-subtle'}`;
    return `w-full flex items-center justify-center py-2.5 transition-colors text-text-tertiary hover:text-text-primary ${colors?.bg ?? ''} hover:bg-bg-tertiary/50`;
  };

  const isTableKind = selection?.kind === 'table' || selection?.kind === 'tables-list' || selection?.kind === 'new-table';
  const isViewKind = selection?.kind === 'view' || selection?.kind === 'views-list' || selection?.kind === 'new-view';
  const isProcKind = selection?.kind === 'procedure' || selection?.kind === 'procedures-list' || selection?.kind === 'new-procedure';
  const isTriggerKind = selection?.kind === 'trigger' || selection?.kind === 'triggers-list' || selection?.kind === 'new-trigger';

  if (collapsed) {
    return (
      <aside className="w-10 h-full bg-bg-secondary border-r border-border flex flex-col shrink-0">
        {/* Expand button — same height as top bar */}
        <Tooltip content="Expand sidebar" placement="right" delay={0}>
          <button
            onClick={toggleCollapsed}
            className="w-full h-[45px] flex items-center justify-center border-b border-border bg-bg-tertiary text-text-tertiary hover:text-text-primary hover:bg-bg-secondary transition-colors"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        </Tooltip>

        {/* Database indicator */}
        <Tooltip content={currentDatabase ? `Database: ${currentDatabase}` : 'No database selected'} placement="right" delay={0}>
          <button
            onClick={toggleCollapsed}
            className={`w-full flex items-center justify-center py-2 transition-colors ${currentDatabase ? 'text-accent' : 'text-text-tertiary'}`}
          >
            <Database className="w-3.5 h-3.5" />
          </button>
        </Tooltip>

        {/* SQL Editor */}
        <Tooltip content="SQL Editor" placement="right" delay={0}>
          <button
            onClick={() => onSelect({ kind: 'sql' })}
            className={`w-full flex items-center justify-center py-2.5 mb-0.5 transition-colors text-[#ffffff] font-bold ${
              selection?.kind === 'sql'
                ? 'bg-accent-hover'
                : 'bg-accent hover:bg-accent-hover'
            }`}
          >
            <Terminal className="w-4 h-4" />
          </button>
        </Tooltip>

        <div className="border-t border-border" />

        {/* Object icons — link to list pages */}
        <div className="flex-1 flex flex-col overflow-y-auto gap-0.5">
          <Tooltip content={`Tables (${data?.tables.length ?? 0})`} placement="right" delay={0}>
            <button onClick={() => onSelect({ kind: 'tables-list' } as DbObjectSelection)} className={collapsedIconClass(isTableKind, 'table')}>
              <Table2 className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
          <Tooltip content={`Views (${data?.views.length ?? 0})`} placement="right" delay={0}>
            <button onClick={() => onSelect({ kind: 'views-list' } as DbObjectSelection)} className={collapsedIconClass(isViewKind, 'view')}>
              <Eye className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
          <Tooltip content={`Procedures (${data?.procedures.length ?? 0})`} placement="right" delay={0}>
            <button onClick={() => onSelect({ kind: 'procedures-list' } as DbObjectSelection)} className={collapsedIconClass(isProcKind, 'procedure')}>
              <Play className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
          <Tooltip content={`Triggers (${data?.triggers.length ?? 0})`} placement="right" delay={0}>
            <button onClick={() => onSelect({ kind: 'triggers-list' } as DbObjectSelection)} className={collapsedIconClass(isTriggerKind, 'trigger')}>
              <Zap className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
          <Tooltip content={`Generators (${data?.generators.length ?? 0})`} placement="right" delay={0}>
            <button onClick={() => onSelect({ kind: 'generators' })} className={collapsedIconClass(selection?.kind === 'generators', 'generators')}>
              <Hash className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
          <Tooltip content={`Domains (${data?.domains.length ?? 0})`} placement="right" delay={0}>
            <button onClick={() => onSelect({ kind: 'domains' })} className={collapsedIconClass(selection?.kind === 'domains', 'domains')}>
              <Box className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        </div>

        {/* Refresh */}
        <Tooltip content="Refresh all" placement="right" delay={0}>
          <button
            onClick={refreshAll}
            className="w-full flex items-center justify-center py-2.5 border-t border-border text-accent hover:text-accent-hover bg-accent/10 hover:bg-accent/20 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </Tooltip>
      </aside>
    );
  }

  return (
    <aside className="w-60 h-full bg-bg-secondary border-r border-border flex flex-col">
      {/* Brand + Global Refresh */}
      <div className="flex items-center h-[45px] border-b border-border bg-bg-tertiary relative">
        <Tooltip content="Collapse sidebar" placement="bottom" className="shrink-0 h-full">
          <button
            onClick={toggleCollapsed}
            className="h-full aspect-square flex items-center justify-center text-text-tertiary hover:text-text-primary bg-bg-secondary/50 hover:bg-bg-secondary border-r border-border transition-colors !cursor-pointer"
          >
            <PanelLeftClose className="w-3.5 h-3.5" />
          </button>
        </Tooltip>
        <a href="/" className="flex-1 h-full flex items-center gap-2 px-3 text-text-primary hover:bg-bg-secondary transition-colors">
          <svg className="w-4 h-4 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
            <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
          </svg>
          <span className="text-[13px] font-semibold">Firebird <span className="text-accent">Web Client</span></span>
          <span className="absolute bottom-0.5 right-1.5 text-[8px] text-text-tertiary">v0.0.1-beta</span>
        </a>
      </div>

      {/* Database selector */}
      <DatabaseDropdown
        databases={databases}
        currentDatabase={currentDatabase}
        switching={dbSwitching}
        onSelect={handleSwitchDb}
        onRefresh={async () => {
          try {
            const { getDatabases } = await import('../lib/api');
            const result = await getDatabases();
            useConnectionStore.getState().setDatabases(result.databases);
          } catch { /* ignore */ }
        }}
      />

      {/* SQL Editor */}
      <button
        onClick={() => onSelect({ kind: 'sql' })}
        className={`flex items-center gap-2.5 px-4 py-3 text-sm font-bold border-b border-border transition-colors w-full text-[#ffffff] ${
          selection?.kind === 'sql'
            ? 'bg-accent-hover'
            : 'bg-accent hover:bg-accent-hover'
        }`}
      >
        <Terminal className="w-4 h-4" />
        SQL Editor
      </button>

      {!currentDatabase ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <Database className="w-10 h-10 text-text-tertiary/30 mb-4" />
          <p className="text-sm font-medium text-text-secondary mb-1">No database selected</p>
          <p className="text-[11px] text-text-tertiary leading-relaxed">
            {databases.length > 0
              ? 'Choose a database from the dropdown above to browse its objects.'
              : 'Connect with a database path to get started.'}
          </p>
        </div>
      ) : (
      <>
      {/* Search */}
      <div className="px-3 py-2.5 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary" />
          <input
            type="text"
            placeholder="Filter objects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-bg-primary border border-border rounded-lg text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Object tree */}
      <div className="flex-1 overflow-y-auto py-1">
        <SidebarSection
          label="Tables"
          icon={Table2}
          items={data?.tables}
          isLoading={sidebar.isLoading}
          kind="table"
          selection={selection}
          onSelect={onSelect}
          search={search}
          onAdd={() => onSelect({ kind: 'new-table' })}
          onRefresh={refreshAll}
          itemCounts={data?.counts}
          sectionBg={sectionColors.table.bg}
        />

        <SidebarSection
          label="Views"
          icon={Eye}
          items={data?.views}
          isLoading={sidebar.isLoading}
          kind="view"
          selection={selection}
          onSelect={onSelect}
          search={search}
          onAdd={() => onSelect({ kind: 'new-view' })}
          onRefresh={refreshAll}
          sectionBg={sectionColors.view.bg}
        />

        <SidebarSection
          label="Procedures"
          icon={Play}
          items={data?.procedures}
          isLoading={sidebar.isLoading}
          kind="procedure"
          selection={selection}
          onSelect={onSelect}
          search={search}
          onAdd={() => onSelect({ kind: 'new-procedure' })}
          onRefresh={refreshAll}
          sectionBg={sectionColors.procedure.bg}
        />

        <SidebarSection
          label="Triggers"
          icon={Zap}
          items={triggerNames}
          isLoading={sidebar.isLoading}
          kind="trigger"
          selection={selection}
          onSelect={onSelect}
          search={search}
          onAdd={() => onSelect({ kind: 'new-trigger' })}
          onRefresh={refreshAll}
          sectionBg={sectionColors.trigger.bg}
        />

        {/* Generators */}
        <button
          onClick={() => onSelect({ kind: 'generators' })}
          className={`w-full flex items-center gap-2 px-3 py-2 mb-0.5 text-xs font-medium uppercase tracking-wide transition-colors ${sectionColors.generators.bg} ${
            selection?.kind === 'generators'
              ? `text-accent ${sectionColors.generators.activeBg}`
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/50'
          }`}
        >
          <span className="w-3.5" />
          <Hash className="w-3.5 h-3.5 shrink-0" />
          Generators
          <span className="ml-auto text-text-tertiary text-[10px] tabular-nums">{data?.generators.length ?? 0}</span>
        </button>

        {/* Domains */}
        <button
          onClick={() => onSelect({ kind: 'domains' })}
          className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium uppercase tracking-wide transition-colors ${sectionColors.domains.bg} ${
            selection?.kind === 'domains'
              ? `text-accent ${sectionColors.domains.activeBg}`
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/50'
          }`}
        >
          <span className="w-3.5" />
          <Box className="w-3.5 h-3.5 shrink-0" />
          Domains
          <span className="ml-auto text-text-tertiary text-[10px] tabular-nums">{data?.domains.length ?? 0}</span>
        </button>
      </div>
      {/* Legend */}
      <div className="border-t border-border px-1.5 py-1.5 flex gap-0.5">
        {Object.entries(sectionColors).map(([key, c]) => (
          <span key={key} className={`flex-1 text-center text-[7px] font-medium uppercase tracking-tight py-0.5 rounded ${c.bg} text-text-tertiary`}>
            {key === 'generators' ? 'Gen' : key === 'domains' ? 'Dom' : key === 'procedure' ? 'Proc' : key === 'trigger' ? 'Trig' : key + 's'}
          </span>
        ))}
      </div>

      {/* Refresh — bottom */}
      <Tooltip content="Refresh all data" placement="top">
        <button
          onClick={refreshAll}
          className="w-full flex items-center justify-center gap-2 py-2.5 border-t border-border text-accent hover:text-accent-hover bg-accent/10 hover:bg-accent/20 transition-colors text-xs font-medium"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh All
        </button>
      </Tooltip>
      </>
      )}
    </aside>
  );
}
