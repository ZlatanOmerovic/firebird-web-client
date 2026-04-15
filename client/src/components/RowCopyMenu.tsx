import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Check, Database, Braces, FileSpreadsheet, FileText } from 'lucide-react';
import { Tooltip } from './Tooltip';

// ── Format helpers ─────────────────────────────────────────────

function sqlValue(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  return `'${String(val).replace(/'/g, "''")}'`;
}

function csvValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toSqlInsert(table: string, columns: string[], row: Record<string, unknown>): string {
  const cols = columns.map((c) => `"${c}"`).join(', ');
  const vals = columns.map((c) => sqlValue(row[c])).join(', ');
  return `INSERT INTO "${table}" (${cols}) VALUES (${vals});`;
}

function toJson(columns: string[], row: Record<string, unknown>): string {
  const obj: Record<string, unknown> = {};
  for (const c of columns) obj[c] = row[c] ?? null;
  return JSON.stringify(obj, null, 2);
}

function toCsv(columns: string[], row: Record<string, unknown>): string {
  const header = columns.map(csvValue).join(',');
  const data = columns.map((c) => csvValue(row[c])).join(',');
  return `${header}\n${data}`;
}

function toRawText(columns: string[], row: Record<string, unknown>): string {
  return columns.map((c) => {
    const val = row[c];
    return `${c}: ${val === null || val === undefined ? 'NULL' : String(val)}`;
  }).join(' | ');
}

// ── Component ──────────────────────────────────────────────────

interface RowCopyMenuProps {
  columns: string[];
  row: Record<string, unknown>;
  tableName: string;
}

const FORMATS = [
  { key: 'sql', label: 'SQL INSERT', icon: Database, fn: toSqlInsert },
  { key: 'json', label: 'JSON', icon: Braces, fn: toJson },
  { key: 'csv', label: 'CSV', icon: FileSpreadsheet, fn: toCsv },
  { key: 'raw', label: 'Raw Text', icon: FileText, fn: toRawText },
] as const;

export function RowCopyMenu({ columns, row, tableName }: RowCopyMenuProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 50);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler); };
  }, [open]);

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => { setCopied(null); setOpen(false); }, 800);
    });
  };

  return (
    <>
      <Tooltip content="Copy row" placement="top">
        <button
          ref={btnRef}
          onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
          className="p-1 rounded text-text-tertiary hover:text-accent hover:bg-accent-subtle transition-colors"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      </Tooltip>

      {open && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[99999] bg-bg-secondary border border-border rounded-lg shadow-xl overflow-hidden animate-tooltip-in"
          style={{ top: pos.top, left: pos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 border-b border-border">
            <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide">Copy row as</span>
          </div>
          {FORMATS.map((fmt) => {
            const Icon = fmt.icon;
            const isCopied = copied === fmt.key;
            const text = fmt.key === 'sql'
              ? toSqlInsert(tableName, columns, row)
              : fmt.key === 'json'
                ? toJson(columns, row)
                : fmt.key === 'csv'
                  ? toCsv(columns, row)
                  : toRawText(columns, row);
            return (
              <button
                key={fmt.key}
                onClick={() => handleCopy(fmt.key, text)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-success" /> : <Icon className="w-3.5 h-3.5" />}
                <span className={isCopied ? 'text-success font-medium' : ''}>{isCopied ? 'Copied!' : fmt.label}</span>
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}
