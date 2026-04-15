import { FastifyInstance } from 'fastify';
import { queryAsync, getTableSchema, getSession } from '../db.js';

export async function schemaRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    if (!sessionId || !getSession(sessionId)) {
      return reply.status(401).send({ error: 'Invalid or missing session' });
    }
  });

  // Single endpoint to load all sidebar data in one round trip
  app.get('/api/sidebar', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    try {
    const [tablesResult, viewsResult, proceduresResult, triggersResult, generatorsNames, domainsResult] = await Promise.all([
      queryAsync(sessionId, `SELECT RDB$RELATION_NAME FROM RDB$RELATIONS WHERE RDB$SYSTEM_FLAG = 0 AND RDB$VIEW_BLR IS NULL ORDER BY RDB$RELATION_NAME`),
      queryAsync(sessionId, `SELECT RDB$RELATION_NAME FROM RDB$RELATIONS WHERE RDB$SYSTEM_FLAG = 0 AND RDB$VIEW_BLR IS NOT NULL ORDER BY RDB$RELATION_NAME`),
      queryAsync(sessionId, `SELECT RDB$PROCEDURE_NAME FROM RDB$PROCEDURES WHERE RDB$SYSTEM_FLAG = 0 ORDER BY RDB$PROCEDURE_NAME`),
      queryAsync(sessionId, `SELECT RDB$TRIGGER_NAME, RDB$RELATION_NAME, RDB$TRIGGER_TYPE, RDB$TRIGGER_INACTIVE FROM RDB$TRIGGERS WHERE RDB$SYSTEM_FLAG = 0 ORDER BY RDB$TRIGGER_NAME`),
      queryAsync(sessionId, `SELECT RDB$GENERATOR_NAME FROM RDB$GENERATORS WHERE RDB$SYSTEM_FLAG = 0 ORDER BY RDB$GENERATOR_NAME`),
      queryAsync(sessionId, `
        SELECT f.RDB$FIELD_NAME, f.RDB$FIELD_TYPE, f.RDB$FIELD_LENGTH, f.RDB$NULL_FLAG,
          CAST(f.RDB$DEFAULT_SOURCE AS VARCHAR(1024)) AS RDB$DEFAULT_SOURCE,
          CAST(f.RDB$VALIDATION_SOURCE AS VARCHAR(1024)) AS RDB$VALIDATION_SOURCE
        FROM RDB$FIELDS f WHERE f.RDB$SYSTEM_FLAG = 0 AND f.RDB$FIELD_NAME NOT STARTING WITH 'RDB$' ORDER BY f.RDB$FIELD_NAME
      `),
    ]);

    const tables = tablesResult.rows.map((r) => ((r['RDB$RELATION_NAME'] as string) ?? '').trim());
    const views = viewsResult.rows.map((r) => ((r['RDB$RELATION_NAME'] as string) ?? '').trim());
    const procedures = proceduresResult.rows.map((r) => ((r['RDB$PROCEDURE_NAME'] as string) ?? '').trim());
    const triggers = triggersResult.rows.map((r) => ({
      name: ((r['RDB$TRIGGER_NAME'] as string) ?? '').trim(),
      table: r['RDB$RELATION_NAME'] ? (r['RDB$RELATION_NAME'] as string).trim() : null,
      type: r['RDB$TRIGGER_TYPE'] as number,
      inactive: r['RDB$TRIGGER_INACTIVE'] === 1,
    }));

    // Get generator values
    const generators = [];
    for (const row of generatorsNames.rows) {
      const genName = ((row['RDB$GENERATOR_NAME'] as string) ?? '').trim();
      try {
        const valResult = await queryAsync(sessionId, `SELECT GEN_ID("${genName}", 0) AS VAL FROM RDB$DATABASE`);
        generators.push({ name: genName, value: valResult.rows[0]?.['VAL'] ?? 0 });
      } catch {
        generators.push({ name: genName, value: null });
      }
    }

    const { mapFieldType } = await import('../db.js');
    const domains = domainsResult.rows.map((row) => ({
      name: ((row['RDB$FIELD_NAME'] as string) ?? '').trim(),
      type: mapFieldType(row['RDB$FIELD_TYPE'] as number),
      length: row['RDB$FIELD_LENGTH'] as number | undefined,
      nullable: row['RDB$NULL_FLAG'] !== 1,
      defaultValue: row['RDB$DEFAULT_SOURCE'] ? String(row['RDB$DEFAULT_SOURCE']).trim() : null,
      check: row['RDB$VALIDATION_SOURCE'] ? String(row['RDB$VALIDATION_SOURCE']).trim() : null,
    }));

    // Table counts — single UNION ALL query
    let counts: Record<string, number> = {};
    if (tables.length > 0) {
      try {
        const safeTables = tables.filter(t => !/['"]/.test(t));
        if (safeTables.length > 0) {
          const unions = safeTables.map((t) => `SELECT '${t}' AS TBL, COUNT(*) AS CNT FROM "${t}"`).join(' UNION ALL ');
          const countResult = await queryAsync(sessionId, unions);
          for (const row of countResult.rows) {
            counts[((row['TBL'] as string) ?? '').trim()] = (row['CNT'] as number) ?? 0;
          }
        }
      } catch { /* ignore */ }
    }

    return { tables, views, procedures, triggers, generators, domains, counts };
    } catch (err: unknown) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Failed to load sidebar data' });
    }
  });

  app.get('/api/tables', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    try {
      const result = await queryAsync(sessionId, `
        SELECT RDB$RELATION_NAME
        FROM RDB$RELATIONS
        WHERE RDB$SYSTEM_FLAG = 0
          AND RDB$VIEW_BLR IS NULL
        ORDER BY RDB$RELATION_NAME
      `);

      return result.rows.map((row) => ((row['RDB$RELATION_NAME'] as string) ?? '').trim());
    } catch (err: unknown) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Failed to list tables' });
    }
  });

  app.get('/api/tables/counts', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    try {
      // Get table list first
      const tablesResult = await queryAsync(sessionId, `
        SELECT RDB$RELATION_NAME
        FROM RDB$RELATIONS
        WHERE RDB$SYSTEM_FLAG = 0
          AND RDB$VIEW_BLR IS NULL
        ORDER BY RDB$RELATION_NAME
      `);
      const tableNames = tablesResult.rows.map((r) => ((r['RDB$RELATION_NAME'] as string) ?? '').trim());
      if (tableNames.length === 0) return {};

      // Reject table names containing quotes to prevent SQL injection in UNION ALL
      const safeTables = tableNames.filter(t => !/['"]/.test(t));
      if (safeTables.length === 0) return {};

      // Build a single UNION ALL query to get all counts in one round-trip
      const unions = safeTables.map((t) => `SELECT '${t}' AS TBL, COUNT(*) AS CNT FROM "${t}"`).join(' UNION ALL ');
      try {
        const result = await queryAsync(sessionId, unions);
        const counts: Record<string, number> = {};
        for (const row of result.rows) {
          counts[((row['TBL'] as string) ?? '').trim()] = (row['CNT'] as number) ?? 0;
        }
        return counts;
      } catch {
        return {};
      }
    } catch (err: unknown) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Failed to get table counts' });
    }
  });

  app.get<{ Params: { name: string } }>('/api/tables/:name/schema', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    const tableName = request.params.name.toUpperCase();
    try {
      return await getTableSchema(sessionId, tableName);
    } catch (err: unknown) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Failed to get table schema' });
    }
  });

  // Extract DDL for a table
  app.get<{ Params: { name: string } }>('/api/tables/:name/ddl', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    const tableName = request.params.name.toUpperCase();

    try {
      // Get columns with domain info, computed source, collation
      const colResult = await queryAsync(sessionId, `
        SELECT
          rf.RDB$FIELD_NAME,
          rf.RDB$FIELD_SOURCE,
          f.RDB$FIELD_TYPE,
          f.RDB$FIELD_SUB_TYPE,
          f.RDB$FIELD_LENGTH,
          f.RDB$FIELD_PRECISION,
          f.RDB$FIELD_SCALE,
          f.RDB$CHARACTER_LENGTH,
          rf.RDB$NULL_FLAG,
          f.RDB$NULL_FLAG AS DOMAIN_NULL_FLAG,
          CAST(rf.RDB$DEFAULT_SOURCE AS VARCHAR(1024)) AS COL_DEFAULT,
          CAST(f.RDB$DEFAULT_SOURCE AS VARCHAR(1024)) AS DOMAIN_DEFAULT,
          CAST(f.RDB$COMPUTED_SOURCE AS VARCHAR(4096)) AS COMPUTED_SOURCE,
          f.RDB$CHARACTER_SET_ID,
          rf.RDB$COLLATION_ID
        FROM RDB$RELATION_FIELDS rf
        JOIN RDB$FIELDS f ON f.RDB$FIELD_NAME = rf.RDB$FIELD_SOURCE
        WHERE rf.RDB$RELATION_NAME = ?
        ORDER BY rf.RDB$FIELD_POSITION
      `, [tableName]);

      // Get primary key columns
      const pkResult = await queryAsync(sessionId, `
        SELECT seg.RDB$FIELD_NAME
        FROM RDB$RELATION_CONSTRAINTS rc
        JOIN RDB$INDEX_SEGMENTS seg ON seg.RDB$INDEX_NAME = rc.RDB$INDEX_NAME
        WHERE rc.RDB$RELATION_NAME = ?
          AND rc.RDB$CONSTRAINT_TYPE = 'PRIMARY KEY'
        ORDER BY seg.RDB$FIELD_POSITION
      `, [tableName]);
      const pkCols = pkResult.rows.map((r) => ((r['RDB$FIELD_NAME'] as string) ?? '').trim());

      // Get unique constraints
      const uqResult = await queryAsync(sessionId, `
        SELECT rc.RDB$CONSTRAINT_NAME, seg.RDB$FIELD_NAME
        FROM RDB$RELATION_CONSTRAINTS rc
        JOIN RDB$INDEX_SEGMENTS seg ON seg.RDB$INDEX_NAME = rc.RDB$INDEX_NAME
        WHERE rc.RDB$RELATION_NAME = ?
          AND rc.RDB$CONSTRAINT_TYPE = 'UNIQUE'
        ORDER BY rc.RDB$CONSTRAINT_NAME, seg.RDB$FIELD_POSITION
      `, [tableName]);
      const uniqueConstraints = new Map<string, string[]>();
      for (const r of uqResult.rows) {
        const name = ((r['RDB$CONSTRAINT_NAME'] as string) ?? '').trim();
        const col = ((r['RDB$FIELD_NAME'] as string) ?? '').trim();
        if (!uniqueConstraints.has(name)) uniqueConstraints.set(name, []);
        uniqueConstraints.get(name)!.push(col);
      }

      // Get foreign keys
      const fkResult = await queryAsync(sessionId, `
        SELECT
          rc.RDB$CONSTRAINT_NAME,
          seg.RDB$FIELD_NAME,
          refc.RDB$CONST_NAME_UQ,
          rc2.RDB$RELATION_NAME AS REF_TABLE,
          seg2.RDB$FIELD_NAME AS REF_FIELD,
          refc.RDB$UPDATE_RULE,
          refc.RDB$DELETE_RULE
        FROM RDB$RELATION_CONSTRAINTS rc
        JOIN RDB$INDEX_SEGMENTS seg ON seg.RDB$INDEX_NAME = rc.RDB$INDEX_NAME
        JOIN RDB$REF_CONSTRAINTS refc ON refc.RDB$CONSTRAINT_NAME = rc.RDB$CONSTRAINT_NAME
        JOIN RDB$RELATION_CONSTRAINTS rc2 ON rc2.RDB$CONSTRAINT_NAME = refc.RDB$CONST_NAME_UQ
        JOIN RDB$INDEX_SEGMENTS seg2 ON seg2.RDB$INDEX_NAME = rc2.RDB$INDEX_NAME
          AND seg2.RDB$FIELD_POSITION = seg.RDB$FIELD_POSITION
        WHERE rc.RDB$RELATION_NAME = ?
          AND rc.RDB$CONSTRAINT_TYPE = 'FOREIGN KEY'
        ORDER BY rc.RDB$CONSTRAINT_NAME, seg.RDB$FIELD_POSITION
      `, [tableName]);
      const foreignKeys = new Map<string, { cols: string[]; refTable: string; refCols: string[]; onUpdate: string; onDelete: string }>();
      for (const r of fkResult.rows) {
        const name = ((r['RDB$CONSTRAINT_NAME'] as string) ?? '').trim();
        const col = ((r['RDB$FIELD_NAME'] as string) ?? '').trim();
        const refTable = ((r['REF_TABLE'] as string) ?? '').trim();
        const refCol = ((r['REF_FIELD'] as string) ?? '').trim();
        const onUpdate = ((r['RDB$UPDATE_RULE'] as string) ?? '').trim();
        const onDelete = ((r['RDB$DELETE_RULE'] as string) ?? '').trim();
        if (!foreignKeys.has(name)) foreignKeys.set(name, { cols: [], refTable, refCols: [], onUpdate, onDelete });
        const fk = foreignKeys.get(name)!;
        fk.cols.push(col);
        fk.refCols.push(refCol);
      }

      // Get check constraints
      const chkResult = await queryAsync(sessionId, `
        SELECT rc.RDB$CONSTRAINT_NAME, CAST(t.RDB$TRIGGER_SOURCE AS VARCHAR(4096)) AS CHK_SOURCE
        FROM RDB$RELATION_CONSTRAINTS rc
        JOIN RDB$CHECK_CONSTRAINTS cc ON cc.RDB$CONSTRAINT_NAME = rc.RDB$CONSTRAINT_NAME
        JOIN RDB$TRIGGERS t ON t.RDB$TRIGGER_NAME = cc.RDB$TRIGGER_NAME
        WHERE rc.RDB$RELATION_NAME = ?
          AND rc.RDB$CONSTRAINT_TYPE = 'CHECK'
      `, [tableName]);

      const { mapFieldType } = await import('../db.js');

      // Build column definitions
      const colDefs: string[] = [];
      for (const row of colResult.rows) {
        const fieldName = ((row['RDB$FIELD_NAME'] as string) ?? '').trim();
        const fieldSource = ((row['RDB$FIELD_SOURCE'] as string) ?? '').trim();
        const isUserDomain = !fieldSource.startsWith('RDB$');
        const computedSource = row['COMPUTED_SOURCE'] ? String(row['COMPUTED_SOURCE']).trim() : null;

        let def = `  "${fieldName}"`;

        if (computedSource) {
          def += ` COMPUTED BY ${computedSource}`;
        } else if (isUserDomain) {
          def += ` ${fieldSource}`;
        } else {
          const fieldType = row['RDB$FIELD_TYPE'] as number;
          const subType = row['RDB$FIELD_SUB_TYPE'] as number | null;
          const precision = row['RDB$FIELD_PRECISION'] as number | null;
          const scale = row['RDB$FIELD_SCALE'] as number | null;
          const charLen = row['RDB$CHARACTER_LENGTH'] as number | null;

          if ((fieldType === 7 || fieldType === 8 || fieldType === 16) && precision && scale && scale < 0) {
            def += ` NUMERIC(${precision}, ${-scale})`;
          } else if (fieldType === 14 || fieldType === 37) {
            const typeName = fieldType === 14 ? 'CHAR' : 'VARCHAR';
            def += ` ${typeName}(${charLen ?? (row['RDB$FIELD_LENGTH'] as number)})`;
          } else if (fieldType === 261) {
            def += ` BLOB SUB_TYPE ${subType ?? 0}`;
          } else {
            def += ` ${mapFieldType(fieldType)}`;
          }
        }

        // Default
        const colDefault = row['COL_DEFAULT'] ? String(row['COL_DEFAULT']).trim() : null;
        if (colDefault) def += ` ${colDefault}`;

        // NOT NULL
        if (row['RDB$NULL_FLAG'] === 1) def += ' NOT NULL';

        colDefs.push(def);
      }

      // Constraints
      const constraints: string[] = [];

      if (pkCols.length > 0) {
        constraints.push(`  PRIMARY KEY (${pkCols.map((c) => `"${c}"`).join(', ')})`);
      }

      for (const [name, cols] of uniqueConstraints) {
        constraints.push(`  CONSTRAINT "${name}" UNIQUE (${cols.map((c) => `"${c}"`).join(', ')})`);
      }

      for (const [name, fk] of foreignKeys) {
        let fkDef = `  CONSTRAINT "${name}" FOREIGN KEY (${fk.cols.map((c) => `"${c}"`).join(', ')}) REFERENCES "${fk.refTable}" (${fk.refCols.map((c) => `"${c}"`).join(', ')})`;
        if (fk.onUpdate && fk.onUpdate !== 'RESTRICT') fkDef += ` ON UPDATE ${fk.onUpdate}`;
        if (fk.onDelete && fk.onDelete !== 'RESTRICT') fkDef += ` ON DELETE ${fk.onDelete}`;
        constraints.push(fkDef);
      }

      const seenChecks = new Set<string>();
      for (const row of chkResult.rows) {
        const name = ((row['RDB$CONSTRAINT_NAME'] as string) ?? '').trim();
        if (seenChecks.has(name)) continue;
        seenChecks.add(name);
        const source = row['CHK_SOURCE'] ? String(row['CHK_SOURCE']).trim() : null;
        if (source) constraints.push(`  CONSTRAINT "${name}" ${source}`);
      }

      const allLines = [...colDefs, ...constraints];
      const ddl = `CREATE TABLE "${tableName}" (\n${allLines.join(',\n')}\n);`;

      return { ddl };
    } catch (err: unknown) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : 'Failed to extract DDL' });
    }
  });

  // Create table
  app.post<{ Body: { name: string; columns: { name: string; type: string; length?: number; nullable?: boolean; primaryKey?: boolean; defaultValue?: string }[] } }>('/api/tables', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    const { name, columns } = request.body as { name: string; columns: { name: string; type: string; length?: number; nullable?: boolean; primaryKey?: boolean; defaultValue?: string }[] };
    if (!name || !columns?.length) return reply.status(400).send({ error: 'name and at least one column required' });

    const pkCols = columns.filter((c) => c.primaryKey).map((c) => `"${c.name.toUpperCase()}"`);
    const colDefs = columns.map((col) => {
      let typeDef = col.type.toUpperCase();
      if (col.length && ['VARCHAR', 'CHAR'].includes(typeDef)) typeDef += `(${col.length})`;
      let def = `"${col.name.toUpperCase()}" ${typeDef}`;
      if (col.defaultValue) {
        const dv = col.defaultValue.trim();
        const isNumeric = /^-?\d+(\.\d+)?$/.test(dv);
        const isQuoted = dv.startsWith("'") && dv.endsWith("'");
        const isKeyword = /^(NULL|CURRENT_TIMESTAMP|CURRENT_DATE|CURRENT_TIME|NOW)$/i.test(dv);
        def += ` DEFAULT ${(isNumeric || isQuoted || isKeyword) ? dv : `'${dv.replace(/'/g, "''")}'`}`;
      }
      if (col.nullable === false) def += ' NOT NULL';
      return def;
    });

    if (pkCols.length > 0) {
      colDefs.push(`PRIMARY KEY (${pkCols.join(', ')})`);
    }

    const sql = `CREATE TABLE "${name.toUpperCase()}" (\n  ${colDefs.join(',\n  ')}\n)`;
    try {
      const _start = performance.now();
      await queryAsync(sessionId, sql);
      const _duration = Math.round(performance.now() - _start);
      return { ok: true, sql, duration: _duration };
    } catch (err: unknown) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : 'Failed to create table' });
    }
  });

  // Drop table
  app.delete<{ Params: { name: string } }>('/api/tables/:name', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    try {
      const _sql = `DROP TABLE "${request.params.name.toUpperCase()}"`;
      const _start = performance.now();
      await queryAsync(sessionId, _sql);
      const _duration = Math.round(performance.now() - _start);
      return { ok: true, sql: _sql, duration: _duration };
    } catch (err: unknown) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : 'Failed to drop table' });
    }
  });

  // Add column
  app.post<{
    Params: { name: string };
    Body: { columnName: string; type: string; length?: number; nullable?: boolean; defaultValue?: string };
  }>('/api/tables/:name/columns', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    const tableName = request.params.name.toUpperCase();
    const { columnName, type, length, nullable, defaultValue } = request.body as {
      columnName: string; type: string; length?: number; nullable?: boolean; defaultValue?: string;
    };

    if (!columnName || !type) {
      return reply.status(400).send({ error: 'columnName and type are required' });
    }

    let typeDef = type.toUpperCase();
    if (length && ['VARCHAR', 'CHAR'].includes(typeDef)) {
      typeDef += `(${length})`;
    }

    let sql = `ALTER TABLE "${tableName}" ADD "${columnName.toUpperCase()}" ${typeDef}`;
    if (defaultValue !== undefined && defaultValue !== '') {
      // Auto-quote string defaults if not already quoted or numeric
      const dv = defaultValue.trim();
      const isNumeric = /^-?\d+(\.\d+)?$/.test(dv);
      const isQuoted = (dv.startsWith("'") && dv.endsWith("'"));
      const isKeyword = /^(NULL|CURRENT_TIMESTAMP|CURRENT_DATE|CURRENT_TIME|NOW)$/i.test(dv);
      if (isNumeric || isQuoted || isKeyword) {
        sql += ` DEFAULT ${dv}`;
      } else {
        sql += ` DEFAULT '${dv.replace(/'/g, "''")}'`;
      }
    }
    if (nullable === false) {
      sql += ' NOT NULL';
    }

    try {
      const _start = performance.now();
      await queryAsync(sessionId, sql);
      const _duration = Math.round(performance.now() - _start);
      return { ok: true, sql, duration: _duration };
    } catch (err: unknown) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : 'Failed to add column' });
    }
  });

  // Alter column
  app.put<{
    Params: { name: string; column: string };
    Body: { type?: string; length?: number; newName?: string; nullable?: boolean; defaultValue?: string | null };
  }>('/api/tables/:name/columns/:column', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    const tableName = request.params.name.toUpperCase();
    const colName = request.params.column.toUpperCase();
    const { type, length, newName, nullable, defaultValue } = request.body as {
      type?: string; length?: number; newName?: string; nullable?: boolean; defaultValue?: string | null;
    };

    const statements: string[] = [];

    if (type) {
      let typeDef = type.toUpperCase();
      if (length && ['VARCHAR', 'CHAR'].includes(typeDef)) {
        typeDef += `(${length})`;
      }
      statements.push(`ALTER TABLE "${tableName}" ALTER COLUMN "${colName}" TYPE ${typeDef}`);
    }

    if (defaultValue !== undefined) {
      if (defaultValue === null || defaultValue === '') {
        statements.push(`ALTER TABLE "${tableName}" ALTER COLUMN "${colName}" DROP DEFAULT`);
      } else {
        const dv = defaultValue.trim();
        const isNumeric = /^-?\d+(\.\d+)?$/.test(dv);
        const isQuoted = (dv.startsWith("'") && dv.endsWith("'"));
        const isKeyword = /^(NULL|CURRENT_TIMESTAMP|CURRENT_DATE|CURRENT_TIME|NOW)$/i.test(dv);
        const safeDefault = (isNumeric || isQuoted || isKeyword) ? dv : `'${dv.replace(/'/g, "''")}'`;
        statements.push(`ALTER TABLE "${tableName}" ALTER COLUMN "${colName}" SET DEFAULT ${safeDefault}`);
      }
    }

    if (nullable === false) {
      statements.push(`ALTER TABLE "${tableName}" ALTER COLUMN "${colName}" SET NOT NULL`);
    } else if (nullable === true) {
      statements.push(`ALTER TABLE "${tableName}" ALTER COLUMN "${colName}" DROP NOT NULL`);
    }

    if (newName && newName.toUpperCase() !== colName) {
      statements.push(`ALTER TABLE "${tableName}" ALTER COLUMN "${colName}" TO "${newName.toUpperCase()}"`);
    }

    if (statements.length === 0) {
      return reply.status(400).send({ error: 'No changes specified' });
    }

    try {
      const _start = performance.now();
      for (const stmt of statements) {
        await queryAsync(sessionId, stmt);
      }
      const _duration = Math.round(performance.now() - _start);
      return { ok: true, sql: statements.join(';\n'), duration: _duration };
    } catch (err: unknown) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : 'Failed to alter column' });
    }
  });

  // Drop column
  app.delete<{
    Params: { name: string; column: string };
  }>('/api/tables/:name/columns/:column', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    const tableName = request.params.name.toUpperCase();
    const colName = request.params.column.toUpperCase();

    try {
      const _sql = `ALTER TABLE "${tableName}" DROP "${colName}"`;
      const _start = performance.now();
      await queryAsync(sessionId, _sql);
      const _duration = Math.round(performance.now() - _start);
      return { ok: true, sql: _sql, duration: _duration };
    } catch (err: unknown) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : 'Failed to drop column' });
    }
  });

  app.get('/api/views', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    try {
      const result = await queryAsync(sessionId, `
        SELECT RDB$RELATION_NAME
        FROM RDB$RELATIONS
        WHERE RDB$SYSTEM_FLAG = 0
          AND RDB$VIEW_BLR IS NOT NULL
        ORDER BY RDB$RELATION_NAME
      `);
      return result.rows.map((row) => ((row['RDB$RELATION_NAME'] as string) ?? '').trim());
    } catch (err: unknown) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Failed to list views' });
    }
  });

  app.get<{ Params: { name: string } }>('/api/views/:name', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    const name = request.params.name.toUpperCase();
    try {
      const result = await queryAsync(sessionId, `
        SELECT CAST(RDB$VIEW_SOURCE AS VARCHAR(4096)) AS RDB$VIEW_SOURCE
        FROM RDB$RELATIONS
        WHERE RDB$RELATION_NAME = ?
      `, [name]);
      const source = result.rows[0]?.['RDB$VIEW_SOURCE'];
      return { name, source: source ? String(source).trim() : null };
    } catch (err: unknown) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Failed to get view details' });
    }
  });

  app.get('/api/procedures', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    try {
      const result = await queryAsync(sessionId, `
        SELECT RDB$PROCEDURE_NAME
        FROM RDB$PROCEDURES
        WHERE RDB$SYSTEM_FLAG = 0
        ORDER BY RDB$PROCEDURE_NAME
      `);
      return result.rows.map((row) => ((row['RDB$PROCEDURE_NAME'] as string) ?? '').trim());
    } catch (err: unknown) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Failed to list procedures' });
    }
  });

  app.get<{ Params: { name: string } }>('/api/procedures/:name', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    const name = request.params.name.toUpperCase();
    try {
      const result = await queryAsync(sessionId, `
        SELECT CAST(RDB$PROCEDURE_SOURCE AS VARCHAR(4096)) AS RDB$PROCEDURE_SOURCE,
               CAST(RDB$DESCRIPTION AS VARCHAR(1024)) AS RDB$DESCRIPTION
        FROM RDB$PROCEDURES
        WHERE RDB$PROCEDURE_NAME = ?
      `, [name]);
      const row = result.rows[0];
      const source = row?.['RDB$PROCEDURE_SOURCE'];
      const desc = row?.['RDB$DESCRIPTION'];

      const paramsResult = await queryAsync(sessionId, `
        SELECT
          RDB$PARAMETER_NAME,
          RDB$PARAMETER_TYPE,
          RDB$PARAMETER_NUMBER
        FROM RDB$PROCEDURE_PARAMETERS
        WHERE RDB$PROCEDURE_NAME = ?
        ORDER BY RDB$PARAMETER_TYPE, RDB$PARAMETER_NUMBER
      `, [name]);

      const inputParams = paramsResult.rows
        .filter((p) => p['RDB$PARAMETER_TYPE'] === 0)
        .map((p) => ((p['RDB$PARAMETER_NAME'] as string) ?? '').trim());
      const outputParams = paramsResult.rows
        .filter((p) => p['RDB$PARAMETER_TYPE'] === 1)
        .map((p) => ((p['RDB$PARAMETER_NAME'] as string) ?? '').trim());

      return {
        name,
        source: source ? String(source).trim() : null,
        description: desc ? String(desc).trim() : null,
        inputParams,
        outputParams,
      };
    } catch (err: unknown) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Failed to get procedure details' });
    }
  });

  app.get('/api/triggers', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    try {
      const result = await queryAsync(sessionId, `
        SELECT RDB$TRIGGER_NAME, RDB$RELATION_NAME, RDB$TRIGGER_TYPE, RDB$TRIGGER_INACTIVE
        FROM RDB$TRIGGERS
        WHERE RDB$SYSTEM_FLAG = 0
        ORDER BY RDB$TRIGGER_NAME
      `);
      return result.rows.map((row) => ({
        name: ((row['RDB$TRIGGER_NAME'] as string) ?? '').trim(),
        table: row['RDB$RELATION_NAME'] ? (row['RDB$RELATION_NAME'] as string).trim() : null,
        type: row['RDB$TRIGGER_TYPE'] as number,
        inactive: row['RDB$TRIGGER_INACTIVE'] === 1,
      }));
    } catch (err: unknown) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Failed to list triggers' });
    }
  });

  app.get<{ Params: { name: string } }>('/api/triggers/:name', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    const name = request.params.name.toUpperCase();
    try {
      const result = await queryAsync(sessionId, `
        SELECT CAST(RDB$TRIGGER_SOURCE AS VARCHAR(4096)) AS RDB$TRIGGER_SOURCE,
               RDB$RELATION_NAME, RDB$TRIGGER_TYPE, RDB$TRIGGER_INACTIVE
        FROM RDB$TRIGGERS
        WHERE RDB$TRIGGER_NAME = ?
      `, [name]);
      const row = result.rows[0];
      const source = row?.['RDB$TRIGGER_SOURCE'];
      return {
        name,
        table: row?.['RDB$RELATION_NAME'] ? (row['RDB$RELATION_NAME'] as string).trim() : null,
        type: row?.['RDB$TRIGGER_TYPE'] as number,
        inactive: row?.['RDB$TRIGGER_INACTIVE'] === 1,
        source: source ? String(source).trim() : null,
      };
    } catch (err: unknown) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Failed to get trigger details' });
    }
  });

  app.get('/api/generators', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    try {
      const result = await queryAsync(sessionId, `
        SELECT RDB$GENERATOR_NAME, GEN_ID(RDB$GENERATOR_NAME, 0) AS CURRENT_VALUE
        FROM RDB$GENERATORS
        WHERE RDB$SYSTEM_FLAG = 0
        ORDER BY RDB$GENERATOR_NAME
      `);

      // GEN_ID in a SELECT from RDB$GENERATORS won't work that way, query each separately
      const names = await queryAsync(sessionId, `
        SELECT RDB$GENERATOR_NAME
        FROM RDB$GENERATORS
        WHERE RDB$SYSTEM_FLAG = 0
        ORDER BY RDB$GENERATOR_NAME
      `);

      const generators = [];
      for (const row of names.rows) {
        const genName = ((row['RDB$GENERATOR_NAME'] as string) ?? '').trim();
        try {
          const valResult = await queryAsync(sessionId, `SELECT GEN_ID("${genName}", 0) AS VAL FROM RDB$DATABASE`);
          generators.push({ name: genName, value: valResult.rows[0]?.['VAL'] ?? 0 });
        } catch {
          generators.push({ name: genName, value: null });
        }
      }
      return generators;
    } catch (err: unknown) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Failed to list generators' });
    }
  });

  app.get('/api/domains', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    try {
      const result = await queryAsync(sessionId, `
        SELECT
          f.RDB$FIELD_NAME,
          f.RDB$FIELD_TYPE,
          f.RDB$FIELD_LENGTH,
          f.RDB$NULL_FLAG,
          CAST(f.RDB$DEFAULT_SOURCE AS VARCHAR(1024)) AS RDB$DEFAULT_SOURCE,
          CAST(f.RDB$VALIDATION_SOURCE AS VARCHAR(1024)) AS RDB$VALIDATION_SOURCE
        FROM RDB$FIELDS f
        WHERE f.RDB$SYSTEM_FLAG = 0
          AND f.RDB$FIELD_NAME NOT STARTING WITH 'RDB$'
        ORDER BY f.RDB$FIELD_NAME
      `);

      const { mapFieldType } = await import('../db.js');
      return result.rows.map((row) => ({
        name: ((row['RDB$FIELD_NAME'] as string) ?? '').trim(),
        type: mapFieldType(row['RDB$FIELD_TYPE'] as number),
        length: row['RDB$FIELD_LENGTH'] as number | undefined,
        nullable: row['RDB$NULL_FLAG'] !== 1,
        defaultValue: row['RDB$DEFAULT_SOURCE'] ? String(row['RDB$DEFAULT_SOURCE']).trim() : null,
        check: row['RDB$VALIDATION_SOURCE'] ? String(row['RDB$VALIDATION_SOURCE']).trim() : null,
      }));
    } catch (err: unknown) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Failed to list domains' });
    }
  });

  // ── DDL extraction ───────────────────────────────────────────

  // Procedure DDL
  app.get<{ Params: { name: string } }>('/api/procedures/:name/ddl', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    const name = request.params.name.toUpperCase();
    try {
      const { mapFieldType } = await import('../db.js');

      // Get procedure header
      const procResult = await queryAsync(sessionId, `
        SELECT CAST(RDB$PROCEDURE_SOURCE AS VARCHAR(4096)) AS RDB$PROCEDURE_SOURCE
        FROM RDB$PROCEDURES WHERE RDB$PROCEDURE_NAME = ?
      `, [name]);
      const source = procResult.rows[0]?.['RDB$PROCEDURE_SOURCE']
        ? String(procResult.rows[0]['RDB$PROCEDURE_SOURCE']).trim() : null;

      // Get parameters with types
      const paramsResult = await queryAsync(sessionId, `
        SELECT
          pp.RDB$PARAMETER_NAME,
          pp.RDB$PARAMETER_TYPE,
          pp.RDB$PARAMETER_NUMBER,
          f.RDB$FIELD_TYPE,
          f.RDB$FIELD_SUB_TYPE,
          f.RDB$FIELD_LENGTH,
          f.RDB$FIELD_PRECISION,
          f.RDB$FIELD_SCALE,
          f.RDB$CHARACTER_LENGTH,
          pp.RDB$FIELD_SOURCE,
          pp.RDB$NULL_FLAG
        FROM RDB$PROCEDURE_PARAMETERS pp
        JOIN RDB$FIELDS f ON f.RDB$FIELD_NAME = pp.RDB$FIELD_SOURCE
        WHERE pp.RDB$PROCEDURE_NAME = ?
        ORDER BY pp.RDB$PARAMETER_TYPE, pp.RDB$PARAMETER_NUMBER
      `, [name]);

      const formatParam = (row: Record<string, unknown>): string => {
        const pName = ((row['RDB$PARAMETER_NAME'] as string) ?? '').trim();
        const fieldSource = ((row['RDB$FIELD_SOURCE'] as string) ?? '').trim();
        const isUserDomain = !fieldSource.startsWith('RDB$');

        let typeDef: string;
        if (isUserDomain) {
          typeDef = fieldSource;
        } else {
          const fieldType = row['RDB$FIELD_TYPE'] as number;
          const subType = row['RDB$FIELD_SUB_TYPE'] as number | null;
          const precision = row['RDB$FIELD_PRECISION'] as number | null;
          const scale = row['RDB$FIELD_SCALE'] as number | null;
          const charLen = row['RDB$CHARACTER_LENGTH'] as number | null;
          const fieldLen = row['RDB$FIELD_LENGTH'] as number;

          if ((fieldType === 7 || fieldType === 8 || fieldType === 16) && precision && scale && scale < 0) {
            typeDef = `NUMERIC(${precision}, ${-scale})`;
          } else if (fieldType === 14 || fieldType === 37) {
            typeDef = `${fieldType === 14 ? 'CHAR' : 'VARCHAR'}(${charLen ?? fieldLen})`;
          } else if (fieldType === 261) {
            typeDef = `BLOB SUB_TYPE ${subType ?? 0}`;
          } else {
            typeDef = mapFieldType(fieldType);
          }
        }

        let def = `  "${pName}" ${typeDef}`;
        if (row['RDB$NULL_FLAG'] === 1) def += ' NOT NULL';
        return def;
      };

      const inputParams = paramsResult.rows.filter((r) => r['RDB$PARAMETER_TYPE'] === 0).map(formatParam);
      const outputParams = paramsResult.rows.filter((r) => r['RDB$PARAMETER_TYPE'] === 1).map(formatParam);

      let ddl = `CREATE OR ALTER PROCEDURE "${name}"`;
      if (inputParams.length > 0) ddl += ` (\n${inputParams.join(',\n')}\n)`;
      if (outputParams.length > 0) ddl += `\nRETURNS (\n${outputParams.join(',\n')}\n)`;
      ddl += '\nAS';
      ddl += source ? `\n${source}` : '\nBEGIN\n  SUSPEND;\nEND';

      return { ddl };
    } catch (err: unknown) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : 'Failed' });
    }
  });

  // Trigger DDL
  app.get<{ Params: { name: string } }>('/api/triggers/:name/ddl', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    const name = request.params.name.toUpperCase();
    try {
      const result = await queryAsync(sessionId, `
        SELECT
          CAST(RDB$TRIGGER_SOURCE AS VARCHAR(4096)) AS RDB$TRIGGER_SOURCE,
          RDB$RELATION_NAME,
          RDB$TRIGGER_TYPE,
          RDB$TRIGGER_INACTIVE,
          RDB$TRIGGER_SEQUENCE
        FROM RDB$TRIGGERS WHERE RDB$TRIGGER_NAME = ?
      `, [name]);
      const row = result.rows[0];
      if (!row) return reply.status(404).send({ error: 'Trigger not found' });

      const source = row['RDB$TRIGGER_SOURCE'] ? String(row['RDB$TRIGGER_SOURCE']).trim() : null;
      const table = row['RDB$RELATION_NAME'] ? ((row['RDB$RELATION_NAME'] as string) ?? '').trim() : null;
      const type = row['RDB$TRIGGER_TYPE'] as number;
      const inactive = row['RDB$TRIGGER_INACTIVE'] === 1;
      const sequence = row['RDB$TRIGGER_SEQUENCE'] as number | null;

      // Decode trigger type
      const phase = type % 2 === 1 ? 'BEFORE' : 'AFTER';
      const eventCode = Math.ceil(type / 2);
      const events = ['INSERT', 'UPDATE', 'DELETE'];
      const event = events[eventCode - 1] ?? `/* TYPE ${type} */`;

      let ddl = `CREATE OR ALTER TRIGGER "${name}"`;
      if (table) ddl += ` FOR "${table}"`;
      ddl += `\n${inactive ? 'INACTIVE' : 'ACTIVE'} ${phase} ${event}`;
      if (sequence && sequence > 0) ddl += ` POSITION ${sequence}`;
      ddl += source ? `\n${source}` : '\nAS\nBEGIN\nEND';

      return { ddl };
    } catch (err: unknown) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : 'Failed' });
    }
  });

  // Domain DDL
  app.get<{ Params: { name: string } }>('/api/domains/:name/ddl', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    const name = request.params.name.toUpperCase();
    try {
      const { mapFieldType } = await import('../db.js');
      const result = await queryAsync(sessionId, `
        SELECT
          f.RDB$FIELD_TYPE,
          f.RDB$FIELD_SUB_TYPE,
          f.RDB$FIELD_LENGTH,
          f.RDB$FIELD_PRECISION,
          f.RDB$FIELD_SCALE,
          f.RDB$CHARACTER_LENGTH,
          f.RDB$NULL_FLAG,
          CAST(f.RDB$DEFAULT_SOURCE AS VARCHAR(1024)) AS RDB$DEFAULT_SOURCE,
          CAST(f.RDB$VALIDATION_SOURCE AS VARCHAR(1024)) AS RDB$VALIDATION_SOURCE
        FROM RDB$FIELDS f
        WHERE f.RDB$FIELD_NAME = ?
      `, [name]);
      const row = result.rows[0];
      if (!row) return reply.status(404).send({ error: 'Domain not found' });

      const fieldType = row['RDB$FIELD_TYPE'] as number;
      const subType = row['RDB$FIELD_SUB_TYPE'] as number | null;
      const precision = row['RDB$FIELD_PRECISION'] as number | null;
      const scale = row['RDB$FIELD_SCALE'] as number | null;
      const charLen = row['RDB$CHARACTER_LENGTH'] as number | null;
      const fieldLen = row['RDB$FIELD_LENGTH'] as number;

      let typeDef: string;
      if ((fieldType === 7 || fieldType === 8 || fieldType === 16) && precision && scale && scale < 0) {
        typeDef = `NUMERIC(${precision}, ${-scale})`;
      } else if (fieldType === 14 || fieldType === 37) {
        typeDef = `${fieldType === 14 ? 'CHAR' : 'VARCHAR'}(${charLen ?? fieldLen})`;
      } else if (fieldType === 261) {
        typeDef = `BLOB SUB_TYPE ${subType ?? 0}`;
      } else {
        typeDef = mapFieldType(fieldType);
      }

      let ddl = `CREATE DOMAIN "${name}" AS ${typeDef}`;
      const defaultSource = row['RDB$DEFAULT_SOURCE'] ? String(row['RDB$DEFAULT_SOURCE']).trim() : null;
      if (defaultSource) ddl += `\n  ${defaultSource}`;
      if (row['RDB$NULL_FLAG'] === 1) ddl += '\n  NOT NULL';
      const check = row['RDB$VALIDATION_SOURCE'] ? String(row['RDB$VALIDATION_SOURCE']).trim() : null;
      if (check) ddl += `\n  ${check}`;
      ddl += ';';

      return { ddl };
    } catch (err: unknown) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : 'Failed' });
    }
  });

  // Generator DDL
  app.get<{ Params: { name: string } }>('/api/generators/:name/ddl', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    const name = request.params.name.toUpperCase();
    try {
      const valResult = await queryAsync(sessionId, `SELECT GEN_ID("${name}", 0) AS VAL FROM RDB$DATABASE`);
      const value = valResult.rows[0]?.['VAL'] as number ?? 0;

      let ddl = `CREATE SEQUENCE "${name}";`;
      if (value !== 0) {
        ddl += `\nALTER SEQUENCE "${name}" RESTART WITH ${value};`;
      }

      return { ddl };
    } catch (err: unknown) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : 'Failed' });
    }
  });

  // ── DDL mutations ─────────────────────────────────────────────

  // Views: create/alter, drop
  app.post<{ Body: { name: string; source: string } }>('/api/views', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    const { name, source } = request.body as { name: string; source: string };
    if (!name || !source) return reply.status(400).send({ error: 'name and source required' });
    try {
      const _sql = `CREATE OR ALTER VIEW "${name.toUpperCase()}" AS ${source}`;
      const _start = performance.now();
      await queryAsync(sessionId, _sql);
      const _duration = Math.round(performance.now() - _start);
      return { ok: true, sql: _sql, duration: _duration };
    } catch (err: unknown) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : 'Failed' });
    }
  });

  app.delete<{ Params: { name: string } }>('/api/views/:name', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    try {
      const _sql = `DROP VIEW "${request.params.name.toUpperCase()}"`;
      const _start = performance.now();
      await queryAsync(sessionId, _sql);
      const _duration = Math.round(performance.now() - _start);
      return { ok: true, sql: _sql, duration: _duration };
    } catch (err: unknown) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : 'Failed' });
    }
  });

  // Procedures: create/alter, drop
  app.post<{ Body: { sql: string } }>('/api/procedures', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    const { sql } = request.body as { sql: string };
    if (!sql) return reply.status(400).send({ error: 'sql required' });
    try {
      const _start = performance.now();
      await queryAsync(sessionId, sql);
      const _duration = Math.round(performance.now() - _start);
      return { ok: true, sql, duration: _duration };
    } catch (err: unknown) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : 'Failed' });
    }
  });

  app.delete<{ Params: { name: string } }>('/api/procedures/:name', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    try {
      const _sql = `DROP PROCEDURE "${request.params.name.toUpperCase()}"`;
      const _start = performance.now();
      await queryAsync(sessionId, _sql);
      const _duration = Math.round(performance.now() - _start);
      return { ok: true, sql: _sql, duration: _duration };
    } catch (err: unknown) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : 'Failed' });
    }
  });

  // Triggers: create/alter, toggle active, drop
  app.post<{ Body: { sql: string } }>('/api/triggers', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    const { sql } = request.body as { sql: string };
    if (!sql) return reply.status(400).send({ error: 'sql required' });
    try {
      const _start = performance.now();
      await queryAsync(sessionId, sql);
      const _duration = Math.round(performance.now() - _start);
      return { ok: true, sql, duration: _duration };
    } catch (err: unknown) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : 'Failed' });
    }
  });

  app.put<{ Params: { name: string }; Body: { active?: boolean } }>('/api/triggers/:name/toggle', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    const name = request.params.name.toUpperCase();
    const { active } = request.body as { active?: boolean };
    try {
      const _sql = `ALTER TRIGGER "${name}" ${active ? 'ACTIVE' : 'INACTIVE'}`;
      const _start = performance.now();
      await queryAsync(sessionId, _sql);
      const _duration = Math.round(performance.now() - _start);
      return { ok: true, sql: _sql, duration: _duration };
    } catch (err: unknown) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : 'Failed' });
    }
  });

  app.delete<{ Params: { name: string } }>('/api/triggers/:name', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    try {
      const _sql = `DROP TRIGGER "${request.params.name.toUpperCase()}"`;
      const _start = performance.now();
      await queryAsync(sessionId, _sql);
      const _duration = Math.round(performance.now() - _start);
      return { ok: true, sql: _sql, duration: _duration };
    } catch (err: unknown) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : 'Failed' });
    }
  });

  // Generators: create, set value, drop
  app.post<{ Body: { name: string; initialValue?: number } }>('/api/generators', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    const { name, initialValue } = request.body as { name: string; initialValue?: number };
    if (!name) return reply.status(400).send({ error: 'name required' });
    try {
      const _statements: string[] = [`CREATE SEQUENCE "${name.toUpperCase()}"`];
      if (initialValue !== undefined && initialValue !== 0) {
        _statements.push(`ALTER SEQUENCE "${name.toUpperCase()}" RESTART WITH ${initialValue}`);
      }
      const _start = performance.now();
      for (const _stmt of _statements) {
        await queryAsync(sessionId, _stmt);
      }
      const _duration = Math.round(performance.now() - _start);
      return { ok: true, sql: _statements.join(';\n'), duration: _duration };
    } catch (err: unknown) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : 'Failed' });
    }
  });

  app.put<{ Params: { name: string }; Body: { value: number } }>('/api/generators/:name', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    const name = request.params.name.toUpperCase();
    const { value } = request.body as { value: number };
    try {
      const _sql = `ALTER SEQUENCE "${name}" RESTART WITH ${value}`;
      const _start = performance.now();
      await queryAsync(sessionId, _sql);
      const _duration = Math.round(performance.now() - _start);
      return { ok: true, sql: _sql, duration: _duration };
    } catch (err: unknown) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : 'Failed' });
    }
  });

  app.delete<{ Params: { name: string } }>('/api/generators/:name', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    try {
      const _sql = `DROP SEQUENCE "${request.params.name.toUpperCase()}"`;
      const _start = performance.now();
      await queryAsync(sessionId, _sql);
      const _duration = Math.round(performance.now() - _start);
      return { ok: true, sql: _sql, duration: _duration };
    } catch (err: unknown) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : 'Failed' });
    }
  });

  // Domains: create, alter, drop
  app.post<{ Body: { name: string; type: string; length?: number; nullable?: boolean; defaultValue?: string; check?: string } }>('/api/domains', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    const { name, type, length, nullable, defaultValue, check } = request.body as {
      name: string; type: string; length?: number; nullable?: boolean; defaultValue?: string; check?: string;
    };
    if (!name || !type) return reply.status(400).send({ error: 'name and type required' });
    let typeDef = type.toUpperCase();
    if (length && ['VARCHAR', 'CHAR'].includes(typeDef)) typeDef += `(${length})`;
    let sql = `CREATE DOMAIN "${name.toUpperCase()}" AS ${typeDef}`;
    if (defaultValue) sql += ` DEFAULT ${defaultValue}`;
    if (nullable === false) sql += ' NOT NULL';
    if (check) sql += ` CHECK (${check})`;
    try {
      const _start = performance.now();
      await queryAsync(sessionId, sql);
      const _duration = Math.round(performance.now() - _start);
      return { ok: true, sql, duration: _duration };
    } catch (err: unknown) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : 'Failed' });
    }
  });

  app.delete<{ Params: { name: string } }>('/api/domains/:name', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    try {
      const _sql = `DROP DOMAIN "${request.params.name.toUpperCase()}"`;
      const _start = performance.now();
      await queryAsync(sessionId, _sql);
      const _duration = Math.round(performance.now() - _start);
      return { ok: true, sql: _sql, duration: _duration };
    } catch (err: unknown) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : 'Failed' });
    }
  });
}
