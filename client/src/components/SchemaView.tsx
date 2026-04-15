import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getTableSchema, addColumn, alterColumn, dropColumn } from '../lib/api';
import type { ColumnDef, AddColumnParams, AlterColumnParams } from '../lib/api';
import { Key, Loader2, Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { Tooltip } from './Tooltip';
import { actionToast, toast } from './Toast';

const FIREBIRD_TYPES = ['SMALLINT', 'INTEGER', 'BIGINT', 'FLOAT', 'DOUBLE PRECISION', 'DATE', 'TIME', 'TIMESTAMP', 'CHAR', 'VARCHAR', 'BLOB'];

interface SchemaViewProps {
  tableName: string;
}

function AddColumnRow({ tableName, onDone }: { tableName: string; onDone: () => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('VARCHAR');
  const [length, setLength] = useState(255);
  const [nullable, setNullable] = useState(true);
  const [defaultValue, setDefaultValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const needsLength = type === 'VARCHAR' || type === 'CHAR';

  const handleSave = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const params: AddColumnParams = {
        columnName: name.trim(),
        type,
        nullable,
      };
      if (needsLength) params.length = length;
      if (defaultValue.trim()) params.defaultValue = defaultValue.trim();
      const result = await addColumn(tableName, params);
      actionToast('Column added', result.sql, result.duration);
      queryClient.invalidateQueries({ queryKey: ['schema', tableName] });
      queryClient.invalidateQueries({ queryKey: ['rows', tableName] });
      queryClient.invalidateQueries({ queryKey: ['ddl', tableName] });
      queryClient.invalidateQueries({ queryKey: ['sidebar'] });
      onDone();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <tr className="border-b border-border bg-accent-subtle/50">
        <td className="px-4 py-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="column_name"
            className="w-full px-2 py-1 bg-bg-primary border border-border rounded text-text-primary font-mono text-[13px] focus:border-accent focus:outline-none"
            autoFocus
          />
        </td>
        <td className="px-4 py-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="px-2 py-1 bg-bg-primary border border-border rounded text-text-primary text-xs focus:border-accent focus:outline-none"
          >
            {FIREBIRD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </td>
        <td className="px-4 py-2">
          {needsLength ? (
            <input
              type="number"
              value={length}
              onChange={(e) => setLength(parseInt(e.target.value, 10) || 0)}
              className="w-20 px-2 py-1 bg-bg-primary border border-border rounded text-text-primary font-mono text-[13px] focus:border-accent focus:outline-none"
            />
          ) : (
            <span className="text-text-tertiary">&mdash;</span>
          )}
        </td>
        <td className="px-4 py-2">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={nullable}
              onChange={(e) => setNullable(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-border text-accent focus:ring-accent/20"
            />
            <span className="text-xs text-text-secondary">NULL</span>
          </label>
        </td>
        <td className="px-4 py-2">
          <input
            type="text"
            value={defaultValue}
            onChange={(e) => setDefaultValue(e.target.value)}
            placeholder="e.g. 'value' or 0"
            className="w-full px-2 py-1 bg-bg-primary border border-border rounded text-text-primary font-mono text-xs focus:border-accent focus:outline-none placeholder:text-text-tertiary"
          />
        </td>
        <td className="px-4 py-2">
          <div className="flex items-center gap-1">
            <button
              onClick={handleSave}
              disabled={loading || !name.trim()}
              className="p-1 rounded text-success hover:bg-success-subtle transition-colors disabled:opacity-40"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            </button>
            <button onClick={onDone} className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      </tr>
      {error && (
        <tr><td colSpan={6} className="px-4 py-2 text-error text-xs bg-error-subtle">{error}</td></tr>
      )}
    </>
  );
}

function EditColumnRow({
  tableName,
  col,
  onDone,
}: {
  tableName: string;
  col: ColumnDef;
  onDone: () => void;
}) {
  const [newName, setNewName] = useState(col.name);
  const [type, setType] = useState(col.type);
  const [length, setLength] = useState(col.length ?? 255);
  const [nullable, setNullable] = useState(col.nullable);
  const [defaultValue, setDefaultValue] = useState(col.defaultValue ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const needsLength = type === 'VARCHAR' || type === 'CHAR';

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: AlterColumnParams = {};
      if (type !== col.type || (needsLength && length !== col.length)) {
        params.type = type;
        if (needsLength) params.length = length;
      }
      if (nullable !== col.nullable) params.nullable = nullable;
      if (newName.trim() && newName.trim().toUpperCase() !== col.name) params.newName = newName.trim();
      if (defaultValue !== (col.defaultValue ?? '')) {
        params.defaultValue = defaultValue.trim() || null;
      }

      if (Object.keys(params).length === 0) {
        onDone();
        return;
      }

      const result = await alterColumn(tableName, col.name, params);
      actionToast('Column altered', result.sql, result.duration);
      queryClient.invalidateQueries({ queryKey: ['schema', tableName] });
      queryClient.invalidateQueries({ queryKey: ['rows', tableName] });
      queryClient.invalidateQueries({ queryKey: ['ddl', tableName] });
      queryClient.invalidateQueries({ queryKey: ['sidebar'] });
      onDone();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <tr className="border-b border-border bg-accent-subtle/50">
        <td className="px-4 py-2">
          <div className="flex items-center gap-2">
            {col.primaryKey && <Key className="w-3.5 h-3.5 text-accent shrink-0" />}
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-2 py-1 bg-bg-primary border border-border rounded text-text-primary font-mono text-[13px] focus:border-accent focus:outline-none"
            />
          </div>
        </td>
        <td className="px-4 py-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="px-2 py-1 bg-bg-primary border border-border rounded text-text-primary text-xs focus:border-accent focus:outline-none"
          >
            {FIREBIRD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </td>
        <td className="px-4 py-2">
          {needsLength ? (
            <input
              type="number"
              value={length}
              onChange={(e) => setLength(parseInt(e.target.value, 10) || 0)}
              className="w-20 px-2 py-1 bg-bg-primary border border-border rounded text-text-primary font-mono text-[13px] focus:border-accent focus:outline-none"
            />
          ) : (
            <span className="text-text-tertiary">&mdash;</span>
          )}
        </td>
        <td className="px-4 py-2">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={nullable}
              onChange={(e) => setNullable(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-border text-accent focus:ring-accent/20"
            />
            <span className="text-xs text-text-secondary">NULL</span>
          </label>
        </td>
        <td className="px-4 py-2">
          <input
            type="text"
            value={defaultValue}
            onChange={(e) => setDefaultValue(e.target.value)}
            placeholder="e.g. 'value' or 0"
            className="w-full px-2 py-1 bg-bg-primary border border-border rounded text-text-primary font-mono text-xs focus:border-accent focus:outline-none placeholder:text-text-tertiary"
          />
        </td>
        <td className="px-4 py-2">
          <div className="flex items-center gap-1">
            <button
              onClick={handleSave}
              disabled={loading}
              className="p-1 rounded text-success hover:bg-success-subtle transition-colors disabled:opacity-40"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            </button>
            <button onClick={onDone} className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      </tr>
      {error && (
        <tr><td colSpan={6} className="px-4 py-2 text-error text-xs bg-error-subtle">{error}</td></tr>
      )}
    </>
  );
}

export function SchemaView({ tableName }: SchemaViewProps) {
  const { data: columns, isLoading } = useQuery({
    queryKey: ['schema', tableName],
    queryFn: () => getTableSchema(tableName),
  });
  const queryClient = useQueryClient();
  const [addingColumn, setAddingColumn] = useState(false);
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [droppingColumn, setDroppingColumn] = useState<string | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);

  const handleDrop = async (colName: string) => {
    setDropError(null);
    try {
      const result = await dropColumn(tableName, colName);
      actionToast('Column dropped', result.sql, result.duration);
      setDroppingColumn(null);
      queryClient.invalidateQueries({ queryKey: ['schema', tableName] });
      queryClient.invalidateQueries({ queryKey: ['rows', tableName] });
      queryClient.invalidateQueries({ queryKey: ['ddl', tableName] });
      queryClient.invalidateQueries({ queryKey: ['sidebar'] });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to drop column', 'error');
      setDropError(err instanceof Error ? err.message : 'Failed to drop column');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-text-tertiary" />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      {dropError && (
        <div className="mx-4 mt-3 px-4 py-2 bg-error-subtle border border-error/20 rounded-lg text-error text-xs">
          {dropError}
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wide">Column</th>
            <th className="px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wide">Type</th>
            <th className="px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wide">Length</th>
            <th className="px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wide">Nullable</th>
            <th className="px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wide">Default</th>
            <th className="px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wide w-24">
              <button
                onClick={() => { setAddingColumn(true); setEditingColumn(null); }}
                className="flex items-center gap-1 text-accent hover:text-accent-hover transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {addingColumn && (
            <AddColumnRow tableName={tableName} onDone={() => setAddingColumn(false)} />
          )}
          {columns?.map((col) =>
            editingColumn === col.name ? (
              <EditColumnRow
                key={col.name}
                tableName={tableName}
                col={col}
                onDone={() => setEditingColumn(null)}
              />
            ) : (
              <tr
                key={col.name}
                className={`border-b border-border-subtle hover:bg-row-hover even:bg-row-alt transition-colors group ${
                  droppingColumn === col.name ? 'bg-error-subtle' : ''
                }`}
              >
                <td className="px-4 py-2.5 text-text-primary font-mono text-[13px] flex items-center gap-2">
                  {col.primaryKey && <Key className="w-3.5 h-3.5 text-accent shrink-0" />}
                  {col.name}
                </td>
                <td className="px-4 py-2.5 font-mono text-[13px]">
                  <span className="px-1.5 py-0.5 rounded bg-accent-subtle text-accent text-xs">
                    {col.type}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-text-secondary font-mono text-[13px]">{col.length ?? '\u2014'}</td>
                <td className="px-4 py-2.5">
                  {col.nullable ? (
                    <span className="text-text-tertiary text-xs">YES</span>
                  ) : (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-error-subtle text-error">NOT NULL</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-text-secondary font-mono text-xs">{col.defaultValue ?? '\u2014'}</td>
                <td className="px-4 py-2.5">
                  {droppingColumn === col.name ? (
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => handleDrop(col.name)} className="text-error text-xs font-medium hover:underline">Drop</button>
                      <button onClick={() => { setDroppingColumn(null); setDropError(null); }} className="text-text-secondary text-xs hover:underline">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Tooltip content="Edit column" placement="top">
                        <button
                          onClick={() => { setEditingColumn(col.name); setAddingColumn(false); }}
                          className="p-1 rounded text-text-tertiary hover:text-accent hover:bg-accent-subtle transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </Tooltip>
                      {!col.primaryKey && (
                        <Tooltip content="Drop column" placement="top">
                          <button
                            onClick={() => { setDroppingColumn(col.name); setDropError(null); }}
                            className="p-1 rounded text-text-tertiary hover:text-error hover:bg-error-subtle transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </Tooltip>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}
