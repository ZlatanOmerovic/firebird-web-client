import { useState, useCallback, useEffect } from 'react';
import { useConnectionStore } from './store/connectionStore';
import { SplashScreen } from './components/SplashScreen';
import { OutroScreen } from './components/OutroScreen';
import { ConnectionPanel } from './components/ConnectionPanel';
import { Sidebar, type DbObjectSelection } from './components/Sidebar';
import { TableView } from './components/TableView';
import { SqlEditor } from './components/SqlEditor';
import { StatusBar } from './components/StatusBar';
import { ToastContainer } from './components/Toast';
import {
  ProcedureView,
  TriggerView,
  ViewDetailView,
  GeneratorsView,
  DomainsView,
} from './components/ObjectDetailView';
// New object modals are rendered inside ObjectListPage
import { DisconnectModal } from './components/DisconnectModal';
import { Dashboard } from './components/Dashboard';
import { SettingsPage } from './components/SettingsPage';
import { HistoryPage } from './components/HistoryPage';
import { ObjectListPage } from './components/ObjectListPage';
import { GlobalRequestIndicator } from './components/GlobalRequestIndicator';
import { ServerHealthIndicator } from './components/ServerHealthIndicator';
import { AudioVisualizer } from './components/AudioVisualizer';
import { LogOut, Loader2, Sun, Moon, Terminal, Settings, LayoutDashboard, History, Palette } from 'lucide-react';
import { ACCENT_COLORS, getAccentIndex, setAccentIndex, applyAccentColor } from './lib/accentColors';
import { Tooltip } from './components/Tooltip';
import { useSettings } from './hooks/useSettings';

function useThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('firebird-theme', next ? 'dark' : 'light');
  };

  return { dark, toggle };
}

// ── URL Routing ─────────────────────────────────────────────────

function selectionToPath(sel: DbObjectSelection | null): string {
  if (!sel) return '/';
  switch (sel.kind) {
    case 'table': return `/table/${encodeURIComponent(sel.name)}`;
    case 'view': return `/view/${encodeURIComponent(sel.name)}`;
    case 'procedure': return `/procedure/${encodeURIComponent(sel.name)}`;
    case 'trigger': return `/trigger/${encodeURIComponent(sel.name)}`;
    case 'generators': return '/generators';
    case 'domains': return '/domains';
    case 'sql': return '/sql';
    case 'new-table': return '/new/table';
    case 'new-view': return '/new/view';
    case 'new-procedure': return '/new/procedure';
    case 'new-trigger': return '/new/trigger';
    case 'new-generator': return '/new/generator';
    case 'new-domain': return '/new/domain';
    case 'settings': return '/settings';
    case 'history': return '/history';
    case 'tables-list': return '/tables';
    case 'views-list': return '/views';
    case 'procedures-list': return '/procedures';
    case 'triggers-list': return '/triggers';
  }
}

function pathToSelection(path: string): DbObjectSelection | null {
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return null;

  if (parts[0] === 'sql') return { kind: 'sql' };
  if (parts[0] === 'settings') return { kind: 'settings' };
  if (parts[0] === 'history') return { kind: 'history' };
  if (parts[0] === 'tables' && !parts[1]) return { kind: 'tables-list' };
  if (parts[0] === 'views' && !parts[1]) return { kind: 'views-list' };
  if (parts[0] === 'procedures' && !parts[1]) return { kind: 'procedures-list' };
  if (parts[0] === 'triggers' && !parts[1]) return { kind: 'triggers-list' };
  if (parts[0] === 'generators') return { kind: 'generators' };
  if (parts[0] === 'domains') return { kind: 'domains' };

  if (parts[0] === 'new') {
    if (parts[1] === 'table') return { kind: 'new-table' };
    if (parts[1] === 'view') return { kind: 'new-view' };
    if (parts[1] === 'procedure') return { kind: 'new-procedure' };
    if (parts[1] === 'trigger') return { kind: 'new-trigger' };
    if (parts[1] === 'generator') return { kind: 'new-generator' };
    if (parts[1] === 'domain') return { kind: 'new-domain' };
  }

  if (parts[1]) {
    const name = decodeURIComponent(parts[1]);
    if (parts[0] === 'table') return { kind: 'table', name };
    if (parts[0] === 'view') return { kind: 'view', name };
    if (parts[0] === 'procedure') return { kind: 'procedure', name };
    if (parts[0] === 'trigger') return { kind: 'trigger', name };
  }

  return null;
}

function getSelectionLabel(sel: DbObjectSelection | null): string {
  if (!sel) return 'Dashboard';
  switch (sel.kind) {
    case 'sql': return 'SQL Editor';
    case 'table': return sel.name;
    case 'view': return `View: ${sel.name}`;
    case 'procedure': return `Procedure: ${sel.name}`;
    case 'trigger': return `Trigger: ${sel.name}`;
    case 'generators': return 'Generators';
    case 'domains': return 'Domains';
    case 'new-table': return 'New Table';
    case 'new-view': return 'New View';
    case 'new-procedure': return 'New Procedure';
    case 'new-trigger': return 'New Trigger';
    case 'new-generator': return 'New Generator';
    case 'new-domain': return 'New Domain';
    case 'settings': return 'Settings';
    case 'history': return 'Query History';
    case 'tables-list': return 'Tables';
    case 'views-list': return 'Views';
    case 'procedures-list': return 'Procedures';
    case 'triggers-list': return 'Triggers';
  }
}

function App() {
  const { connected, disconnect, restore, restoring } = useConnectionStore();
  const [selection, setSelection] = useState<DbObjectSelection | null>(() => pathToSelection(window.location.pathname));
  const [rowCount, setRowCount] = useState<number | null>(null);
  const [lastQueryTime, setLastQueryTime] = useState<number | null>(null);
  const { dark, toggle: toggleTheme } = useThemeToggle();
  const [showSplash, setShowSplash] = useState(false); // TODO: set back to true
  const [showOutro, setShowOutro] = useState(false);
  const ENABLE_CINEMATIC = false; // TODO: set back to true
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('firebird-sidebar-collapsed') === '1');
  const [accentIdx, setAccentIdx] = useState(getAccentIndex);
  const [showAccentPicker, setShowAccentPicker] = useState(false);

  const changeAccent = (idx: number) => {
    setAccentIdx(idx);
    setAccentIndex(idx);
    applyAccentColor(idx);
    setShowAccentPicker(false);
  };

  useEffect(() => {
    const handler = (e: Event) => setSidebarCollapsed((e as CustomEvent).detail);
    window.addEventListener('sidebar-toggle', handler);
    return () => window.removeEventListener('sidebar-toggle', handler);
  }, []);

  const appSettings = useSettings();

  useEffect(() => {
    if (appSettings.autoReconnect) {
      restore();
    }
  }, [restore, appSettings.autoReconnect]);

  // Monitor audio for outro trigger at 2:00 (120s)
  useEffect(() => {
    if (!ENABLE_CINEMATIC || showSplash || showOutro) return;
    const audio = (window as unknown as Record<string, unknown>).__splashAudio as HTMLAudioElement | undefined;
    if (!audio) return;
    const interval = setInterval(() => {
      if (audio.currentTime >= 120 && !audio.paused) {
        setShowOutro(true);
        clearInterval(interval);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [showSplash, showOutro]);

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
    const audio = (window as unknown as Record<string, unknown>).__splashAudio as HTMLAudioElement | undefined;
    if (audio) setAudioElement(audio);
  }, []);


  const handleSelect = useCallback((sel: DbObjectSelection) => {
    setSelection(sel);
    setRowCount(null);
    const path = selectionToPath(sel);
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
    }
  }, []);

  // Listen for back/forward browser navigation
  useEffect(() => {
    const onPopState = () => {
      setSelection(pathToSelection(window.location.pathname));
      setRowCount(null);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const handleTableStatus = useCallback(
    (info: { table: string; total: number; duration?: number }) => {
      setRowCount(info.total);
      if (info.duration !== undefined) setLastQueryTime(info.duration);
    },
    [],
  );

  const handleSqlStatus = useCallback((info: { duration?: number }) => {
    if (info.duration !== undefined) setLastQueryTime(info.duration);
  }, []);

  if (restoring) {
    return (
      <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-[fadeIn_0.3s_ease-out]">
          <div className="flex items-center gap-2.5">
            <svg className="w-5 h-5 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
              <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
            </svg>
            <span className="text-[15px] font-semibold text-text-primary">Firebird <span className="text-accent">Web Client</span></span>
            <span className="text-[10px] text-text-tertiary self-end mb-px">v0.0.1-beta</span>
          </div>
          <div className="flex items-center gap-2 text-text-tertiary">
            <div className="w-1 h-1 rounded-full bg-accent animate-pulse" />
            <span className="text-[11px]">Restoring session...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <>
        <ConnectionPanel />
        <ToastContainer />
        {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
        {showOutro && <OutroScreen />}
        {!showSplash && <AudioVisualizer audio={audioElement} visible={!!audioElement} position={showOutro ? 'bottom-full' : 'top'} />}
      </>
    );
  }

  const renderContent = () => {
    if (!selection) {
      return <Dashboard onNavigate={handleSelect} />;
    }

    switch (selection.kind) {
      case 'sql':
        return <SqlEditor onStatusUpdate={handleSqlStatus} />;
      case 'table':
        return (
          <TableView
            key={selection.name}
            tableName={selection.name}
            onStatusUpdate={handleTableStatus}
          />
        );
      case 'view':
        return <ViewDetailView key={selection.name} name={selection.name} />;
      case 'procedure':
        return <ProcedureView key={selection.name} name={selection.name} />;
      case 'trigger':
        return <TriggerView key={selection.name} name={selection.name} />;
      case 'new-table':
        return <ObjectListPage kind="tables-list" onNavigate={handleSelect} />;
      case 'new-view':
        return <ObjectListPage kind="views-list" onNavigate={handleSelect} />;
      case 'new-procedure':
        return <ObjectListPage kind="procedures-list" onNavigate={handleSelect} />;
      case 'new-trigger':
        return <ObjectListPage kind="triggers-list" onNavigate={handleSelect} />;
      case 'new-generator':
        return <ObjectListPage kind="generators" onNavigate={handleSelect} />;
      case 'new-domain':
        return <ObjectListPage kind="domains" onNavigate={handleSelect} />;
      case 'settings':
        return <SettingsPage />;
      case 'history':
        return <HistoryPage onNavigate={handleSelect} />;
      case 'tables-list':
      case 'views-list':
      case 'procedures-list':
      case 'triggers-list':
      case 'generators':
      case 'domains':
        return <ObjectListPage kind={selection.kind} onNavigate={handleSelect} />;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-bg-primary">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar selection={selection} onSelect={handleSelect} />

        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Top bar */}
          <div className="flex items-center border-b border-border bg-bg-secondary">
            <a href="/" className={`relative self-stretch items-center gap-1.5 px-3 border-r border-border bg-bg-tertiary text-text-primary hover:bg-bg-secondary transition-colors ${sidebarCollapsed ? 'flex' : 'hidden'}`}>
              <svg className="w-3.5 h-3.5 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
                <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
              </svg>
              <span className="text-[11px] font-semibold">Firebird <span className="text-accent">Web Client</span></span>
              <span className="absolute bottom-0.5 right-1.5 text-[8px] text-text-tertiary">v0.0.1-beta</span>
            </a>
            <button
              onClick={() => { setSelection(null); window.history.pushState(null, '', '/'); }}
              className={`self-stretch flex items-center gap-1.5 px-3 text-xs font-medium border-r border-border transition-colors cursor-pointer ${
                selection === null
                  ? 'bg-accent-subtle text-accent'
                  : 'text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Dashboard
            </button>
            <h2 className="flex-1 text-sm font-medium text-text-primary px-4 py-3">
              {selection?.kind === 'table' || selection?.kind === 'view' || selection?.kind === 'procedure' || selection?.kind === 'trigger' ? (
                <>
                  <span className="text-text-tertiary capitalize">{selection.kind}: </span>
                  <span className="font-mono">{selection.name}</span>
                </>
              ) : (
                getSelectionLabel(selection)
              )}
            </h2>
            <div className="flex items-center gap-1.5 px-2.5 mr-1 self-stretch">
              <ServerHealthIndicator />
            </div>
            {/* Divider + Accent color picker + Theme toggle */}
            <div className="self-stretch w-px bg-border" />
            <div className="relative flex items-center px-1.5">
              <Tooltip content="Accent color" placement="bottom">
                <button
                  onClick={() => setShowAccentPicker((v) => !v)}
                  className="p-1.5 rounded-lg hover:bg-bg-tertiary transition-colors"
                >
                  <div className="w-3.5 h-3.5 rounded-full shadow-sm" style={{ backgroundColor: dark ? ACCENT_COLORS[accentIdx]?.dark.accent : ACCENT_COLORS[accentIdx]?.light.accent }} />
                </button>
              </Tooltip>
              {showAccentPicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowAccentPicker(false)} />
                  <div className="absolute top-full right-0 mt-1.5 z-50 bg-bg-secondary border border-border rounded-xl shadow-xl p-2.5 w-[180px]">
                    <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide mb-2 px-0.5">Accent Color</p>
                    <div className="grid grid-cols-5 gap-1.5">
                      {ACCENT_COLORS.map((c, i) => (
                        <Tooltip key={c.name} content={c.name} placement="top" delay={0}>
                          <button
                            onClick={() => changeAccent(i)}
                            className={`w-7 h-7 rounded-lg transition-all flex items-center justify-center ${
                              accentIdx === i ? 'ring-2 ring-offset-1 ring-offset-bg-secondary ring-accent scale-110' : 'hover:scale-110'
                            }`}
                            style={{ backgroundColor: dark ? c.dark.accent : c.light.accent }}
                          >
                            {accentIdx === i && <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
                          </button>
                        </Tooltip>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors mr-1"
              aria-label="Toggle theme"
            >
              {dark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => handleSelect({ kind: 'history' } as DbObjectSelection)}
              className={`self-stretch flex items-center gap-1.5 px-3 text-xs font-medium border-l border-border transition-colors cursor-pointer ${
                selection?.kind === 'history'
                  ? 'text-text-primary bg-bg-tertiary'
                  : 'text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              History
            </button>
            <button
              onClick={() => handleSelect({ kind: 'settings' } as DbObjectSelection)}
              className={`self-stretch flex items-center gap-1.5 px-3 text-xs font-medium border-l border-border transition-colors cursor-pointer ${
                selection?.kind === 'settings'
                  ? 'text-text-primary bg-bg-tertiary'
                  : 'text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              Settings
            </button>
            <button
              onClick={() => setShowDisconnectModal(true)}
              className={`self-stretch flex items-center gap-1.5 px-3 text-xs font-medium border-l border-border transition-colors cursor-pointer ${
                dark
                  ? 'text-text-secondary bg-red-400/8 hover:text-error hover:bg-error-subtle'
                  : 'text-red-700/70 bg-red-500/10 hover:text-error hover:bg-red-500/20'
              }`}
            >
              <LogOut className="w-3.5 h-3.5" />
              Disconnect
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {renderContent()}
          </div>
        </main>
      </div>

      <StatusBar
        selectedTable={selection ? getSelectionLabel(selection) : null}
        rowCount={rowCount}
        lastQueryTime={lastQueryTime}
      />
      <ToastContainer />
      {showDisconnectModal && <DisconnectModal onClose={() => setShowDisconnectModal(false)} />}
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
      {showOutro && <OutroScreen />}
        {!showSplash && <AudioVisualizer audio={audioElement} visible={!!audioElement} position={showOutro ? 'bottom-full' : 'top'} compact />}
    </div>
  );
}

export default App;
