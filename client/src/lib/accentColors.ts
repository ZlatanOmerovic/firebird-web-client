export interface AccentColorDef {
  name: string;
  light: { accent: string; hover: string; subtle: string; rowHover: string };
  dark: { accent: string; hover: string; subtle: string; rowHover: string };
}

export const ACCENT_COLORS: AccentColorDef[] = [
  {
    name: 'Blue',
    light: { accent: '#3b82f6', hover: '#2563eb', subtle: 'rgba(59,130,246,0.1)', rowHover: 'rgba(59,130,246,0.06)' },
    dark: { accent: '#3b82f6', hover: '#60a5fa', subtle: 'rgba(59,130,246,0.12)', rowHover: 'rgba(59,130,246,0.06)' },
  },
  {
    name: 'Indigo',
    light: { accent: '#6366f1', hover: '#4f46e5', subtle: 'rgba(99,102,241,0.1)', rowHover: 'rgba(99,102,241,0.06)' },
    dark: { accent: '#818cf8', hover: '#a5b4fc', subtle: 'rgba(129,140,248,0.12)', rowHover: 'rgba(129,140,248,0.06)' },
  },
  {
    name: 'Violet',
    light: { accent: '#8b5cf6', hover: '#7c3aed', subtle: 'rgba(139,92,246,0.1)', rowHover: 'rgba(139,92,246,0.06)' },
    dark: { accent: '#a78bfa', hover: '#c4b5fd', subtle: 'rgba(167,139,250,0.12)', rowHover: 'rgba(167,139,250,0.06)' },
  },
  {
    name: 'Purple',
    light: { accent: '#a855f7', hover: '#9333ea', subtle: 'rgba(168,85,247,0.1)', rowHover: 'rgba(168,85,247,0.06)' },
    dark: { accent: '#c084fc', hover: '#d8b4fe', subtle: 'rgba(192,132,252,0.12)', rowHover: 'rgba(192,132,252,0.06)' },
  },
  {
    name: 'Rose',
    light: { accent: '#f43f5e', hover: '#e11d48', subtle: 'rgba(244,63,94,0.1)', rowHover: 'rgba(244,63,94,0.06)' },
    dark: { accent: '#fb7185', hover: '#fda4af', subtle: 'rgba(251,113,133,0.12)', rowHover: 'rgba(251,113,133,0.06)' },
  },
  {
    name: 'Orange',
    light: { accent: '#f97316', hover: '#ea580c', subtle: 'rgba(249,115,22,0.1)', rowHover: 'rgba(249,115,22,0.06)' },
    dark: { accent: '#fb923c', hover: '#fdba74', subtle: 'rgba(251,146,60,0.12)', rowHover: 'rgba(251,146,60,0.06)' },
  },
  {
    name: 'Amber',
    light: { accent: '#d97706', hover: '#b45309', subtle: 'rgba(217,119,6,0.1)', rowHover: 'rgba(217,119,6,0.06)' },
    dark: { accent: '#fbbf24', hover: '#fcd34d', subtle: 'rgba(251,191,36,0.12)', rowHover: 'rgba(251,191,36,0.06)' },
  },
  {
    name: 'Emerald',
    light: { accent: '#10b981', hover: '#059669', subtle: 'rgba(16,185,129,0.1)', rowHover: 'rgba(16,185,129,0.06)' },
    dark: { accent: '#34d399', hover: '#6ee7b7', subtle: 'rgba(52,211,153,0.12)', rowHover: 'rgba(52,211,153,0.06)' },
  },
  {
    name: 'Teal',
    light: { accent: '#14b8a6', hover: '#0d9488', subtle: 'rgba(20,184,166,0.1)', rowHover: 'rgba(20,184,166,0.06)' },
    dark: { accent: '#2dd4bf', hover: '#5eead4', subtle: 'rgba(45,212,191,0.12)', rowHover: 'rgba(45,212,191,0.06)' },
  },
  {
    name: 'Cyan',
    light: { accent: '#06b6d4', hover: '#0891b2', subtle: 'rgba(6,182,212,0.1)', rowHover: 'rgba(6,182,212,0.06)' },
    dark: { accent: '#22d3ee', hover: '#67e8f9', subtle: 'rgba(34,211,238,0.12)', rowHover: 'rgba(34,211,238,0.06)' },
  },
];

const ACCENT_KEY = 'firebird-accent-color';

export function getAccentIndex(): number {
  const saved = localStorage.getItem(ACCENT_KEY);
  if (saved !== null) {
    const idx = parseInt(saved, 10);
    if (idx >= 0 && idx < ACCENT_COLORS.length) return idx;
  }
  return 0; // Blue default
}

export function setAccentIndex(index: number): void {
  localStorage.setItem(ACCENT_KEY, String(index));
}

export function applyAccentColor(index: number): void {
  const color = ACCENT_COLORS[index] ?? ACCENT_COLORS[0];
  const isDark = document.documentElement.classList.contains('dark');
  const palette = isDark ? color.dark : color.light;
  const root = document.documentElement;
  root.style.setProperty('--color-accent', palette.accent);
  root.style.setProperty('--color-accent-hover', palette.hover);
  root.style.setProperty('--color-accent-subtle', palette.subtle);
  root.style.setProperty('--color-row-hover', palette.rowHover);
}

// Apply on load
applyAccentColor(getAccentIndex());

// Re-apply when theme changes (dark class toggled)
const observer = new MutationObserver(() => {
  applyAccentColor(getAccentIndex());
});
observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
