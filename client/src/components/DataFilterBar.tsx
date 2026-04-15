import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Plus, X, Filter, Trash2 } from 'lucide-react';
import { Tooltip } from './Tooltip';
import type { FilterState, ColumnFilter, FilterOperator } from '../lib/filters';
import { OPERATOR_LABELS, getOperatorsForType, isNoValueOperator, EMPTY_FILTER_STATE, hasActiveFilters } from '../lib/filters';

interface DataFilterBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  columns: { name: string; type: string }[];
}

function FilterChip({
  filter,
  columns,
  onChange,
  onRemove,
}: {
  filter: ColumnFilter;
  columns: { name: string; type: string }[];
  onChange: (f: ColumnFilter) => void;
  onRemove: () => void;
}) {
  const col = columns.find((c) => c.name === filter.column);
  const operators = col ? getOperatorsForType(col.type) : getOperatorsForType('VARCHAR');
  const noValue = isNoValueOperator(filter.operator);

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-bg-primary border border-border rounded-lg text-[11px]">
      <select
        value={filter.column}
        onChange={(e) => onChange({ ...filter, column: e.target.value })}
        className="bg-transparent text-text-primary font-mono text-[11px] focus:outline-none max-w-[120px] truncate"
      >
        {columns.map((c) => (
          <option key={c.name} value={c.name}>{c.name}</option>
        ))}
      </select>
      <select
        value={filter.operator}
        onChange={(e) => {
          const op = e.target.value as FilterOperator;
          onChange({ ...filter, operator: op, value: isNoValueOperator(op) ? '' : filter.value });
        }}
        className="bg-transparent text-accent font-medium text-[11px] focus:outline-none"
      >
        {operators.map((op) => (
          <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
        ))}
      </select>
      {!noValue && (
        <input
          type="text"
          value={filter.value}
          onChange={(e) => onChange({ ...filter, value: e.target.value })}
          placeholder="value"
          className="w-20 px-1.5 py-0.5 bg-bg-secondary border border-border rounded text-text-primary font-mono text-[11px] focus:border-accent focus:outline-none placeholder:text-text-tertiary"
        />
      )}
      <button onClick={onRemove} className="p-0.5 text-text-tertiary hover:text-error transition-colors">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

export function DataFilterBar({ filters, onFiltersChange, columns }: DataFilterBarProps) {
  const [localSearch, setLocalSearch] = useState(filters.globalSearch);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Sync local search from external filter changes
  useEffect(() => {
    setLocalSearch(filters.globalSearch);
  }, [filters.globalSearch]);

  const handleSearchChange = useCallback((value: string) => {
    setLocalSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onFiltersChange({ ...filters, globalSearch: value });
    }, 300);
  }, [filters, onFiltersChange]);

  const addFilter = () => {
    if (columns.length === 0) return;
    const defaultOps = getOperatorsForType(columns[0].type);
    const newFilter: ColumnFilter = {
      column: columns[0].name,
      operator: defaultOps[0],
      value: '',
    };
    onFiltersChange({ ...filters, columnFilters: [...filters.columnFilters, newFilter] });
  };

  const updateFilter = (index: number, updated: ColumnFilter) => {
    const next = [...filters.columnFilters];
    next[index] = updated;
    onFiltersChange({ ...filters, columnFilters: next });
  };

  const removeFilter = (index: number) => {
    onFiltersChange({ ...filters, columnFilters: filters.columnFilters.filter((_, i) => i !== index) });
  };

  const clearAll = () => {
    setLocalSearch('');
    onFiltersChange(EMPTY_FILTER_STATE);
  };

  const activeCount = filters.columnFilters.length + (filters.globalSearch ? 1 : 0);

  return (
    <div className="border-b border-border bg-bg-secondary">
      {/* Row 1: Global search + actions */}
      <div className="flex items-center gap-2 px-4 py-1.5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-tertiary" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search all columns... (* for wildcard)"
            className="w-full pl-7 pr-3 py-1 bg-bg-primary border border-border rounded-lg text-[11px] text-text-primary font-mono placeholder:text-text-tertiary focus:border-accent focus:outline-none"
          />
          {localSearch && (
            <button
              onClick={() => handleSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        {columns.length > 0 && (
          <Tooltip content="Add column filter" placement="bottom">
            <button
              onClick={addFilter}
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-text-secondary hover:text-text-primary hover:bg-bg-tertiary border border-border rounded-lg transition-colors"
            >
              <Plus className="w-3 h-3" />
              <Filter className="w-3 h-3" />
            </button>
          </Tooltip>
        )}
        {activeCount > 0 && (
          <Tooltip content="Clear all filters" placement="bottom">
            <button
              onClick={clearAll}
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-error hover:bg-error-subtle border border-error/20 rounded-lg transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              <span>{activeCount}</span>
            </button>
          </Tooltip>
        )}
      </div>

      {/* Row 2: Active column filters */}
      {filters.columnFilters.length > 0 && (
        <div className="flex items-center gap-1.5 px-4 pb-1.5 flex-wrap">
          {filters.columnFilters.map((cf, i) => (
            <FilterChip
              key={i}
              filter={cf}
              columns={columns}
              onChange={(f) => updateFilter(i, f)}
              onRemove={() => removeFilter(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
