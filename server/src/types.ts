export interface ConnectionConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export interface ColumnDef {
  name: string;
  type: string;
  typeCode?: number;
  nullable: boolean;
  primaryKey: boolean;
  length?: number;
  defaultValue?: string;
}

export interface QueryResult {
  rows: Record<string, unknown>[];
  fields: { name: string; type: string }[];
  rowsAffected: number;
  duration: number;
}

export interface Session {
  db: unknown;
  config: ConnectionConfig;
}
