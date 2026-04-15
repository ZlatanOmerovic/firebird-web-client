import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { insertRow, updateRow } from '../lib/api';
import type { ColumnDef } from '../lib/api';
import { actionToast, toast } from './Toast';
import { X, Loader2 } from 'lucide-react';

interface RowEditorProps {
  tableName: string;
  columns: ColumnDef[];
  row: Record<string, unknown> | null;
  onClose: () => void;
}

function getInputType(type: string): string {
  switch (type) {
    case 'SMALLINT':
    case 'INTEGER':
    case 'BIGINT':
    case 'FLOAT':
    case 'DOUBLE PRECISION':
      return 'number';
    case 'DATE':
      return 'date';
    case 'TIME':
      return 'time';
    case 'TIMESTAMP':
      return 'datetime-local';
    default:
      return 'text';
  }
}

export function RowEditor({ tableName, columns, row, onClose }: RowEditorProps) {
  const isEdit = row !== null;
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [values, setValues] = useState<Record<string, unknown>>(() => {
    if (row) return { ...row };
    const init: Record<string, unknown> = {};
    for (const col of columns) {
      init[col.name] = null;
    }
    return init;
  });

  const [nullFlags, setNullFlags] = useState<Record<string, boolean>>(() => {
    const flags: Record<string, boolean> = {};
    for (const col of columns) {
      if (row) {
        // Edit mode: null if the value is null
        flags[col.name] = row[col.name] === null;
      } else {
        // Insert mode: only default to null if nullable, otherwise start enabled
        flags[col.name] = col.nullable;
      }
    }
    return flags;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const submitValues: Record<string, unknown> = {};
      for (const col of columns) {
        if (isEdit && col.primaryKey) continue;
        submitValues[col.name] = nullFlags[col.name] ? null : values[col.name];
      }

      if (isEdit) {
        const pkCol = columns.find((c) => c.primaryKey);
        if (!pkCol) throw new Error('No primary key found');
        const result = await updateRow(tableName, String(row[pkCol.name]), submitValues);
        actionToast(`Updated row in ${tableName}`, result.sql, result.duration);
      } else {
        const insertValues: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(submitValues)) {
          if (!nullFlags[key]) {
            insertValues[key] = val;
          }
        }
        const result = await insertRow(tableName, insertValues);
        actionToast(`Inserted row into ${tableName}`, result.sql, result.duration);
      }

      queryClient.invalidateQueries({ queryKey: ['rows', tableName] });
      queryClient.invalidateQueries({ queryKey: ['rows-infinite', tableName] });
      queryClient.invalidateQueries({ queryKey: ['sidebar'] });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Operation failed';
      setError(msg);
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-overlay flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[80vh] bg-bg-primary border border-border rounded-2xl overflow-hidden flex flex-col shadow-[0_8px_32px_var(--color-shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">
              {isEdit ? 'Edit Row' : 'Insert Row'}
            </h2>
            <p className="text-xs text-text-secondary mt-0.5 font-mono">{tableName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mt-4 px-4 py-3 bg-error-subtle border border-error/20 rounded-lg text-error text-sm">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {columns.map((col) => {
            const isBlob = col.type === 'BLOB';
            const inputType = getInputType(col.type);
            const isPkEdit = isEdit && col.primaryKey;

            return (
              <div key={col.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-text-secondary">
                    <span className="font-mono">{col.name}</span>
                    <span className="ml-1.5 text-text-tertiary font-normal">({col.type})</span>
                    {col.primaryKey && (
                      <span className="ml-1.5 text-xs px-1 py-0.5 rounded bg-accent-subtle text-accent">PK</span>
                    )}
                  </label>
                  {col.nullable && !isPkEdit && (
                    <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={nullFlags[col.name]}
                        onChange={(e) =>
                          setNullFlags((f) => ({ ...f, [col.name]: e.target.checked }))
                        }
                        className="w-3.5 h-3.5 rounded border-border text-accent focus:ring-accent/20"
                      />
                      NULL
                    </label>
                  )}
                </div>

                {isBlob ? (
                  <textarea
                    value={nullFlags[col.name] ? '' : String(values[col.name] ?? '')}
                    onChange={(e) => {
                      setValues((v) => ({ ...v, [col.name]: e.target.value }));
                      setNullFlags((f) => ({ ...f, [col.name]: false }));
                    }}
                    disabled={isPkEdit || nullFlags[col.name]}
                    rows={3}
                    className="w-full px-3 py-2.5 bg-bg-secondary border border-border rounded-lg text-text-primary font-mono text-sm focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed resize-y transition-colors"
                  />
                ) : (
                  <input
                    type={inputType}
                    value={nullFlags[col.name] ? '' : String(values[col.name] ?? '')}
                    onChange={(e) => {
                      const val = inputType === 'number' ? Number(e.target.value) : e.target.value;
                      setValues((v) => ({ ...v, [col.name]: val }));
                      setNullFlags((f) => ({ ...f, [col.name]: false }));
                    }}
                    disabled={isPkEdit || nullFlags[col.name]}
                    readOnly={isPkEdit}
                    maxLength={col.type === 'VARCHAR' || col.type === 'CHAR' ? col.length : undefined}
                    className="w-full px-3 py-2.5 bg-bg-secondary border border-border rounded-lg text-text-primary font-mono text-sm focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed read-only:opacity-60 transition-colors"
                  />
                )}
              </div>
            );
          })}
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-2.5 px-5 py-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium border border-border text-text-secondary rounded-lg hover:bg-bg-tertiary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium bg-accent hover:bg-accent-hover text-text-inverted rounded-lg disabled:opacity-50 flex items-center gap-1.5 transition-colors shadow-sm"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isEdit ? 'Update' : 'Insert'}
          </button>
        </div>
      </div>
    </div>
  );
}
