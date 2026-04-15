import { FastifyInstance } from 'fastify';
import { queryAsync, getTableSchema, getSession } from '../db.js';

function sqlValue(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  return `'${String(val).replace(/'/g, "''")}'`;
}

function csvValue(val: unknown, delimiter: string): string {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(delimiter) || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildCreateTable(tableName: string, schema: { name: string; type: string; nullable: boolean; primaryKey: boolean; length?: number; defaultValue?: string }[]): string {
  const cols = schema.map((col) => {
    let def = `  "${col.name}" ${col.type}`;
    if (col.length && ['VARCHAR', 'CHAR'].includes(col.type)) def += `(${col.length})`;
    if (col.defaultValue) def += ` ${col.defaultValue}`;
    if (!col.nullable) def += ' NOT NULL';
    return def;
  });
  const pks = schema.filter((c) => c.primaryKey).map((c) => `"${c.name}"`);
  if (pks.length > 0) cols.push(`  PRIMARY KEY (${pks.join(', ')})`);
  return `CREATE TABLE "${tableName}" (\n${cols.join(',\n')}\n);\n`;
}

const MIME: Record<string, string> = {
  csv: 'text/csv',
  json: 'application/json',
  sql: 'application/sql',
  xml: 'application/xml',
};

export async function exportRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    if (!sessionId || !getSession(sessionId)) {
      return reply.status(401).send({ error: 'Invalid or missing session' });
    }
  });

  // Export single table
  app.get<{
    Params: { name: string };
    Querystring: { format?: string; includeDdl?: string; delimiter?: string };
  }>('/api/export/table/:name', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    const tableName = request.params.name.toUpperCase();
    const format = (request.query.format ?? 'csv').toLowerCase();
    const includeDdl = request.query.includeDdl === 'true';
    const delimiter = request.query.delimiter === ';' ? ';' : request.query.delimiter === '\t' ? '\t' : ',';

    if (!['csv', 'json', 'sql', 'xml'].includes(format)) {
      return reply.status(400).send({ error: 'Invalid format. Use csv, json, sql, or xml.' });
    }

    const schema = await getTableSchema(sessionId, tableName);
    const columns = schema.map((c) => c.name);

    // Fetch all rows (no pagination limit)
    const result = await queryAsync(sessionId, `SELECT * FROM "${tableName}"`);
    const rows = result.rows;

    const ext = format === 'sql' ? 'sql' : format;
    const filename = `${tableName}.${ext}`;
    reply.header('Content-Type', MIME[format] + '; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);

    if (format === 'csv') {
      const header = columns.map((c) => csvValue(c, delimiter)).join(delimiter);
      const lines = rows.map((row) => columns.map((c) => csvValue(row[c], delimiter)).join(delimiter));
      return [header, ...lines].join('\n');
    }

    if (format === 'json') {
      const data = rows.map((row) => {
        const obj: Record<string, unknown> = {};
        for (const c of columns) obj[c] = row[c] ?? null;
        return obj;
      });
      return JSON.stringify(data, null, 2);
    }

    if (format === 'sql') {
      let output = `-- Export of ${tableName}\n-- ${new Date().toISOString()}\n\n`;
      if (includeDdl) {
        output += buildCreateTable(tableName, schema);
        output += '\n';
      }
      for (const row of rows) {
        const vals = columns.map((c) => sqlValue(row[c])).join(', ');
        output += `INSERT INTO "${tableName}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${vals});\n`;
      }
      return output;
    }

    if (format === 'xml') {
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += `<table name="${xmlEscape(tableName)}">\n`;
      for (const row of rows) {
        xml += '  <row>\n';
        for (const c of columns) {
          const val = row[c];
          if (val === null || val === undefined) {
            xml += `    <${c} null="true" />\n`;
          } else {
            xml += `    <${c}>${xmlEscape(String(val))}</${c}>\n`;
          }
        }
        xml += '  </row>\n';
      }
      xml += '</table>\n';
      return xml;
    }
  });

  // Export full database
  app.get<{
    Querystring: { format?: string; includeDdl?: string; delimiter?: string };
  }>('/api/export/database', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] as string;
    const format = (request.query.format ?? 'sql').toLowerCase();
    const includeDdl = request.query.includeDdl !== 'false';
    const delimiter = request.query.delimiter === ';' ? ';' : request.query.delimiter === '\t' ? '\t' : ',';

    if (!['csv', 'json', 'sql', 'xml'].includes(format)) {
      return reply.status(400).send({ error: 'Invalid format. Use csv, json, sql, or xml.' });
    }

    // Get all tables
    const tablesResult = await queryAsync(sessionId, `
      SELECT RDB$RELATION_NAME FROM RDB$RELATIONS
      WHERE RDB$SYSTEM_FLAG = 0 AND RDB$VIEW_BLR IS NULL
      ORDER BY RDB$RELATION_NAME
    `);
    const tableNames = tablesResult.rows.map((r) => (r['RDB$RELATION_NAME'] as string).trim());

    // Get views, procedures, triggers, generators, domains DDL
    const viewsResult = await queryAsync(sessionId, `
      SELECT RDB$RELATION_NAME FROM RDB$RELATIONS
      WHERE RDB$SYSTEM_FLAG = 0 AND RDB$VIEW_BLR IS NOT NULL
      ORDER BY RDB$RELATION_NAME
    `);
    const viewNames = viewsResult.rows.map((r) => (r['RDB$RELATION_NAME'] as string).trim());

    const filename = `database_export.${format === 'sql' ? 'sql' : format}`;
    reply.header('Content-Type', MIME[format] + '; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);

    if (format === 'sql') {
      let output = `-- Full database export\n-- ${new Date().toISOString()}\n-- Tables: ${tableNames.length}, Views: ${viewNames.length}\n\n`;

      for (const tName of tableNames) {
        const schema = await getTableSchema(sessionId, tName);
        const columns = schema.map((c) => c.name);

        if (includeDdl) {
          output += buildCreateTable(tName, schema);
          output += '\n';
        }

        const result = await queryAsync(sessionId, `SELECT * FROM "${tName}"`);
        for (const row of result.rows) {
          const vals = columns.map((c) => sqlValue(row[c])).join(', ');
          output += `INSERT INTO "${tName}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${vals});\n`;
        }
        output += '\n';
      }

      // Views DDL
      if (includeDdl && viewNames.length > 0) {
        output += '-- Views\n\n';
        for (const vName of viewNames) {
          try {
            const vResult = await queryAsync(sessionId, `SELECT CAST(RDB$VIEW_SOURCE AS VARCHAR(4096)) AS SRC FROM RDB$RELATIONS WHERE RDB$RELATION_NAME = ?`, [vName]);
            const src = (vResult.rows[0]?.['SRC'] as string)?.trim();
            if (src) output += `CREATE OR ALTER VIEW "${vName}" AS\n${src};\n\n`;
          } catch { /* skip */ }
        }
      }

      return output;
    }

    if (format === 'json') {
      const db: Record<string, unknown> = { exportDate: new Date().toISOString(), tables: {} };
      const tables: Record<string, unknown[]> = {};
      for (const tName of tableNames) {
        const result = await queryAsync(sessionId, `SELECT * FROM "${tName}"`);
        tables[tName] = result.rows;
      }
      db.tables = tables;
      return JSON.stringify(db, null, 2);
    }

    if (format === 'csv') {
      let output = '';
      for (const tName of tableNames) {
        const schema = await getTableSchema(sessionId, tName);
        const columns = schema.map((c) => c.name);
        const result = await queryAsync(sessionId, `SELECT * FROM "${tName}"`);
        output += `# ${tName}\n`;
        output += columns.map((c) => csvValue(c, delimiter)).join(delimiter) + '\n';
        for (const row of result.rows) {
          output += columns.map((c) => csvValue(row[c], delimiter)).join(delimiter) + '\n';
        }
        output += '\n';
      }
      return output;
    }

    if (format === 'xml') {
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<database>\n';
      for (const tName of tableNames) {
        const schema = await getTableSchema(sessionId, tName);
        const columns = schema.map((c) => c.name);
        const result = await queryAsync(sessionId, `SELECT * FROM "${tName}"`);
        xml += `  <table name="${xmlEscape(tName)}">\n`;
        for (const row of result.rows) {
          xml += '    <row>\n';
          for (const c of columns) {
            const val = row[c];
            if (val === null || val === undefined) {
              xml += `      <${c} null="true" />\n`;
            } else {
              xml += `      <${c}>${xmlEscape(String(val))}</${c}>\n`;
            }
          }
          xml += '    </row>\n';
        }
        xml += '  </table>\n';
      }
      xml += '</database>\n';
      return xml;
    }
  });
}
