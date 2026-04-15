import { useState, useEffect } from 'react';
import { Settings, Database, Monitor, Code, Save, Check, Clock, Link, Info, Trash2, Table2, Download } from 'lucide-react';
import { saveAs } from 'file-saver';
import { notifySettingsChanged, modKey } from '../hooks/useSettings';
import { ACCENT_COLORS, getAccentIndex, setAccentIndex, applyAccentColor } from '../lib/accentColors';

const SETTINGS_KEY = 'firebird-settings';
const HISTORY_KEY = 'firebird-sql-history';
const HISTORY_KEY_V2 = 'firebird-sql-history-v2';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 250, 500, 1000] as const;
const HISTORY_LIMIT_OPTIONS = [10, 20, 30, 50, '\u221E'] as const;
const FONT_SIZE_OPTIONS = [12, 13, 14, 15, 16] as const;
const TAB_SIZE_OPTIONS = [2, 4] as const;

export interface AppSettings {
  pageSize: number;
  nullDisplay: string;
  dateFormat: string;
  lazyLoadLists: boolean;
  editorFontSize: number;
  editorLineNumbers: boolean;
  editorWordWrap: boolean;
  editorTabSize: number;
  themePreference: 'system' | 'light' | 'dark';
  executeOnCtrlEnter: boolean;
  queryHistoryLimit: number | '\u221E';
  autoReconnect: boolean;
  defaultExportFormat: 'csv' | 'json' | 'sql' | 'xml' | 'xlsx';
  exportIncludeDdl: boolean;
  csvDelimiter: ',' | ';' | '\t';
}

const DEFAULTS: AppSettings = {
  pageSize: 25,
  nullDisplay: 'NULL',
  dateFormat: 'iso',
  lazyLoadLists: false,
  editorFontSize: 13,
  editorLineNumbers: true,
  editorWordWrap: true,
  editorTabSize: 2,
  themePreference: 'system',
  executeOnCtrlEnter: true,
  queryHistoryLimit: 20,
  autoReconnect: true,
  defaultExportFormat: 'csv',
  exportIncludeDdl: true,
  csvDelimiter: ',',
};

export function loadSettings(): AppSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}');
    return { ...DEFAULTS, ...raw };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings: AppSettings): void {
  if (!(PAGE_SIZE_OPTIONS as readonly number[]).includes(settings.pageSize)) {
    settings.pageSize = DEFAULTS.pageSize;
  }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className={`relative w-9 h-5 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-border'}`}>
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${checked ? 'translate-x-4' : ''}`} />
    </button>
  );
}

function Pills<T extends string | number>({ value, options, onChange, mono }: { value: T; options: readonly T[]; onChange: (v: T) => void; mono?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((opt) => (
        <button
          key={String(opt)}
          onClick={() => onChange(opt)}
          className={`px-2.5 py-1 text-[11px] rounded-md border transition-colors ${mono ? 'font-mono' : ''} ${
            value === opt ? 'bg-accent text-[#ffffff] border-accent' : 'text-text-secondary border-border hover:border-accent/50'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function Dropdown<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)} className="px-2.5 py-1 text-[11px] bg-bg-secondary border border-border rounded-md text-text-primary focus:border-accent focus:outline-none cursor-pointer">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [saved, setSaved] = useState(false);
  const [historyCount, setHistoryCount] = useState(0);
  const [accentIdx, setAccentIdx] = useState(getAccentIndex);
  const isDark = document.documentElement.classList.contains('dark');

  const changeAccent = (idx: number) => {
    setAccentIdx(idx);
    setAccentIndex(idx);
    applyAccentColor(idx);
  };

  useEffect(() => {
    setSettings(loadSettings());
    try {
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY_V2) ?? localStorage.getItem(HISTORY_KEY) ?? '[]');
      setHistoryCount(Array.isArray(h) ? h.length : 0);
    } catch { setHistoryCount(0); }
  }, []);

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }));
  };

  const handleSave = () => {
    saveSettings(settings);
    notifySettingsChanged();
    if (settings.themePreference === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('firebird-theme', 'dark');
    } else if (settings.themePreference === 'light') {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('firebird-theme', 'light');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', prefersDark);
      localStorage.removeItem('firebird-theme');
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const clearHistory = () => {
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem(HISTORY_KEY_V2);
    setHistoryCount(0);
  };

  // Shared cell style for the grid rows
  const cell = 'px-4 py-3 flex items-center';
  const labelCell = `${cell} text-[13px] font-medium text-text-primary`;
  const descCell = 'text-[11px] text-text-tertiary';
  const controlCell = `${cell} justify-end`;

  return (
    <div className="h-full overflow-auto bg-bg-primary">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 bg-bg-primary border-b border-border">
        <div className="flex items-center gap-2.5">
          <Settings className="w-4 h-4 text-text-tertiary" />
          <h1 className="text-sm font-semibold text-text-primary">Settings</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const config: Record<string, unknown> = {};
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith('firebird-')) {
                  try { config[key] = JSON.parse(localStorage.getItem(key)!); } catch { config[key] = localStorage.getItem(key); }
                }
              }
              const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
              saveAs(blob, `firebird-config-${new Date().toISOString().slice(0, 10)}.json`);
            }}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary border border-border rounded-lg hover:bg-bg-tertiary transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export Config
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-accent hover:bg-accent-hover text-[#ffffff] rounded-lg transition-colors shadow-sm"
          >
            {saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {saved ? 'Saved!' : 'Save'}
          </button>
        </div>
      </div>

      {/* Content — full width table-style layout */}
      <div className="divide-y divide-border">

        {/* ── Appearance ─────────────────── */}
        <div className="grid grid-cols-[200px_1fr_auto] items-center border-b border-border bg-bg-secondary">
          <div className="px-4 py-2 flex items-center gap-2">
            <Monitor className="w-3.5 h-3.5 text-text-tertiary" />
            <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">Appearance</span>
          </div>
          <div /><div />
        </div>
        <div className="grid grid-cols-[200px_1fr_auto]">
          <div className={labelCell}>Theme</div>
          <div className={`${cell} ${descCell}`}>System follows your OS preference</div>
          <div className={controlCell}>
            <Pills value={settings.themePreference} options={['system', 'light', 'dark'] as const} onChange={(v) => update('themePreference', v)} />
          </div>
        </div>
        <div className="grid grid-cols-[200px_1fr_auto]">
          <div className={labelCell}>Accent color</div>
          <div className={`${cell} ${descCell}`}>UI highlight color across the app</div>
          <div className={controlCell}>
            <div className="flex gap-1.5">
              {ACCENT_COLORS.map((c, i) => (
                <button
                  key={c.name}
                  onClick={() => changeAccent(i)}
                  className={`w-6 h-6 rounded-md transition-all flex items-center justify-center ${
                    accentIdx === i ? 'ring-2 ring-offset-1 ring-offset-bg-primary ring-accent scale-110' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: isDark ? c.dark.accent : c.light.accent }}
                  aria-label={c.name}
                >
                  {accentIdx === i && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Data Display ───────────────── */}
        <div className="grid grid-cols-[200px_1fr_auto] items-center bg-bg-secondary">
          <div className="px-4 py-2 flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-text-tertiary" />
            <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">Data Display</span>
          </div>
          <div /><div />
        </div>
        <div className="grid grid-cols-[200px_1fr_auto]">
          <div className={labelCell}>Infinite scroll</div>
          <div className={`${cell} ${descCell}`}>Load rows on scroll instead of pagination</div>
          <div className={controlCell}><Toggle checked={settings.lazyLoadLists} onChange={(v) => update('lazyLoadLists', v)} /></div>
        </div>
        <div className={`grid grid-cols-[200px_1fr_auto] ${settings.lazyLoadLists ? 'opacity-40 pointer-events-none' : ''}`}>
          <div className={labelCell}>Records per page</div>
          <div className={`${cell} ${descCell}`}>{settings.lazyLoadLists ? 'Disabled when infinite scroll is on' : 'Rows per page in tables & views'}</div>
          <div className={controlCell}><Pills value={settings.pageSize} options={PAGE_SIZE_OPTIONS} onChange={(v) => update('pageSize', v)} mono /></div>
        </div>
        <div className="grid grid-cols-[200px_1fr_auto]">
          <div className={labelCell}>NULL display</div>
          <div className={`${cell} ${descCell}`}>How NULL values appear in grids</div>
          <div className={controlCell}><Pills value={settings.nullDisplay} options={['NULL', '(null)', '—', ''] as const} onChange={(v) => update('nullDisplay', v)} mono /></div>
        </div>
        <div className="grid grid-cols-[200px_1fr_auto]">
          <div className={labelCell}>Date format</div>
          <div className={`${cell} ${descCell}`}>Display format for dates</div>
          <div className={controlCell}>
            <Dropdown value={settings.dateFormat} options={[
              { value: 'iso', label: 'ISO (2026-04-14)' },
              { value: 'eu', label: 'EU (14.04.2026)' },
              { value: 'us', label: 'US (04/14/2026)' },
              { value: 'relative', label: 'Relative' },
            ]} onChange={(v) => update('dateFormat', v)} />
          </div>
        </div>

        {/* ── SQL Editor ─────────────────── */}
        <div className="grid grid-cols-[200px_1fr_auto] items-center bg-bg-secondary">
          <div className="px-4 py-2 flex items-center gap-2">
            <Code className="w-3.5 h-3.5 text-text-tertiary" />
            <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">SQL Editor</span>
          </div>
          <div /><div />
        </div>
        <div className="grid grid-cols-[200px_1fr_auto]">
          <div className={labelCell}>Font size</div>
          <div className={`${cell} ${descCell}`}>Editor and code viewer font size</div>
          <div className={controlCell}><Pills value={settings.editorFontSize} options={FONT_SIZE_OPTIONS} onChange={(v) => update('editorFontSize', v)} mono /></div>
        </div>
        <div className="grid grid-cols-[200px_1fr_auto]">
          <div className={labelCell}>Tab size</div>
          <div className={`${cell} ${descCell}`}>Spaces per indent level</div>
          <div className={controlCell}><Pills value={settings.editorTabSize} options={TAB_SIZE_OPTIONS} onChange={(v) => update('editorTabSize', v)} mono /></div>
        </div>
        <div className="grid grid-cols-[200px_1fr_auto]">
          <div className={labelCell}>Line numbers</div>
          <div className={`${cell} ${descCell}`}>Show gutter line numbers</div>
          <div className={controlCell}><Toggle checked={settings.editorLineNumbers} onChange={(v) => update('editorLineNumbers', v)} /></div>
        </div>
        <div className="grid grid-cols-[200px_1fr_auto]">
          <div className={labelCell}>Word wrap</div>
          <div className={`${cell} ${descCell}`}>Wrap long lines in editor</div>
          <div className={controlCell}><Toggle checked={settings.editorWordWrap} onChange={(v) => update('editorWordWrap', v)} /></div>
        </div>
        <div className="grid grid-cols-[200px_1fr_auto]">
          <div className={labelCell}>{modKey}+Enter to run</div>
          <div className={`${cell} ${descCell}`}>Execute query with keyboard shortcut</div>
          <div className={controlCell}><Toggle checked={settings.executeOnCtrlEnter} onChange={(v) => update('executeOnCtrlEnter', v)} /></div>
        </div>

        {/* ── Query History ──────────────── */}
        <div className="grid grid-cols-[200px_1fr_auto] items-center bg-bg-secondary">
          <div className="px-4 py-2 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-text-tertiary" />
            <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">Query History</span>
          </div>
          <div /><div />
        </div>
        <div className="grid grid-cols-[200px_1fr_auto]">
          <div className={labelCell}>History limit</div>
          <div className={`${cell} ${descCell}`}>Max stored queries</div>
          <div className={controlCell}><Pills value={settings.queryHistoryLimit} options={HISTORY_LIMIT_OPTIONS} onChange={(v) => update('queryHistoryLimit', v)} mono /></div>
        </div>
        <div className="grid grid-cols-[200px_1fr_auto]">
          <div className={labelCell}>Clear history</div>
          <div className={`${cell} ${descCell}`}>{historyCount} {historyCount === 1 ? 'query' : 'queries'} stored</div>
          <div className={controlCell}>
            <button onClick={clearHistory} disabled={historyCount === 0} className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-error hover:bg-error-subtle border border-error/20 rounded-md transition-colors disabled:opacity-40">
              <Trash2 className="w-3 h-3" />Clear
            </button>
          </div>
        </div>

        {/* ── Connection ─────────────────── */}
        <div className="grid grid-cols-[200px_1fr_auto] items-center bg-bg-secondary">
          <div className="px-4 py-2 flex items-center gap-2">
            <Link className="w-3.5 h-3.5 text-text-tertiary" />
            <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">Connection</span>
          </div>
          <div /><div />
        </div>
        <div className="grid grid-cols-[200px_1fr_auto]">
          <div className={labelCell}>Auto-reconnect</div>
          <div className={`${cell} ${descCell}`}>Restore session on page load</div>
          <div className={controlCell}><Toggle checked={settings.autoReconnect} onChange={(v) => update('autoReconnect', v)} /></div>
        </div>

        {/* ── Export ──────────────────────── */}
        <div className="grid grid-cols-[200px_1fr_auto] items-center bg-bg-secondary">
          <div className="px-4 py-2 flex items-center gap-2">
            <Table2 className="w-3.5 h-3.5 text-text-tertiary" />
            <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">Export</span>
          </div>
          <div /><div />
        </div>
        <div className="grid grid-cols-[200px_1fr_auto]">
          <div className={labelCell}>Default format</div>
          <div className={`${cell} ${descCell}`}>Export format for query results and table data</div>
          <div className={controlCell}><Pills value={settings.defaultExportFormat} options={['csv', 'json', 'sql', 'xml', 'xlsx'] as const} onChange={(v) => update('defaultExportFormat', v)} /></div>
        </div>
        <div className="grid grid-cols-[200px_1fr_auto]">
          <div className={labelCell}>Include DDL</div>
          <div className={`${cell} ${descCell}`}>Include CREATE TABLE in SQL exports by default</div>
          <div className={controlCell}><Toggle checked={settings.exportIncludeDdl} onChange={(v) => update('exportIncludeDdl', v)} /></div>
        </div>
        <div className="grid grid-cols-[200px_1fr_auto]">
          <div className={labelCell}>CSV delimiter</div>
          <div className={`${cell} ${descCell}`}>Column separator for CSV exports</div>
          <div className={controlCell}><Pills value={settings.csvDelimiter} options={[',', ';', '\t'] as const} onChange={(v) => update('csvDelimiter', v)} /></div>
        </div>

        {/* ── Database Conversion ────────── */}
        <div className="flex items-center gap-2 px-4 py-2 bg-bg-secondary">
          <Database className="w-3.5 h-3.5 text-text-tertiary" />
          <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">Database Conversion</span>
          <span className="px-1.5 py-0.5 text-[9px] font-medium bg-accent-subtle text-accent rounded whitespace-nowrap">Coming Soon</span>
        </div>
        <div className="grid grid-cols-[200px_1fr_auto] opacity-50 pointer-events-none">
          <div className={labelCell}>Convert to</div>
          <div className={`${cell} ${descCell}`}>Convert entire Firebird database to another SQL system</div>
          <div className={controlCell}>
            <div className="flex flex-wrap gap-1.5">
              {[
                { name: 'MySQL', color: 'text-blue-500 border-blue-500/20 bg-blue-500/5' },
                { name: 'MariaDB', color: 'text-sky-500 border-sky-500/20 bg-sky-500/5' },
                { name: 'PostgreSQL', color: 'text-indigo-500 border-indigo-500/20 bg-indigo-500/5' },
                { name: 'MSSQL', color: 'text-red-500 border-red-500/20 bg-red-500/5' },
                { name: 'SQLite', color: 'text-cyan-600 border-cyan-600/20 bg-cyan-600/5' },
                { name: 'Oracle', color: 'text-orange-500 border-orange-500/20 bg-orange-500/5' },
                { name: 'CockroachDB', color: 'text-purple-500 border-purple-500/20 bg-purple-500/5' },
              ].map((db) => (
                <button key={db.name} disabled className={`px-2.5 py-1 text-[11px] font-medium rounded-md border ${db.color} cursor-not-allowed`}>{db.name}</button>
              ))}
            </div>
          </div>
        </div>

        {/* ── About ──────────────────────── */}
        <div className="grid grid-cols-[200px_1fr_auto] items-center bg-bg-secondary">
          <div className="px-4 py-2 flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-text-tertiary" />
            <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">About</span>
          </div>
          <div /><div />
        </div>
        <div className="grid grid-cols-[200px_1fr_auto]">
          <div className={labelCell}>Version</div>
          <div className={`${cell} font-mono text-[13px] text-text-primary`}>0.0.1-beta</div>
          <div />
        </div>
        <div className="grid grid-cols-[200px_1fr_auto]">
          <div className={labelCell}>Author</div>
          <div className={cell}><a href="https://github.com/ZlatanOmerovic" target="_blank" rel="noopener noreferrer" className="text-[13px] text-accent hover:text-accent-hover">Ascent Syst&egrave;mes</a></div>
          <div />
        </div>
        <div className="grid grid-cols-[200px_1fr_auto]">
          <div className={labelCell}>Company</div>
          <div className={`${cell} text-[13px] text-text-primary`}>Ascent Syst&egrave;mes</div>
          <div />
        </div>
        <div className="grid grid-cols-[200px_1fr_auto]">
          <div className={labelCell}>Repository</div>
          <div className={cell}>
            <a href="https://github.com/ZlatanOmerovic/firebird-web-client" target="_blank" rel="noopener noreferrer" className="text-[13px] text-accent hover:text-accent-hover flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
              firebird-web-client
            </a>
          </div>
          <div />
        </div>
        <div className="grid grid-cols-[200px_1fr_auto]">
          <div className={labelCell}>License</div>
          <div className={`${cell} font-mono text-[13px] text-text-primary`}>MIT</div>
          <div />
        </div>
        <div className="grid grid-cols-[200px_1fr_auto]">
          <div className={labelCell}>Built with</div>
          <div className={`${cell} text-[11px] text-text-tertiary`}>React &middot; Vite &middot; Tailwind &middot; Fastify &middot; node-firebird &middot; Claude Code</div>
          <div />
        </div>

      </div>
    </div>
  );
}
