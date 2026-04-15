import { useState, useRef, useCallback } from 'react';
import { X, Upload, FileUp, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

// ── Validation ─────────────────────────────────────────────────

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  keys: string[];
  summary: string;
}

const KNOWN_KEYS: Record<string, (val: unknown) => string | null> = {
  'firebird-settings': (v) => typeof v === 'object' && v !== null && !Array.isArray(v) ? null : 'must be an object',
  'firebird-saved-connections': (v) => Array.isArray(v) ? null : 'must be an array',
  'firebird-theme': (v) => v === 'dark' || v === 'light' ? null : "must be 'dark' or 'light'",
  'firebird-accent-color': (v) => typeof v === 'string' && /^\d+$/.test(v) && parseInt(v) >= 0 && parseInt(v) <= 9 ? null : 'must be a number 0-9',
  'firebird-sidebar-collapsed': (v) => v === '0' || v === '1' ? null : "must be '0' or '1'",
  'firebird-sql-history-v2': (v) => Array.isArray(v) ? null : 'must be an array',
  'firebird-sql-history': (v) => Array.isArray(v) ? null : 'must be an array',
  'firebird-editor-height': (v) => typeof v === 'string' && /^\d+$/.test(v) ? null : 'must be a number string',
};

function validateConfig(raw: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const keys: string[] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { valid: false, errors: ['Invalid JSON — could not parse'], warnings: [], keys: [], summary: '' };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { valid: false, errors: ['Configuration must be a JSON object, not an array or primitive'], warnings: [], keys: [], summary: '' };
  }

  const obj = parsed as Record<string, unknown>;
  const entries = Object.entries(obj);

  if (entries.length === 0) {
    return { valid: false, errors: ['Configuration is empty'], warnings: [], keys: [], summary: '' };
  }

  for (const [key, value] of entries) {
    if (!key.startsWith('firebird-')) {
      errors.push(`Unknown key "${key}" — all keys must start with "firebird-"`);
      continue;
    }

    keys.push(key);

    // Check known keys
    const isColWidths = key.startsWith('firebird-colwidths-');
    if (isColWidths) {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        errors.push(`"${key}": must be an object with number values`);
      }
      continue;
    }

    const validator = KNOWN_KEYS[key];
    if (validator) {
      const err = validator(value);
      if (err) errors.push(`"${key}": ${err}`);
    } else {
      warnings.push(`Unrecognized key "${key}" — will be imported anyway`);
    }
  }

  const valid = errors.length === 0;
  const summary = valid
    ? `${keys.length} configuration ${keys.length === 1 ? 'key' : 'keys'} ready to import`
    : `${errors.length} ${errors.length === 1 ? 'error' : 'errors'} found`;

  return { valid, errors, warnings, keys, summary };
}

// ── Component ──────────────────────────────────────────────────

interface ConfigImportModalProps {
  onClose: () => void;
}

export function ConfigImportModal({ onClose }: ConfigImportModalProps) {
  const [content, setContent] = useState('');
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const [applying, setApplying] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const processContent = useCallback((text: string) => {
    setContent(text);
    setResult(validateConfig(text));
  }, []);

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
      setResult({ valid: false, errors: ['File must be a .json file'], warnings: [], keys: [], summary: '' });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      processContent(text);
    };
    reader.readAsText(file);
  }, [processContent]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handlePaste = useCallback((text: string) => {
    setContent(text);
    if (text.trim()) {
      setResult(validateConfig(text));
    } else {
      setResult(null);
    }
  }, []);

  const handleApply = () => {
    if (!result?.valid) return;
    setApplying(true);
    try {
      const obj = JSON.parse(content) as Record<string, unknown>;
      for (const [key, value] of Object.entries(obj)) {
        if (!key.startsWith('firebird-')) continue;
        const stored = typeof value === 'string' ? value : JSON.stringify(value);
        localStorage.setItem(key, stored);
      }
      // Reload to apply all settings
      window.location.reload();
    } catch {
      setResult({ valid: false, errors: ['Failed to apply configuration'], warnings: [], keys: [], summary: '' });
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-bg-secondary border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <Upload className="w-4.5 h-4.5 text-accent" />
            <h3 className="text-sm font-semibold text-text-primary">Load Configuration</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Dropzone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
              dragging
                ? 'border-accent bg-accent-subtle'
                : 'border-border hover:border-accent/40 hover:bg-bg-tertiary/50'
            }`}
          >
            <FileUp className={`w-6 h-6 ${dragging ? 'text-accent' : 'text-text-tertiary'}`} />
            <div className="text-center">
              <p className="text-xs font-medium text-text-primary">Drop a <code className="font-mono text-accent">.json</code> file here</p>
              <p className="text-[10px] text-text-tertiary mt-0.5">or click to browse</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] text-text-tertiary uppercase tracking-wide">or paste JSON</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Textarea */}
          <textarea
            value={content}
            onChange={(e) => handlePaste(e.target.value)}
            placeholder='{"firebird-settings": {...}, "firebird-saved-connections": [...]}'
            rows={5}
            className="w-full px-3 py-2.5 bg-bg-primary border border-border rounded-lg text-xs font-mono text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none resize-y"
          />

          {/* Validation result */}
          {result && (
            <div className={`px-4 py-3 rounded-lg border ${result.valid ? 'bg-success-subtle border-success/20' : 'bg-error-subtle border-error/20'}`}>
              <div className="flex items-center gap-2 mb-1">
                {result.valid ? (
                  <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-error shrink-0" />
                )}
                <span className={`text-xs font-medium ${result.valid ? 'text-success' : 'text-error'}`}>{result.summary}</span>
              </div>
              {result.errors.length > 0 && (
                <ul className="mt-2 space-y-0.5 pl-6">
                  {result.errors.map((err, i) => (
                    <li key={i} className="text-[11px] text-error list-disc">{err}</li>
                  ))}
                </ul>
              )}
              {result.warnings.length > 0 && (
                <ul className="mt-2 space-y-0.5 pl-6">
                  {result.warnings.map((w, i) => (
                    <li key={i} className="text-[11px] text-warning list-disc">{w}</li>
                  ))}
                </ul>
              )}
              {result.valid && result.keys.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {result.keys.map((k) => (
                    <span key={k} className="px-1.5 py-0.5 text-[9px] font-mono bg-bg-primary border border-border rounded text-text-secondary">{k}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3 border-t border-border bg-bg-tertiary">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary rounded-lg hover:bg-bg-secondary transition-colors">
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!result?.valid || applying}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-accent hover:bg-accent-hover text-[#ffffff] rounded-lg transition-colors shadow-sm disabled:opacity-50"
          >
            {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Apply Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
