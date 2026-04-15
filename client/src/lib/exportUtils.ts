import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// ── Value formatters ───────────────────────────────────────────

function sqlVal(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  return `'${String(val).replace(/'/g, "''")}'`;
}

function csvVal(val: unknown, delimiter: string): string {
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

// ── Export builders ────────────────────────────────────────────

export function exportToCsv(columns: string[], rows: Record<string, unknown>[], delimiter = ','): string {
  const header = columns.map((c) => csvVal(c, delimiter)).join(delimiter);
  const lines = rows.map((row) => columns.map((c) => csvVal(row[c], delimiter)).join(delimiter));
  return [header, ...lines].join('\n');
}

export function exportToJson(columns: string[], rows: Record<string, unknown>[]): string {
  const data = rows.map((row) => {
    const obj: Record<string, unknown> = {};
    for (const c of columns) obj[c] = row[c] ?? null;
    return obj;
  });
  return JSON.stringify(data, null, 2);
}

export function exportToSql(
  tableName: string,
  columns: string[],
  rows: Record<string, unknown>[],
  includeDdl?: boolean,
  ddl?: string,
): string {
  let output = `-- Export of ${tableName}\n-- ${new Date().toISOString()}\n-- ${rows.length} rows\n\n`;
  if (includeDdl && ddl) {
    output += ddl + ';\n\n';
  }
  for (const row of rows) {
    const vals = columns.map((c) => sqlVal(row[c])).join(', ');
    output += `INSERT INTO "${tableName}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${vals});\n`;
  }
  return output;
}

export function exportToXml(tableName: string, columns: string[], rows: Record<string, unknown>[]): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += `<table name="${xmlEscape(tableName)}" rows="${rows.length}">\n`;
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

export function exportToXlsx(tableName: string, columns: string[], rows: Record<string, unknown>[]): Blob {
  const data = rows.map((row) => {
    const obj: Record<string, unknown> = {};
    for (const c of columns) obj[c] = row[c] ?? null;
    return obj;
  });
  const ws = XLSX.utils.json_to_sheet(data, { header: columns });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, tableName.slice(0, 31)); // sheet name max 31 chars
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ── Download helpers ───────────────────────────────────────────

export function downloadText(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType + '; charset=utf-8' });
  saveAs(blob, filename);
}

export function downloadBlob(blob: Blob, filename: string): void {
  saveAs(blob, filename);
}

export type ExportFormat = 'csv' | 'json' | 'sql' | 'xml' | 'xlsx';

const MIME_MAP: Record<ExportFormat, string> = {
  csv: 'text/csv',
  json: 'application/json',
  sql: 'application/sql',
  xml: 'application/xml',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export function exportRows(
  format: ExportFormat,
  tableName: string,
  columns: string[],
  rows: Record<string, unknown>[],
  options?: { includeDdl?: boolean; ddl?: string; delimiter?: string },
): void {
  const ext = format;
  const filename = `${tableName}.${ext}`;

  if (format === 'xlsx') {
    downloadBlob(exportToXlsx(tableName, columns, rows), filename);
    return;
  }

  let content: string;
  switch (format) {
    case 'csv':
      content = exportToCsv(columns, rows, options?.delimiter ?? ',');
      break;
    case 'json':
      content = exportToJson(columns, rows);
      break;
    case 'sql':
      content = exportToSql(tableName, columns, rows, options?.includeDdl, options?.ddl);
      break;
    case 'xml':
      content = exportToXml(tableName, columns, rows);
      break;
  }

  downloadText(content, filename, MIME_MAP[format]);
}
