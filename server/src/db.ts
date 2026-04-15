import Firebird from 'node-firebird';
import { ConnectionConfig, ColumnDef, QueryResult } from './types.js';

interface SessionEntry {
  db: Firebird.Database | null;
  config: ConnectionConfig;
  queue: Promise<unknown>;
  connectedAt: string;
}

const sessions = new Map<string, SessionEntry>();

// Auto-cleanup stale sessions (30 min TTL)
const SESSION_TTL = 30 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of sessions.entries()) {
    if (now - new Date(entry.connectedAt).getTime() > SESSION_TTL) {
      if (entry.db) {
        try { entry.db.detach(() => {}); } catch { /* ignore */ }
      }
      sessions.delete(id);
    }
  }
}, 60_000);

const FIELD_TYPE_MAP: Record<number, string> = {
  7: 'SMALLINT',
  8: 'INTEGER',
  10: 'FLOAT',
  12: 'DATE',
  13: 'TIME',
  14: 'CHAR',
  16: 'BIGINT',
  27: 'DOUBLE PRECISION',
  35: 'TIMESTAMP',
  23: 'BOOLEAN',
  37: 'VARCHAR',
  261: 'BLOB',
};

export function mapFieldType(typeCode: number): string {
  return FIELD_TYPE_MAP[typeCode] ?? `UNKNOWN(${typeCode})`;
}

function toFirebirdOptions(config: ConnectionConfig): Firebird.Options {
  return {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    blobAsText: false,
  };
}

export function attachAsync(config: ConnectionConfig): Promise<Firebird.Database> {
  return new Promise((resolve, reject) => {
    Firebird.attach(toFirebirdOptions(config), (err, db) => {
      if (err) return reject(err);
      resolve(db);
    });
  });
}

export function detachAsync(db: Firebird.Database): Promise<void> {
  return new Promise((resolve, reject) => {
    db.detach((err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

function stripBlobs(row: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === 'function') {
      // BLOB callback — node-firebird returns a function for BLOB fields
      cleaned[key] = null;
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      // ARRAY or other unsupported complex type — node-firebird returns {low, high} descriptors
      cleaned[key] = '[ARRAY]';
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

function queryDb(db: Firebird.Database, sql: string, params: unknown[]): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    db.query(sql, params as any[], (err, result) => {
      if (err) return reject(err);
      resolve(result ?? []);
    });
  });
}

// Serialize all queries on a session to prevent concurrent access deadlocks
function enqueue<T>(session: SessionEntry, fn: () => Promise<T>): Promise<T> {
  const task = session.queue.then(fn, fn);
  session.queue = task.then(() => {}, () => {});
  return task;
}

export function createSession(sessionId: string, db: Firebird.Database | null, config: ConnectionConfig): void {
  sessions.set(sessionId, { db, config, queue: Promise.resolve(), connectedAt: new Date().toISOString() });
}

export function getSessionConfig(sessionId: string): ConnectionConfig | undefined {
  return sessions.get(sessionId)?.config;
}

export function updateSessionDb(sessionId: string, db: Firebird.Database, database: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.db = db;
    session.config = { ...session.config, database };
  }
}

export function getSession(sessionId: string): SessionEntry | undefined {
  return sessions.get(sessionId);
}

export function deleteSession(sessionId: string): boolean {
  return sessions.delete(sessionId);
}

export async function queryAsync(sessionId: string, sql: string, params: unknown[] = []): Promise<QueryResult> {
  const session = sessions.get(sessionId);
  if (!session) throw new Error('Invalid or expired session');
  if (!session.db) throw new Error('No database selected. Please select a database first.');
  const db = session.db;

  return enqueue(session, async () => {
    const start = performance.now();
    const rows = await queryDb(db, sql, params) as Record<string, unknown>[];
    const duration = Math.round(performance.now() - start);

    const fields = rows.length > 0
      ? Object.keys(rows[0]).map((name) => ({ name: name.trim(), type: 'VARCHAR' }))
      : [];

    return {
      rows: rows.map((row) => {
        const cleaned = stripBlobs(row);
        const trimmed: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(cleaned)) {
          trimmed[key.trim()] = typeof value === 'string' ? value.trimEnd() : value;
        }
        return trimmed;
      }),
      fields,
      rowsAffected: rows.length,
      duration,
    };
  });
}

export async function getTableSchema(sessionId: string, tableName: string): Promise<ColumnDef[]> {
  const session = sessions.get(sessionId);
  if (!session) throw new Error('Invalid or expired session');
  if (!session.db) throw new Error('No database selected');
  const db = session.db;

  return enqueue(session, async () => {
    const sql = `
      SELECT
        rf.RDB$FIELD_NAME,
        f.RDB$FIELD_TYPE,
        f.RDB$FIELD_LENGTH,
        rf.RDB$NULL_FLAG,
        CAST(rf.RDB$DEFAULT_SOURCE AS VARCHAR(1024)) AS RDB$DEFAULT_SOURCE,
        rc.RDB$CONSTRAINT_TYPE
      FROM RDB$RELATION_FIELDS rf
      JOIN RDB$FIELDS f ON f.RDB$FIELD_NAME = rf.RDB$FIELD_SOURCE
      LEFT JOIN RDB$INDEX_SEGMENTS seg ON seg.RDB$FIELD_NAME = rf.RDB$FIELD_NAME
      LEFT JOIN RDB$RELATION_CONSTRAINTS rc
        ON rc.RDB$INDEX_NAME = seg.RDB$INDEX_NAME
        AND rc.RDB$RELATION_NAME = rf.RDB$RELATION_NAME
        AND rc.RDB$CONSTRAINT_TYPE = 'PRIMARY KEY'
      WHERE rf.RDB$RELATION_NAME = ?
      ORDER BY rf.RDB$FIELD_POSITION
    `;

    const rows = (await queryDb(db, sql, [tableName]) as Record<string, unknown>[]).map(stripBlobs);

    const seen = new Map<string, ColumnDef>();
    for (const row of rows) {
      const name = (row['RDB$FIELD_NAME'] as string).trim();
      const isPk = (row['RDB$CONSTRAINT_TYPE'] as string | null)?.trim() === 'PRIMARY KEY';
      const existing = seen.get(name);
      if (existing) {
        if (isPk) existing.primaryKey = true;
      } else {
        seen.set(name, {
          name,
          type: mapFieldType(row['RDB$FIELD_TYPE'] as number),
          typeCode: row['RDB$FIELD_TYPE'] as number,
          nullable: row['RDB$NULL_FLAG'] !== 1,
          primaryKey: isPk,
          length: row['RDB$FIELD_LENGTH'] as number | undefined,
          defaultValue: row['RDB$DEFAULT_SOURCE']
            ? String(row['RDB$DEFAULT_SOURCE']).trim()
            : undefined,
        });
      }
    }
    return Array.from(seen.values());
  });
}

export interface ArrayColumnInfo {
  name: string;
  lowerBound: number;
  upperBound: number;
}

export async function getArrayColumns(sessionId: string, tableName: string): Promise<ArrayColumnInfo[]> {
  const session = sessions.get(sessionId);
  if (!session) throw new Error('Invalid or expired session');
  if (!session.db) throw new Error('No database selected');
  const db = session.db;

  return enqueue(session, async () => {
    const sql = `
      SELECT rf.RDB$FIELD_NAME, d.RDB$LOWER_BOUND, d.RDB$UPPER_BOUND
      FROM RDB$RELATION_FIELDS rf
      JOIN RDB$FIELDS f ON f.RDB$FIELD_NAME = rf.RDB$FIELD_SOURCE
      JOIN RDB$FIELD_DIMENSIONS d ON d.RDB$FIELD_NAME = rf.RDB$FIELD_SOURCE
      WHERE rf.RDB$RELATION_NAME = ?
      ORDER BY rf.RDB$FIELD_POSITION, d.RDB$DIMENSION
    `;
    const rows = (await queryDb(db, sql, [tableName]) as Record<string, unknown>[]);
    return rows.map((r) => ({
      name: (r['RDB$FIELD_NAME'] as string).trim(),
      lowerBound: r['RDB$LOWER_BOUND'] as number,
      upperBound: r['RDB$UPPER_BOUND'] as number,
    }));
  });
}

export async function getPrimaryKeyColumn(sessionId: string, tableName: string): Promise<string | null> {
  const schema = await getTableSchema(sessionId, tableName);
  const pk = schema.find((col) => col.primaryKey);
  return pk ? pk.name : null;
}
