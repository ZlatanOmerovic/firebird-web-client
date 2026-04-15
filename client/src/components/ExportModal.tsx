import { useState } from 'react';
import { Download, X, Loader2, FileSpreadsheet, Braces, Database, FileText, Code, Table2 } from 'lucide-react';
import { Checkbox } from './Checkbox';
import { useSettings } from '../hooks/useSettings';
import { exportRows, type ExportFormat } from '../lib/exportUtils';
import { saveAs } from 'file-saver';

export type ExportScope =
  | { type: 'rows'; tableName: string; columns: string[]; rows: Record<string, unknown>[]; ddl?: string }
  | { type: 'table'; tableName: string; totalRows?: number }
  | { type: 'database' };

interface ExportModalProps {
  scope: ExportScope;
  onClose: () => void;
}

const FORMATS: { key: ExportFormat; label: string; icon: React.ElementType; desc: string }[] = [
  { key: 'csv', label: 'CSV', icon: FileSpreadsheet, desc: 'Spreadsheet compatible' },
  { key: 'json', label: 'JSON', icon: Braces, desc: 'Structured data' },
  { key: 'sql', label: 'SQL', icon: Database, desc: 'INSERT statements' },
  { key: 'xml', label: 'XML', icon: Code, desc: 'Markup format' },
  { key: 'xlsx', label: 'XLSX', icon: Table2, desc: 'Excel workbook' },
];

const DELIMITERS = [
  { value: ',', label: 'Comma (,)' },
  { value: ';', label: 'Semicolon (;)' },
  { value: '\t', label: 'Tab' },
];

function getScopeLabel(scope: ExportScope): string {
  switch (scope.type) {
    case 'rows':
      return `${scope.rows.length.toLocaleString()} rows from ${scope.tableName}`;
    case 'table':
      return `${scope.tableName} table${scope.totalRows ? ` (${scope.totalRows.toLocaleString()} rows)` : ''}`;
    case 'database':
      return 'Full database';
  }
}

export function ExportModal({ scope, onClose }: ExportModalProps) {
  const settings = useSettings();
  const [format, setFormat] = useState<ExportFormat>(settings.defaultExportFormat as ExportFormat);
  const [includeDdl, setIncludeDdl] = useState(settings.exportIncludeDdl ?? false);
  const [delimiter, setDelimiter] = useState<string>(settings.csvDelimiter ?? ',');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setLoading(true);
    setError(null);

    try {
      if (scope.type === 'rows') {
        // Client-side export from in-memory data
        exportRows(format, scope.tableName, scope.columns, scope.rows, {
          includeDdl,
          ddl: scope.ddl,
          delimiter,
        });
        onClose();
        return;
      }

      if (scope.type === 'table' && format === 'xlsx') {
        // XLSX needs client-side building — fetch all data first
        const { getTableRows, getTableSchema, getTableDDL } = await import('../lib/api');
        const schema = await getTableSchema(scope.tableName);
        const columns = schema.map((c) => c.name);

        // Fetch all rows (large page)
        let allRows: Record<string, unknown>[] = [];
        let page = 1;
        const pageSize = 1000;
        while (true) {
          const result = await getTableRows(scope.tableName, page, pageSize);
          allRows.push(...result.rows);
          if (allRows.length >= result.total) break;
          page++;
        }

        let ddl: string | undefined;
        if (includeDdl) {
          const ddlResult = await getTableDDL(scope.tableName);
          ddl = ddlResult.ddl;
        }

        exportRows('xlsx', scope.tableName, columns, allRows, { includeDdl, ddl, delimiter });
        onClose();
        return;
      }

      // Server-side streaming for table/database exports (CSV, JSON, SQL, XML)
      const baseUrl = import.meta.env.VITE_API_URL ?? '/api';
      const { getSessionId } = await import('../lib/api');
      const sessionId = getSessionId();
      if (!sessionId) throw new Error('Session expired. Please reconnect.');
      const params = new URLSearchParams({
        format,
        includeDdl: String(includeDdl),
        delimiter,
      });

      const url = scope.type === 'table'
        ? `${baseUrl}/export/table/${encodeURIComponent(scope.tableName)}?${params}`
        : `${baseUrl}/export/database?${params}`;

      const res = await fetch(url, { headers: { 'x-session-id': sessionId } });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error ?? 'Export failed');
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition');
      const filenameMatch = disposition?.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch?.[1] ?? `export.${format}`;
      saveAs(blob, filename);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-bg-secondary border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <Download className="w-4.5 h-4.5 text-accent" />
            <h3 className="text-sm font-semibold text-text-primary">Export</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Scope */}
          <div>
            <span className="text-[11px] font-medium text-text-tertiary uppercase tracking-wide">Scope</span>
            <p className="text-sm text-text-primary font-medium mt-0.5">{getScopeLabel(scope)}</p>
          </div>

          {/* Format picker */}
          <div>
            <span className="text-[11px] font-medium text-text-tertiary uppercase tracking-wide">Format</span>
            <div className="grid grid-cols-5 gap-1.5 mt-1.5">
              {FORMATS.map((f) => {
                const Icon = f.icon;
                const active = format === f.key;
                return (
                  <button
                    key={f.key}
                    onClick={() => setFormat(f.key)}
                    className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg border text-center transition-all ${
                      active
                        ? 'bg-accent-subtle border-accent/40 text-accent'
                        : 'border-border text-text-secondary hover:text-text-primary hover:border-accent/20'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[11px] font-medium">{f.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3">
            {/* Include DDL */}
            {format === 'sql' && (
              <label className="flex items-center gap-2.5 cursor-pointer">
                <Checkbox checked={includeDdl} onChange={setIncludeDdl} />
                <div>
                  <span className="text-xs font-medium text-text-primary">Include structure (DDL)</span>
                  <p className="text-[10px] text-text-tertiary">Add CREATE TABLE statements before data</p>
                </div>
              </label>
            )}

            {/* CSV delimiter */}
            {format === 'csv' && (
              <div>
                <span className="text-[11px] font-medium text-text-tertiary uppercase tracking-wide">Delimiter</span>
                <div className="flex gap-1.5 mt-1">
                  {DELIMITERS.map((d) => (
                    <button
                      key={d.value}
                      onClick={() => setDelimiter(d.value)}
                      className={`px-3 py-1 text-[11px] rounded-md border transition-colors ${
                        delimiter === d.value
                          ? 'bg-accent text-[#ffffff] border-accent'
                          : 'text-text-secondary border-border hover:border-accent/50'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="px-3 py-2 bg-error-subtle border border-error/20 rounded-lg text-error text-xs">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3 border-t border-border bg-bg-tertiary">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary rounded-lg hover:bg-bg-secondary transition-colors">
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-accent hover:bg-accent-hover text-[#ffffff] rounded-lg transition-colors shadow-sm disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Export
          </button>
        </div>
      </div>
    </div>
  );
}
