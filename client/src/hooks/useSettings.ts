import { useSyncExternalStore } from 'react';
import type { AppSettings } from '../components/SettingsPage';

const SETTINGS_KEY = 'firebird-settings';

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

let cached: AppSettings | null = null;

function getSettings(): AppSettings {
  if (cached) return cached;
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}');
    cached = { ...DEFAULTS, ...raw };
  } catch {
    cached = { ...DEFAULTS };
  }
  return cached!;
}

// Listeners for external store
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Call this after saving settings to notify all consumers
export function notifySettingsChanged() {
  cached = null;
  listeners.forEach((l) => l());
}

// Listen for storage changes from other tabs
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === SETTINGS_KEY) {
      cached = null;
      listeners.forEach((l) => l());
    }
  });
}

export function useSettings(): AppSettings {
  return useSyncExternalStore(subscribe, getSettings);
}

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);
export const modKey = isMac ? '⌘' : 'Ctrl';
