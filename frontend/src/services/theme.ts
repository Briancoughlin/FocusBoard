export interface WindowsTheme {
  accentColor: string;
  isDark: boolean;
  source: string;
}

export async function fetchWindowsTheme(): Promise<WindowsTheme> {
  try {
    const res = await fetch('/api/theme', { credentials: 'include' });
    if (!res.ok) throw new Error('theme fetch failed');
    return await res.json();
  } catch {
    return { accentColor: '#0078d4', isDark: false, source: 'fallback' };
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function darken(hex: string, amount: number): string {
  const c = hexToRgb(hex);
  if (!c) return hex;
  const r = Math.max(0, c.r - amount);
  const g = Math.max(0, c.g - amount);
  const b = Math.max(0, c.b - amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function applyTheme(accent: string, isDark: boolean): void {
  const root = document.documentElement;

  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-light', `${accent}10`);
  root.style.setProperty('--accent-hover', darken(accent, 20));

  if (isDark) {
    root.style.setProperty('--bg', '#111827');
    root.style.setProperty('--bg-card', '#1f2937');
    root.style.setProperty('--bg-sidebar', '#1f2937');
    root.style.setProperty('--bg-header', '#1f2937');
    root.style.setProperty('--text-primary', '#f9fafb');
    root.style.setProperty('--text-secondary', '#9ca3af');
    root.style.setProperty('--border', '#374151');
  } else {
    root.style.setProperty('--bg', '#f9fafb');
    root.style.setProperty('--bg-card', '#ffffff');
    root.style.setProperty('--bg-sidebar', '#ffffff');
    root.style.setProperty('--bg-header', '#ffffff');
    root.style.setProperty('--text-primary', '#111827');
    root.style.setProperty('--text-secondary', '#6b7280');
    root.style.setProperty('--border', '#e5e7eb');
  }

  // Toggle dark class on html element for potential Tailwind dark: variants
  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}
