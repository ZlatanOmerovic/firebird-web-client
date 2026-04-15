const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

interface ConnectionConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

interface ColumnDef {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  length?: number;
  defaultValue?: string;
}

interface QueryResult {
  rows: Record<string, unknown>[];
  fields: { name: string; type: string }[];
  rowsAffected: number;
  duration: number;
}

interface PaginatedRows {
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MutationResult {
  ok?: boolean;
  inserted?: boolean;
  updated?: boolean;
  deleted?: boolean;
  sql?: string;
  duration?: number;
}

let sessionId: string | null = null;

export function setSessionId(id: string | null): void {
  sessionId = id;
}

export function getSessionId(): string | null {
  return sessionId;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers as Record<string, string> ?? {}),
  };

  if (sessionId) {
    headers['x-session-id'] = sessionId;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }

  return res.json();
}

export interface DatabaseInfo {
  name: string;
  path: string;
  source: 'alias' | 'file';
}

export interface ConnectResult {
  sessionId: string;
  databases?: DatabaseInfo[];
  noDatabase?: boolean;
}

export async function connect(config: ConnectionConfig): Promise<ConnectResult> {
  const result = await request<ConnectResult>('/connect', {
    method: 'POST',
    body: JSON.stringify(config),
  });
  sessionId = result.sessionId;
  return result;
}

export async function getDatabases(): Promise<{ databases: DatabaseInfo[]; currentDatabase: string | null }> {
  return request('/databases');
}

export async function selectDatabase(database: string): Promise<{ ok: boolean; database: string }> {
  return request('/select-database', {
    method: 'POST',
    body: JSON.stringify({ database }),
  });
}

export async function disconnect(): Promise<void> {
  await request<{ ok: boolean }>('/disconnect', { method: 'DELETE' });
  sessionId = null;
}

export async function ping(): Promise<{ ok: boolean; version: string }> {
  return request('/ping');
}

export interface SidebarData {
  tables: string[];
  views: string[];
  procedures: string[];
  triggers: TriggerSummary[];
  generators: GeneratorInfo[];
  domains: DomainInfo[];
  counts: Record<string, number>;
}

export async function getSidebarData(): Promise<SidebarData> {
  return request('/sidebar');
}

export interface ServerInfo {
  databasePath: string;
  host: string;
  port: number;
  currentUser: string;
  protocol: string;
  connectedAt: string;
  connectionId?: number | null;
  firebirdVersion?: string | null;
}

export interface DatabaseAlias {
  alias: string;
  path: string;
}

export interface TestConnectionResult {
  ok: boolean;
  error?: string;
  host?: string;
  port?: number;
  firebirdVersion?: string | null;
  databasePath?: string | null;
  currentUser?: string | null;
  aliases?: DatabaseAlias[];
}

export async function testConnection(config: ConnectionConfig): Promise<TestConnectionResult> {
  const res = await fetch(`${BASE_URL}/test-connection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return res.json();
}

export async function getServerInfo(): Promise<ServerInfo> {
  return request('/server-info');
}

export async function getTables(): Promise<string[]> {
  return request('/tables');
}

export async function getTableCounts(): Promise<Record<string, number>> {
  return request('/tables/counts');
}

export async function getTableSchema(tableName: string): Promise<ColumnDef[]> {
  return request(`/tables/${encodeURIComponent(tableName)}/schema`);
}

export async function getTableRows(
  tableName: string,
  page: number = 1,
  pageSize: number = 50,
  orderBy?: string,
  orderDir: 'asc' | 'desc' = 'asc',
  filters?: { globalSearch: string; columnFilters: { column: string; operator: string; value: string }[] },
): Promise<PaginatedRows> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (orderBy) {
    params.set('orderBy', orderBy);
    params.set('orderDir', orderDir);
  }
  if (filters && (filters.globalSearch || filters.columnFilters.length > 0)) {
    params.set('filters', JSON.stringify(filters));
  }
  return request(`/tables/${encodeURIComponent(tableName)}/rows?${params}`);
}

export async function insertRow(tableName: string, values: Record<string, unknown>): Promise<MutationResult> {
  return request(`/tables/${encodeURIComponent(tableName)}/rows`, {
    method: 'POST',
    body: JSON.stringify({ values }),
  });
}

export async function updateRow(tableName: string, pk: string, values: Record<string, unknown>): Promise<MutationResult> {
  return request(`/tables/${encodeURIComponent(tableName)}/rows/${encodeURIComponent(pk)}`, {
    method: 'PUT',
    body: JSON.stringify({ values }),
  });
}

export async function deleteRow(tableName: string, pk: string): Promise<MutationResult> {
  return request(`/tables/${encodeURIComponent(tableName)}/rows/${encodeURIComponent(pk)}`, {
    method: 'DELETE',
  });
}

export async function executeSql(query: string): Promise<QueryResult> {
  return request('/sql', {
    method: 'POST',
    body: JSON.stringify({ query }),
  });
}

export async function getTableDDL(tableName: string): Promise<{ ddl: string }> {
  return request(`/tables/${encodeURIComponent(tableName)}/ddl`);
}

export async function getProcedureDDL(name: string): Promise<{ ddl: string }> {
  return request(`/procedures/${encodeURIComponent(name)}/ddl`);
}

export async function getTriggerDDL(name: string): Promise<{ ddl: string }> {
  return request(`/triggers/${encodeURIComponent(name)}/ddl`);
}

export async function getDomainDDL(name: string): Promise<{ ddl: string }> {
  return request(`/domains/${encodeURIComponent(name)}/ddl`);
}

export async function getGeneratorDDL(name: string): Promise<{ ddl: string }> {
  return request(`/generators/${encodeURIComponent(name)}/ddl`);
}

// --- Table DDL ---

export interface CreateTableColumn {
  name: string;
  type: string;
  length?: number;
  nullable?: boolean;
  primaryKey?: boolean;
  defaultValue?: string;
}

export async function createTable(name: string, columns: CreateTableColumn[]): Promise<MutationResult> {
  return request('/tables', { method: 'POST', body: JSON.stringify({ name, columns }) });
}

export async function dropTable(name: string): Promise<MutationResult> {
  return request(`/tables/${encodeURIComponent(name)}`, { method: 'DELETE' });
}

// --- Schema modification ---

export interface AddColumnParams {
  columnName: string;
  type: string;
  length?: number;
  nullable?: boolean;
  defaultValue?: string;
}

export interface AlterColumnParams {
  type?: string;
  length?: number;
  newName?: string;
  nullable?: boolean;
  defaultValue?: string | null;
}

export async function addColumn(tableName: string, params: AddColumnParams): Promise<MutationResult> {
  return request(`/tables/${encodeURIComponent(tableName)}/columns`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function alterColumn(tableName: string, columnName: string, params: AlterColumnParams): Promise<MutationResult> {
  return request(`/tables/${encodeURIComponent(tableName)}/columns/${encodeURIComponent(columnName)}`, {
    method: 'PUT',
    body: JSON.stringify(params),
  });
}

export async function dropColumn(tableName: string, columnName: string): Promise<MutationResult> {
  return request(`/tables/${encodeURIComponent(tableName)}/columns/${encodeURIComponent(columnName)}`, {
    method: 'DELETE',
  });
}

// --- DDL mutations ---

export async function createOrAlterView(name: string, source: string): Promise<MutationResult> {
  return request('/views', { method: 'POST', body: JSON.stringify({ name, source }) });
}

export async function dropView(name: string): Promise<MutationResult> {
  return request(`/views/${encodeURIComponent(name)}`, { method: 'DELETE' });
}

export async function createOrAlterProcedure(sql: string): Promise<MutationResult> {
  return request('/procedures', { method: 'POST', body: JSON.stringify({ sql }) });
}

export async function dropProcedure(name: string): Promise<MutationResult> {
  return request(`/procedures/${encodeURIComponent(name)}`, { method: 'DELETE' });
}

export async function createOrAlterTrigger(sql: string): Promise<MutationResult> {
  return request('/triggers', { method: 'POST', body: JSON.stringify({ sql }) });
}

export async function toggleTrigger(name: string, active: boolean): Promise<MutationResult> {
  return request(`/triggers/${encodeURIComponent(name)}/toggle`, { method: 'PUT', body: JSON.stringify({ active }) });
}

export async function dropTrigger(name: string): Promise<MutationResult> {
  return request(`/triggers/${encodeURIComponent(name)}`, { method: 'DELETE' });
}

export async function createGenerator(name: string, initialValue?: number): Promise<MutationResult> {
  return request('/generators', { method: 'POST', body: JSON.stringify({ name, initialValue }) });
}

export async function setGeneratorValue(name: string, value: number): Promise<MutationResult> {
  return request(`/generators/${encodeURIComponent(name)}`, { method: 'PUT', body: JSON.stringify({ value }) });
}

export async function dropGenerator(name: string): Promise<MutationResult> {
  return request(`/generators/${encodeURIComponent(name)}`, { method: 'DELETE' });
}

export async function createDomain(params: { name: string; type: string; length?: number; nullable?: boolean; defaultValue?: string; check?: string }): Promise<MutationResult> {
  return request('/domains', { method: 'POST', body: JSON.stringify(params) });
}

export async function dropDomain(name: string): Promise<MutationResult> {
  return request(`/domains/${encodeURIComponent(name)}`, { method: 'DELETE' });
}

// --- Database objects ---

export interface TriggerSummary {
  name: string;
  table: string | null;
  type: number;
  inactive: boolean;
}

export interface TriggerDetail extends TriggerSummary {
  source: string | null;
}

export interface ProcedureDetail {
  name: string;
  source: string | null;
  description: string | null;
  inputParams: string[];
  outputParams: string[];
}

export interface GeneratorInfo {
  name: string;
  value: number | null;
}

export interface DomainInfo {
  name: string;
  type: string;
  length?: number;
  nullable: boolean;
  defaultValue: string | null;
  check: string | null;
}

export interface ViewDetail {
  name: string;
  source: string | null;
}

export async function getViews(): Promise<string[]> {
  return request('/views');
}

export async function getViewDetail(name: string): Promise<ViewDetail> {
  return request(`/views/${encodeURIComponent(name)}`);
}

export async function getProcedures(): Promise<string[]> {
  return request('/procedures');
}

export async function getProcedureDetail(name: string): Promise<ProcedureDetail> {
  return request(`/procedures/${encodeURIComponent(name)}`);
}

export async function getTriggers(): Promise<TriggerSummary[]> {
  return request('/triggers');
}

export async function getTriggerDetail(name: string): Promise<TriggerDetail> {
  return request(`/triggers/${encodeURIComponent(name)}`);
}

export async function getGenerators(): Promise<GeneratorInfo[]> {
  return request('/generators');
}

export async function getDomains(): Promise<DomainInfo[]> {
  return request('/domains');
}

export type { ConnectionConfig, ColumnDef, QueryResult, PaginatedRows };
