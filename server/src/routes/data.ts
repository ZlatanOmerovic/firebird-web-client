import { FastifyInstance } from 'fastify';
import { queryAsync, getPrimaryKeyColumn, getSession, getTableSchema, getArrayColumns } from '../db.js';

// ── SQL helpers ────────────────────────────────────────────────

/** Format a SQL template with params inlined for display purposes */
function formatSqlWithParams(sql: string, params: unknown[]): string {
  let i = 0;
  return sql.replace(/\?|TRUE|FALSE/g, (match) => {
    if (match === 'TRUE' || match === 'FALSE') return match; // already inlined
    const val = params[i++];
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    return `'${String(val).replace(/'/g, "''")}'`;
  });
}

/**
 * Build SQL + params, inlining booleans as TRUE/FALSE literals
 * since node-firebird can't pass booleans as parameterized values.
 */
function buildValuesSQL(
  columns: string[],
  values: unknown[],
): { placeholders: string[]; params: unknown[] } {
  const placeholders: string[] = [];
  const params: unknown[] = [];
  for (let i = 0; i < columns.length; i++) {
    const val = values[i];
    if (typeof val === 'boolean') {
      placeholders.push(val ? 'TRUE' : 'FALSE');
    } else {
      placeholders.push('?');
      params.push(val);
    }
  }
  return { placeholders, params };
}

function buildSetClauses(
  columns: string[],
  values: unknown[],
): { setClauses: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];
  for (let i = 0; i < columns.length; i++) {
    const val = values[i];
    if (typeof val === 'boolean') {
      parts.push(`"${columns[i].toUpperCase()}" = ${val ? 'TRUE' : 'FALSE'}`);
    } else {
      parts.push(`"${columns[i].toUpperCase()}" = ?`);
      params.push(val);
    }
  }
  return { setClauses: parts.join(', '), params };
}

// ── Filter types (mirrored from client/src/lib/filters.ts) ─────
interface ColumnFilter {
  column: string;
  operator: string;
  value: string;
}
interface FilterState {
  globalSearch: string;
  columnFilters: ColumnFilter[];
}

const OP_MAP: Record<string, { sql: string; needsParam: boolean }> = {
  eq: { sql: '= ?', needsParam: true },
  neq: { sql: '<> ?', needsParam: true },
  gt: { sql: '> ?', needsParam: true },
  lt: { sql: '< ?', needsParam: true },
  gte: { sql: '>= ?', needsParam: true },
  lte: { sql: '<= ?', needsParam: true },
  contains: { sql: 'CONTAINING ?', needsParam: true },
  not_contains: { sql: 'NOT CONTAINING ?', needsParam: true },
  starts_with: { sql: 'STARTING WITH ?', needsParam: true },
  ends_with: { sql: 'LIKE ?', needsParam: true },
  is_null: { sql: 'IS NULL', needsParam: false },
  is_not_null: { sql: 'IS NOT NULL', needsParam: false },
};

const BLOB_TYPE_CODES = new Set([261]);

function buildWhereClause(
  filters: FilterState,
  validColumns: Map<string, { name: string; typeCode: number }>,
): { whereClause: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  // Global search — OR across all non-BLOB columns
  if (filters.globalSearch.trim()) {
    const search = filters.globalSearch.trim();
    const hasWildcard = search.includes('*');
    const orParts: string[] = [];

    for (const [, col] of validColumns) {
      if (BLOB_TYPE_CODES.has(col.typeCode)) continue;
      if (hasWildcard) {
        const likeVal = search.replace(/\*/g, '%');
        orParts.push(`CAST("${col.name}" AS VARCHAR(8000)) LIKE ?`);
        params.push(likeVal);
      } else {
        orParts.push(`CAST("${col.name}" AS VARCHAR(8000)) CONTAINING ?`);
        params.push(search);
      }
    }

    if (orParts.length > 0) {
      conditions.push(`(${orParts.join(' OR ')})`);
    }
  }

  // Per-column filters
  for (const cf of filters.columnFilters) {
    const col = validColumns.get(cf.column.toUpperCase());
    if (!col) continue;
    if (col.name.includes('"')) continue;

    const op = OP_MAP[cf.operator];
    if (!op) continue;

    if (op.needsParam && !cf.value && cf.operator !== 'eq' && cf.operator !== 'neq') continue;

    if (cf.operator === 'ends_with') {
      conditions.push(`"${col.name}" ${op.sql}`);
      params.push(`%${cf.value}`);
    } else if (op.needsParam) {
      conditions.push(`"${col.name}" ${op.sql}`);
      params.push(cf.value);
    } else {
      conditions.push(`"${col.name}" ${op.sql}`);
    }
  }

  if (conditions.length === 0) return { whereClause: '', params: [] };
  return { whereClause: ` WHERE ${conditions.join(' AND ')}`, params };
}

export async function dataRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    if (!sessionId || !getSession(sessionId)) {
      return reply.status(401).send({ error: 'Invalid or missing session' });
    }
  });

  // GET rows with pagination, sort, and filters
  app.get<{
    Params: { name: string };
    Querystring: { page?: string; pageSize?: string; orderBy?: string; orderDir?: string; filters?: string };
  }>('/api/tables/:name/rows', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    const tableName = request.params.name.toUpperCase();
    const page = Math.max(1, parseInt(request.query.page ?? '1', 10));
    const pageSize = Math.min(1000, Math.max(1, parseInt(request.query.pageSize ?? '50', 10)));
    const orderBy = request.query.orderBy;
    const orderDir = request.query.orderDir?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    // Parse filters
    let filterState: FilterState = { globalSearch: '', columnFilters: [] };
    if (request.query.filters) {
      try {
        filterState = JSON.parse(request.query.filters);
      } catch {
        return reply.status(400).send({ error: 'Invalid filters parameter' });
      }
    }

    // Build WHERE clause with column validation
    let whereClause = '';
    let filterParams: unknown[] = [];

    if (filterState.globalSearch || filterState.columnFilters.length > 0) {
      try {
        const schema = await getTableSchema(sessionId, tableName);
        const validColumns = new Map(schema.map((c) => [c.name.toUpperCase(), { name: c.name, typeCode: c.typeCode ?? 0 }]));
        const result = buildWhereClause(filterState, validColumns);
        whereClause = result.whereClause;
        filterParams = result.params;
      } catch {
        // Schema fetch failed — skip filtering
      }
    }

    const countResult = await queryAsync(sessionId, `SELECT COUNT(*) AS CNT FROM "${tableName}"${whereClause}`, filterParams);
    const total = (countResult.rows[0]?.['CNT'] as number) ?? 0;

    // Detect array columns and build explicit SELECT list expanding them
    let selectList = '*';
    try {
      const arrayCols = await getArrayColumns(sessionId, tableName);
      if (arrayCols.length > 0) {
        const schema = await getTableSchema(sessionId, tableName);
        const arraySet = new Map(arrayCols.map((a) => [a.name, a]));
        const parts: string[] = [];
        for (const col of schema) {
          const arr = arraySet.get(col.name);
          if (arr) {
            for (let idx = arr.lowerBound; idx <= arr.upperBound; idx++) {
              parts.push(`"${col.name}"[${idx}] AS "${col.name}[${idx}]"`);
            }
          } else {
            parts.push(`"${col.name}"`);
          }
        }
        selectList = parts.join(', ');
      }
    } catch {
      // Fall back to SELECT *
    }

    let sql = `SELECT FIRST ${pageSize} SKIP ${(page - 1) * pageSize} ${selectList} FROM "${tableName}"${whereClause}`;
    if (orderBy) {
      sql += ` ORDER BY "${orderBy.toUpperCase()}" ${orderDir}`;
    }

    const result = await queryAsync(sessionId, sql, filterParams);
    return { rows: result.rows, total, page, pageSize };
  });

  // POST insert row
  app.post<{
    Params: { name: string };
    Body: { values: Record<string, unknown> };
  }>('/api/tables/:name/rows', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    const tableName = request.params.name.toUpperCase();
    const { values } = request.body as { values: Record<string, unknown> };

    if (!values || Object.keys(values).length === 0) {
      return reply.status(400).send({ error: 'No values provided' });
    }

    const columns = Object.keys(values);
    const vals = Object.values(values);
    const { placeholders, params: queryParams } = buildValuesSQL(columns, vals);
    const sql = `INSERT INTO "${tableName}" (${columns.map((c) => `"${c.toUpperCase()}"`).join(', ')}) VALUES (${placeholders.join(', ')})`;

    const start = performance.now();
    await queryAsync(sessionId, sql, queryParams);
    const duration = Math.round(performance.now() - start);
    return { inserted: true, sql: formatSqlWithParams(sql, queryParams), duration };
  });

  // PUT update row by PK
  app.put<{
    Params: { name: string; pk: string };
    Body: { values: Record<string, unknown> };
  }>('/api/tables/:name/rows/:pk', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    const tableName = request.params.name.toUpperCase();
    const pkValue = request.params.pk;
    const { values } = request.body as { values: Record<string, unknown> };

    const pkColumn = await getPrimaryKeyColumn(sessionId, tableName);
    if (!pkColumn) {
      return reply.status(400).send({ error: 'Table has no primary key' });
    }

    if (!values || Object.keys(values).length === 0) {
      return reply.status(400).send({ error: 'No values provided' });
    }

    const cols = Object.keys(values);
    const vals = Object.values(values);
    const { setClauses, params: setParams } = buildSetClauses(cols, vals);
    const sql = `UPDATE "${tableName}" SET ${setClauses} WHERE "${pkColumn}" = ?`;
    const params = [...setParams, pkValue];

    const start = performance.now();
    await queryAsync(sessionId, sql, params);
    const duration = Math.round(performance.now() - start);
    return { updated: true, sql: formatSqlWithParams(sql, params), duration };
  });

  // DELETE row by PK
  app.delete<{
    Params: { name: string; pk: string };
  }>('/api/tables/:name/rows/:pk', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    const tableName = request.params.name.toUpperCase();
    const pkValue = request.params.pk;

    const pkColumn = await getPrimaryKeyColumn(sessionId, tableName);
    if (!pkColumn) {
      return reply.status(400).send({ error: 'Table has no primary key' });
    }

    const sql = `DELETE FROM "${tableName}" WHERE "${pkColumn}" = ?`;
    const start = performance.now();
    await queryAsync(sessionId, sql, [pkValue]);
    const duration = Math.round(performance.now() - start);
    return { deleted: true, sql: formatSqlWithParams(sql, [pkValue]), duration };
  });
}
