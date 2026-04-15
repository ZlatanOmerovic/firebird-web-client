export type FilterOperator =
  | 'eq' | 'neq'
  | 'gt' | 'lt' | 'gte' | 'lte'
  | 'contains' | 'not_contains'
  | 'starts_with' | 'ends_with'
  | 'is_null' | 'is_not_null';

export interface ColumnFilter {
  column: string;
  operator: FilterOperator;
  value: string;
}

export interface FilterState {
  globalSearch: string;
  columnFilters: ColumnFilter[];
}

export const EMPTY_FILTER_STATE: FilterState = {
  globalSearch: '',
  columnFilters: [],
};

export function hasActiveFilters(f: FilterState): boolean {
  return f.globalSearch.length > 0 || f.columnFilters.length > 0;
}

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  eq: '=',
  neq: '≠',
  gt: '>',
  lt: '<',
  gte: '≥',
  lte: '≤',
  contains: 'contains',
  not_contains: 'not contains',
  starts_with: 'starts with',
  ends_with: 'ends with',
  is_null: 'is null',
  is_not_null: 'is not null',
};

const NUMERIC_TYPES = new Set(['SMALLINT', 'INTEGER', 'BIGINT', 'FLOAT', 'DOUBLE PRECISION', 'NUMERIC', 'DECIMAL', 'INT64']);
const DATE_TYPES = new Set(['DATE', 'TIME', 'TIMESTAMP']);
const BLOB_TYPES = new Set(['BLOB']);

export function getOperatorsForType(type: string): FilterOperator[] {
  const upper = type.toUpperCase();
  if (BLOB_TYPES.has(upper)) return ['is_null', 'is_not_null'];
  if (NUMERIC_TYPES.has(upper)) return ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is_null', 'is_not_null'];
  if (DATE_TYPES.has(upper)) return ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is_null', 'is_not_null'];
  // String/default
  return ['eq', 'neq', 'contains', 'not_contains', 'starts_with', 'ends_with', 'is_null', 'is_not_null'];
}

export function isNoValueOperator(op: FilterOperator): boolean {
  return op === 'is_null' || op === 'is_not_null';
}

// ── Client-side filtering (for SQL editor results) ──────────────

function matchesGlobal(row: Record<string, unknown>, search: string): boolean {
  const hasWildcard = search.includes('*');
  if (hasWildcard) {
    const pattern = new RegExp('^' + search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*') + '$', 'i');
    return Object.values(row).some((v) => v !== null && pattern.test(String(v)));
  }
  const q = search.toLowerCase();
  return Object.values(row).some((v) => v !== null && String(v).toLowerCase().includes(q));
}

function matchesColumnFilter(row: Record<string, unknown>, filter: ColumnFilter): boolean {
  const raw = row[filter.column];

  if (filter.operator === 'is_null') return raw === null || raw === undefined;
  if (filter.operator === 'is_not_null') return raw !== null && raw !== undefined;

  if (raw === null || raw === undefined) return false;

  const valStr = String(raw);
  const filterVal = filter.value;
  const valLower = valStr.toLowerCase();
  const filterLower = filterVal.toLowerCase();

  // Try numeric comparison if both parse
  const numRaw = Number(raw);
  const numFilter = Number(filterVal);
  const bothNumeric = !isNaN(numRaw) && !isNaN(numFilter) && filterVal.trim() !== '';

  switch (filter.operator) {
    case 'eq':
      return bothNumeric ? numRaw === numFilter : valLower === filterLower;
    case 'neq':
      return bothNumeric ? numRaw !== numFilter : valLower !== filterLower;
    case 'gt':
      return bothNumeric ? numRaw > numFilter : valStr > filterVal;
    case 'lt':
      return bothNumeric ? numRaw < numFilter : valStr < filterVal;
    case 'gte':
      return bothNumeric ? numRaw >= numFilter : valStr >= filterVal;
    case 'lte':
      return bothNumeric ? numRaw <= numFilter : valStr <= filterVal;
    case 'contains':
      return valLower.includes(filterLower);
    case 'not_contains':
      return !valLower.includes(filterLower);
    case 'starts_with':
      return valLower.startsWith(filterLower);
    case 'ends_with':
      return valLower.endsWith(filterLower);
    default:
      return true;
  }
}

export function applyClientFilters(
  rows: Record<string, unknown>[],
  filters: FilterState,
): Record<string, unknown>[] {
  let result = rows;

  if (filters.globalSearch) {
    result = result.filter((row) => matchesGlobal(row, filters.globalSearch));
  }

  for (const cf of filters.columnFilters) {
    if (!isNoValueOperator(cf.operator) && !cf.value) continue; // skip empty value filters
    result = result.filter((row) => matchesColumnFilter(row, cf));
  }

  return result;
}
