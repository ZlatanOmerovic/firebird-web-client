import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createOrAlterView, createOrAlterProcedure, createOrAlterTrigger, createTable, createGenerator, createDomain } from '../lib/api';
import type { CreateTableColumn } from '../lib/api';
import { Loader2, Check, Plus, Trash2 } from 'lucide-react';
import { FirebirdCodeEditor } from './FirebirdCodeEditor';
import { actionToast, toast } from './Toast';

const FIREBIRD_TYPES = ['SMALLINT', 'INTEGER', 'BIGINT', 'FLOAT', 'DOUBLE PRECISION', 'DATE', 'TIME', 'TIMESTAMP', 'CHAR', 'VARCHAR', 'BLOB'];

const emptyColumn = (): CreateTableColumn => ({ name: '', type: 'INTEGER', nullable: true, primaryKey: false });

export function NewTableModal({ onClose }: { onClose: () => void }) {
  const [tableName, setTableName] = useState('');
  const [columns, setColumns] = useState<CreateTableColumn[]>([
    { name: 'ID', type: 'INTEGER', nullable: false, primaryKey: true },
    emptyColumn(),
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const updateCol = (i: number, patch: Partial<CreateTableColumn>) => {
    setColumns((cols) => cols.map((c, j) => j === i ? { ...c, ...patch } : c));
  };

  const removeCol = (i: number) => setColumns((cols) => cols.filter((_, j) => j !== i));
  const addCol = () => setColumns((cols) => [...cols, emptyColumn()]);

  const handleCreate = async () => {
    if (!tableName.trim() || columns.every((c) => !c.name.trim())) return;
    setLoading(true); setError(null);
    try {
      const validCols = columns.filter((c) => c.name.trim());
      const result = await createTable(tableName.trim(), validCols);
      actionToast('Table created', result.sql, result.duration);
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar'] });
      onClose();
    } catch (err) { toast(err instanceof Error ? err.message : 'Failed', 'error'); setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setLoading(false); }
  };

  const needsLength = (type: string) => type === 'VARCHAR' || type === 'CHAR';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-bg-secondary border border-border rounded-xl shadow-2xl w-full max-w-3xl mx-4 p-6 space-y-5 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-text-primary">New Table</h2>
        {error && <div className="px-4 py-3 bg-error-subtle border border-error/20 rounded-lg text-error text-sm">{error}</div>}

        <div>
          <label className="block text-[11px] font-medium text-text-secondary mb-1 uppercase tracking-wide">Table Name</label>
          <input type="text" value={tableName} onChange={(e) => setTableName(e.target.value)} placeholder="MY_TABLE" autoFocus className="w-full max-w-xs px-3 py-2 bg-bg-primary border border-border rounded-lg text-text-primary font-mono text-sm focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none" />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-[11px] font-medium text-text-secondary uppercase tracking-wide">Columns</label>
            <button onClick={addCol} className="flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors">
              <Plus className="w-3.5 h-3.5" />Add Column
            </button>
          </div>

          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg-tertiary border-b border-border text-left">
                  <th className="px-3 py-2 text-[11px] font-medium text-text-secondary uppercase tracking-wide">Name</th>
                  <th className="px-3 py-2 text-[11px] font-medium text-text-secondary uppercase tracking-wide">Type</th>
                  <th className="px-3 py-2 text-[11px] font-medium text-text-secondary uppercase tracking-wide w-20">Length</th>
                  <th className="px-3 py-2 text-[11px] font-medium text-text-secondary uppercase tracking-wide w-14">PK</th>
                  <th className="px-3 py-2 text-[11px] font-medium text-text-secondary uppercase tracking-wide w-16">Null</th>
                  <th className="px-3 py-2 text-[11px] font-medium text-text-secondary uppercase tracking-wide">Default</th>
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {columns.map((col, i) => (
                  <tr key={i} className="border-b border-border-subtle last:border-b-0">
                    <td className="px-3 py-1.5">
                      <input type="text" value={col.name} onChange={(e) => updateCol(i, { name: e.target.value })} placeholder="COLUMN_NAME" className="w-full px-2 py-1 bg-bg-primary border border-border rounded text-text-primary font-mono text-[13px] focus:border-accent focus:outline-none" />
                    </td>
                    <td className="px-3 py-1.5">
                      <select value={col.type} onChange={(e) => updateCol(i, { type: e.target.value })} className="px-2 py-1 bg-bg-primary border border-border rounded text-text-primary text-xs focus:border-accent focus:outline-none">
                        {FIREBIRD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      {needsLength(col.type) ? (
                        <input type="number" value={col.length ?? 255} onChange={(e) => updateCol(i, { length: parseInt(e.target.value, 10) || 0 })} className="w-full px-2 py-1 bg-bg-primary border border-border rounded text-text-primary font-mono text-[13px] focus:border-accent focus:outline-none" />
                      ) : <span className="text-text-tertiary text-xs">&mdash;</span>}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <input type="checkbox" checked={col.primaryKey ?? false} onChange={(e) => updateCol(i, { primaryKey: e.target.checked, nullable: e.target.checked ? false : col.nullable })} className="w-3.5 h-3.5 rounded border-border text-accent focus:ring-accent/20" />
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <input type="checkbox" checked={col.nullable ?? true} disabled={col.primaryKey} onChange={(e) => updateCol(i, { nullable: e.target.checked })} className="w-3.5 h-3.5 rounded border-border text-accent focus:ring-accent/20 disabled:opacity-30" />
                    </td>
                    <td className="px-3 py-1.5">
                      <input type="text" value={col.defaultValue ?? ''} onChange={(e) => updateCol(i, { defaultValue: e.target.value })} placeholder="e.g. 0" className="w-full px-2 py-1 bg-bg-primary border border-border rounded text-text-primary font-mono text-xs focus:border-accent focus:outline-none placeholder:text-text-tertiary" />
                    </td>
                    <td className="px-3 py-1.5">
                      {columns.length > 1 && (
                        <button onClick={() => removeCol(i)} className="p-1 rounded text-text-tertiary hover:text-error hover:bg-error-subtle transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary rounded-lg hover:bg-bg-tertiary transition-colors">
            Cancel
          </button>
          <button onClick={handleCreate} disabled={loading || !tableName.trim() || columns.every((c) => !c.name.trim())} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-accent hover:bg-accent-hover text-text-inverted rounded-lg disabled:opacity-50 transition-colors shadow-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Create Table
          </button>
        </div>
      </div>
    </div>
  );
}

export function NewViewModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const handleCreate = async () => {
    if (!name.trim() || !source.trim()) return;
    setLoading(true); setError(null);
    try {
      const result = await createOrAlterView(name.trim(), source);
      actionToast('View created', result.sql, result.duration);
      queryClient.invalidateQueries({ queryKey: ['views'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar'] });
      onClose();
    } catch (err) { toast(err instanceof Error ? err.message : 'Failed', 'error'); setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-bg-secondary border border-border rounded-xl shadow-2xl w-full max-w-2xl mx-4 p-6 space-y-5 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-text-primary">New View</h2>
        {error && <div className="px-4 py-3 bg-error-subtle border border-error/20 rounded-lg text-error text-sm">{error}</div>}
        <div>
          <label className="block text-[11px] font-medium text-text-secondary mb-1 uppercase tracking-wide">View Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="MY_VIEW" autoFocus className="w-full max-w-xs px-3 py-2 bg-bg-primary border border-border rounded-lg text-text-primary font-mono text-sm focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none" />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-text-secondary mb-1 uppercase tracking-wide">SELECT Statement</label>
          <FirebirdCodeEditor value={source} onChange={setSource} height="200px" />
        </div>
        <div className="flex items-center justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary rounded-lg hover:bg-bg-tertiary transition-colors">
            Cancel
          </button>
          <button onClick={handleCreate} disabled={loading || !name.trim() || !source.trim()} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-accent hover:bg-accent-hover text-text-inverted rounded-lg disabled:opacity-50 transition-colors shadow-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Create View
          </button>
        </div>
      </div>
    </div>
  );
}

export function NewProcedureModal({ onClose }: { onClose: () => void }) {
  const [sql, setSql] = useState(`CREATE OR ALTER PROCEDURE "MY_PROCEDURE" (
  PARAM1 INTEGER
)
RETURNS (
  RESULT INTEGER
)
AS
BEGIN
  RESULT = PARAM1 * 2;
  SUSPEND;
END`);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const handleCreate = async () => {
    if (!sql.trim()) return;
    setLoading(true); setError(null);
    try {
      const result = await createOrAlterProcedure(sql);
      actionToast('Procedure created', result.sql, result.duration);
      queryClient.invalidateQueries({ queryKey: ['procedures'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar'] });
      onClose();
    } catch (err) { toast(err instanceof Error ? err.message : 'Failed', 'error'); setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-bg-secondary border border-border rounded-xl shadow-2xl w-full max-w-2xl mx-4 p-6 space-y-5 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-text-primary">New Procedure</h2>
        {error && <div className="px-4 py-3 bg-error-subtle border border-error/20 rounded-lg text-error text-sm">{error}</div>}
        <div>
          <label className="block text-[11px] font-medium text-text-secondary mb-1 uppercase tracking-wide">Full SQL</label>
          <FirebirdCodeEditor value={sql} onChange={setSql} height="320px" />
        </div>
        <div className="flex items-center justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary rounded-lg hover:bg-bg-tertiary transition-colors">
            Cancel
          </button>
          <button onClick={handleCreate} disabled={loading || !sql.trim()} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-accent hover:bg-accent-hover text-text-inverted rounded-lg disabled:opacity-50 transition-colors shadow-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Create Procedure
          </button>
        </div>
      </div>
    </div>
  );
}

export function NewTriggerModal({ onClose }: { onClose: () => void }) {
  const [sql, setSql] = useState(`CREATE OR ALTER TRIGGER "MY_TRIGGER" FOR "TABLE_NAME"
BEFORE INSERT
AS
BEGIN
  /* trigger body */
END`);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const handleCreate = async () => {
    if (!sql.trim()) return;
    setLoading(true); setError(null);
    try {
      const result = await createOrAlterTrigger(sql);
      actionToast('Trigger created', result.sql, result.duration);
      queryClient.invalidateQueries({ queryKey: ['triggers'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar'] });
      onClose();
    } catch (err) { toast(err instanceof Error ? err.message : 'Failed', 'error'); setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-bg-secondary border border-border rounded-xl shadow-2xl w-full max-w-2xl mx-4 p-6 space-y-5 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-text-primary">New Trigger</h2>
        {error && <div className="px-4 py-3 bg-error-subtle border border-error/20 rounded-lg text-error text-sm">{error}</div>}
        <div>
          <label className="block text-[11px] font-medium text-text-secondary mb-1 uppercase tracking-wide">Full SQL</label>
          <FirebirdCodeEditor value={sql} onChange={setSql} height="280px" />
        </div>
        <div className="flex items-center justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary rounded-lg hover:bg-bg-tertiary transition-colors">
            Cancel
          </button>
          <button onClick={handleCreate} disabled={loading || !sql.trim()} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-accent hover:bg-accent-hover text-text-inverted rounded-lg disabled:opacity-50 transition-colors shadow-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Create Trigger
          </button>
        </div>
      </div>
    </div>
  );
}

export function NewGeneratorModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [initialValue, setInitialValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true); setError(null);
    try {
      const result = await createGenerator(name.trim(), initialValue || undefined);
      actionToast('Generator created', result.sql, result.duration);
      queryClient.invalidateQueries({ queryKey: ['sidebar'] });
      queryClient.invalidateQueries({ queryKey: ['generators'] });
      onClose();
    } catch (err) { toast(err instanceof Error ? err.message : 'Failed', 'error'); setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-bg-secondary border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-text-primary">New Generator (Sequence)</h2>
        {error && <div className="px-4 py-3 bg-error-subtle border border-error/20 rounded-lg text-error text-sm">{error}</div>}
        <div>
          <label className="block text-[11px] font-medium text-text-secondary mb-1 uppercase tracking-wide">Generator Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="MY_SEQUENCE" autoFocus className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-text-primary font-mono text-sm focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none" />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-text-secondary mb-1 uppercase tracking-wide">Initial Value</label>
          <input type="number" value={initialValue} onChange={(e) => setInitialValue(parseInt(e.target.value, 10) || 0)} className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-text-primary font-mono text-sm focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none" />
        </div>
        <div className="flex items-center justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary rounded-lg hover:bg-bg-tertiary transition-colors">
            Cancel
          </button>
          <button onClick={handleCreate} disabled={loading || !name.trim()} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-accent hover:bg-accent-hover text-text-inverted rounded-lg disabled:opacity-50 transition-colors shadow-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Create Generator
          </button>
        </div>
      </div>
    </div>
  );
}

const DOMAIN_TYPES = ['SMALLINT', 'INTEGER', 'BIGINT', 'FLOAT', 'DOUBLE PRECISION', 'DATE', 'TIME', 'TIMESTAMP', 'CHAR', 'VARCHAR', 'BLOB'];

export function NewDomainModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ name: '', type: 'VARCHAR', length: 255, nullable: true, defaultValue: '', check: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const needsLength = form.type === 'VARCHAR' || form.type === 'CHAR';

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setLoading(true); setError(null);
    try {
      const result = await createDomain({
        name: form.name.trim(),
        type: form.type,
        length: needsLength ? form.length : undefined,
        nullable: form.nullable,
        defaultValue: form.defaultValue.trim() || undefined,
        check: form.check.trim() || undefined,
      });
      actionToast('Domain created', result.sql, result.duration);
      queryClient.invalidateQueries({ queryKey: ['sidebar'] });
      queryClient.invalidateQueries({ queryKey: ['domains'] });
      onClose();
    } catch (err) { toast(err instanceof Error ? err.message : 'Failed', 'error'); setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-bg-secondary border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-text-primary">New Domain</h2>
        {error && <div className="px-4 py-3 bg-error-subtle border border-error/20 rounded-lg text-error text-sm">{error}</div>}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-medium text-text-secondary mb-1 uppercase tracking-wide">Domain Name</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="MY_DOMAIN" autoFocus className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-text-primary font-mono text-sm focus:border-accent focus:outline-none" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-text-secondary mb-1 uppercase tracking-wide">Type</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-text-primary text-sm focus:border-accent focus:outline-none">
              {DOMAIN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        {needsLength && (
          <div>
            <label className="block text-[11px] font-medium text-text-secondary mb-1 uppercase tracking-wide">Length</label>
            <input type="number" value={form.length} onChange={(e) => setForm({ ...form, length: parseInt(e.target.value, 10) || 0 })} className="w-full max-w-[120px] px-3 py-2 bg-bg-primary border border-border rounded-lg text-text-primary font-mono text-sm focus:border-accent focus:outline-none" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-medium text-text-secondary mb-1 uppercase tracking-wide">Default Value</label>
            <input type="text" value={form.defaultValue} onChange={(e) => setForm({ ...form, defaultValue: e.target.value })} placeholder="e.g. 0 or 'text'" className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-text-primary font-mono text-sm focus:border-accent focus:outline-none placeholder:text-text-tertiary" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-text-secondary mb-1 uppercase tracking-wide">Check Constraint</label>
            <input type="text" value={form.check} onChange={(e) => setForm({ ...form, check: e.target.value })} placeholder="e.g. VALUE > 0" className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-text-primary font-mono text-sm focus:border-accent focus:outline-none placeholder:text-text-tertiary" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-text-secondary">
          <input type="checkbox" checked={form.nullable} onChange={(e) => setForm({ ...form, nullable: e.target.checked })} className="w-3.5 h-3.5 rounded border-border text-accent" />
          Nullable
        </label>
        <div className="flex items-center justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary rounded-lg hover:bg-bg-tertiary transition-colors">
            Cancel
          </button>
          <button onClick={handleCreate} disabled={loading || !form.name.trim()} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-accent hover:bg-accent-hover text-text-inverted rounded-lg disabled:opacity-50 transition-colors shadow-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Create Domain
          </button>
        </div>
      </div>
    </div>
  );
}
