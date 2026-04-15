import { useState, useRef, useEffect, useLayoutEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, X } from 'lucide-react';
import { Tooltip } from './Tooltip';
import { Checkbox } from './Checkbox';
import { isMac } from '../hooks/useSettings';

function getInputType(type: string): 'number' | 'date' | 'time' | 'datetime-local' | 'text' {
  switch (type.toUpperCase()) {
    case 'SMALLINT': case 'INTEGER': case 'BIGINT':
    case 'FLOAT': case 'DOUBLE PRECISION':
    case 'NUMERIC': case 'DECIMAL': case 'INT64':
      return 'number';
    case 'DATE': return 'date';
    case 'TIME': return 'time';
    case 'TIMESTAMP': return 'datetime-local';
    default: return 'text';
  }
}

function toInputValue(value: unknown, inputType: string): string {
  if (value === null || value === undefined) return '';
  if (inputType === 'date' && typeof value === 'string') {
    const m = value.match(/(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : value;
  }
  if (inputType === 'datetime-local' && typeof value === 'string') {
    const m = value.match(/(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
    return m ? `${m[1]}T${m[2]}` : value;
  }
  if (inputType === 'time' && typeof value === 'string') {
    const m = value.match(/(\d{2}:\d{2}(:\d{2})?)/);
    return m ? m[1] : value;
  }
  return String(value);
}

function parseValue(raw: string, sqlType: string): unknown {
  if (raw === '') return null;
  const upper = sqlType.toUpperCase();
  if (['SMALLINT', 'INTEGER', 'BIGINT'].includes(upper)) {
    const n = parseInt(raw, 10); return isNaN(n) ? raw : n;
  }
  if (['FLOAT', 'DOUBLE PRECISION', 'NUMERIC', 'DECIMAL', 'INT64'].includes(upper)) {
    const n = parseFloat(raw); return isNaN(n) ? raw : n;
  }
  return raw;
}

const MOD_LABEL = isMac ? '⌘' : 'Ctrl';

function isBoolean(type: string): boolean {
  return type.toUpperCase() === 'BOOLEAN';
}

// ── Toolbar (portaled) ─────────────────────────────────────────

function EditToolbar({
  pos,
  saving,
  nullable,
  hasDefault,
  isNull,
  isDefault,
  error,
  onSave,
  onCancel,
  onToggleNull,
  onToggleDefault,
}: {
  pos: { top: number; left: number };
  saving: boolean;
  nullable: boolean;
  hasDefault: boolean;
  isNull: boolean;
  isDefault: boolean;
  error: string | null;
  onSave: () => void;
  onCancel: () => void;
  onToggleNull: (v: boolean) => void;
  onToggleDefault: (v: boolean) => void;
}) {
  return createPortal(
    <div
      className="fixed z-[99999] flex items-center gap-2 bg-bg-secondary border border-border rounded-lg shadow-xl px-2 py-1.5 animate-tooltip-in"
      style={{ top: pos.top, left: pos.left }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-0.5">
        <Tooltip content={`Save (${MOD_LABEL}+Enter)`} placement="bottom">
          <button onClick={onSave} disabled={saving} className="p-1 rounded text-success hover:bg-success-subtle transition-colors disabled:opacity-50">
            <Check className="w-3.5 h-3.5" />
          </button>
        </Tooltip>
        <Tooltip content="Cancel (Esc)" placement="bottom">
          <button onClick={onCancel} className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </Tooltip>
      </div>
      {(nullable || hasDefault) && (
        <div className="flex items-center gap-2.5 ml-1 pl-2 border-l border-border">
          {nullable && (
            <label className="flex items-center gap-1.5 cursor-pointer">
              <Checkbox checked={isNull} onChange={onToggleNull} className="w-3.5 h-3.5" />
              <span className={`text-[10px] font-medium uppercase tracking-wide ${isNull ? 'text-warning' : 'text-text-tertiary'}`}>NULL</span>
            </label>
          )}
          {hasDefault && (
            <label className="flex items-center gap-1.5 cursor-pointer">
              <Checkbox checked={isDefault} onChange={onToggleDefault} className="w-3.5 h-3.5" />
              <span className={`text-[10px] font-medium uppercase tracking-wide ${isDefault ? 'text-accent' : 'text-text-tertiary'}`}>Default</span>
            </label>
          )}
        </div>
      )}
      {error && <span className="text-error text-[10px] ml-1 max-w-[200px] truncate">{error}</span>}
    </div>,
    document.body,
  );
}

// ── Main component ─────────────────────────────────────────────

interface InlineEditCellProps {
  value: unknown;
  columnName: string;
  columnType: string;
  nullable: boolean;
  hasDefault: boolean;
  maxLength?: number;
  isPrimaryKey: boolean;
  isArray?: boolean;
  onSave: (value: unknown) => Promise<void>;
  children: ReactNode;
}

export function InlineEditCell({
  value,
  columnType,
  nullable,
  hasDefault,
  maxLength,
  isPrimaryKey,
  isArray,
  onSave,
  children,
}: InlineEditCellProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [boolValue, setBoolValue] = useState(false);
  const [isNull, setIsNull] = useState(false);
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toolbarPos, setToolbarPos] = useState({ top: 0, left: 0 });
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const inputType = getInputType(columnType);
  const useTextarea = inputType === 'text' && !isBoolean(columnType);
  const isBool = isBoolean(columnType);
  const canEdit = !isPrimaryKey && !isArray;
  const inputDisabled = isNull || isDefault;

  useEffect(() => {
    if (editing && inputRef.current && !inputDisabled && !isBool) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement) inputRef.current.select();
      else if (inputRef.current instanceof HTMLTextAreaElement) inputRef.current.setSelectionRange(0, inputRef.current.value.length);
    }
  }, [editing, inputDisabled, isBool]);

  useLayoutEffect(() => {
    if (!editing || !wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    setToolbarPos({ top: rect.bottom + 4, left: rect.left });
  }, [editing]);

  const startEdit = () => {
    if (!canEdit) return;
    const isNullValue = value === null || value === undefined;
    if (isBool) {
      setBoolValue(isNullValue ? false : Boolean(value));
    } else {
      setEditValue(isNullValue ? '' : toInputValue(value, inputType));
    }
    setIsNull(isNullValue);
    setIsDefault(false);
    setError(null);
    setEditing(true);
  };

  const cancel = () => { setEditing(false); setError(null); };

  const save = async () => {
    setSaving(true); setError(null);
    try {
      if (isNull) await onSave(null);
      else if (isDefault) await onSave(undefined);
      else if (isBool) await onSave(boolValue);
      else await onSave(parseValue(editValue, columnType));
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); e.stopPropagation(); save(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  };

  const toggleNull = (checked: boolean) => { setIsNull(checked); if (checked) setIsDefault(false); };
  const toggleDefault = (checked: boolean) => { setIsDefault(checked); if (checked) setIsNull(false); };

  // ── Boolean: display mode ──────────────────────────────────
  if (isBool && !editing && canEdit) {
    const isNullVal = value === null || value === undefined;
    return (
      <div
        onDoubleClick={(e) => {
          e.stopPropagation();
          startEdit();
        }}
        className="flex items-center justify-center"
      >
        {isNullVal ? (
          <span className="text-text-tertiary italic text-xs">NULL</span>
        ) : (
          <div className={`w-4 h-4 rounded border flex items-center justify-center ${value ? 'bg-accent border-accent text-white' : 'border-border bg-bg-primary'}`}>
            {value && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
          </div>
        )}
      </div>
    );
  }

  // ── Boolean: edit mode ─────────────────────────────────────
  if (isBool && editing) {
    return (
      <>
        <div ref={wrapperRef} onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown} tabIndex={0} className="flex items-center justify-center outline-none">
          {isNull ? (
            <span className="text-warning italic text-xs">NULL</span>
          ) : isDefault ? (
            <span className="text-accent italic text-xs">DEFAULT</span>
          ) : (
            <div
              onClick={() => setBoolValue(!boolValue)}
              className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer ${boolValue ? 'bg-accent border-accent text-white' : 'border-border bg-bg-primary hover:border-accent/50'}`}
            >
              {boolValue && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
            </div>
          )}
        </div>
        <EditToolbar
          pos={toolbarPos} saving={saving} nullable={nullable} hasDefault={hasDefault}
          isNull={isNull} isDefault={isDefault} error={error}
          onSave={save} onCancel={cancel} onToggleNull={toggleNull} onToggleDefault={toggleDefault}
        />
      </>
    );
  }

  // ── Non-boolean: display mode ──────────────────────────────
  if (!editing) {
    return (
      <div onDoubleClick={(e) => { e.stopPropagation(); startEdit(); }} className={canEdit ? 'cursor-text' : ''}>
        {children}
      </div>
    );
  }

  // ── Non-boolean: edit mode ─────────────────────────────────
  const inputClasses = `w-full px-1.5 py-1 text-[13px] font-mono bg-bg-primary border rounded text-text-primary focus:outline-none ${
    inputDisabled ? 'opacity-50 italic text-text-tertiary' : ''
  } ${error ? 'border-error' : 'border-accent'}`;

  return (
    <>
      <div ref={wrapperRef} onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        {useTextarea ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={inputDisabled ? '' : editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={inputDisabled}
            placeholder={isNull ? 'NULL' : isDefault ? 'DEFAULT' : ''}
            maxLength={maxLength}
            rows={2}
            className={`${inputClasses} resize-y min-h-[2rem]`}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={inputType}
            value={inputDisabled ? '' : editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={inputDisabled}
            placeholder={isNull ? 'NULL' : isDefault ? 'DEFAULT' : ''}
            maxLength={maxLength}
            step={inputType === 'number' ? 'any' : undefined}
            className={inputClasses}
          />
        )}
      </div>
      <EditToolbar
        pos={toolbarPos} saving={saving} nullable={nullable} hasDefault={hasDefault}
        isNull={isNull} isDefault={isDefault} error={error}
        onSave={save} onCancel={cancel} onToggleNull={toggleNull} onToggleDefault={toggleDefault}
      />
    </>
  );
}
