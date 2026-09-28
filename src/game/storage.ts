// Persistencia (§18). Prefijo hm2:, siempre con try/catch y valores por defecto
// si falla (modo privado, cuota superada, localStorage inexistente...).

const PREFIX = 'hm2:';

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // almacenamiento no disponible: se ignora, el estado sigue en memoria
  }
}

export interface Settings {
  theme: 'light' | 'dark' | null;
  showTimer: boolean;
  trail: boolean;
  moveHelp: boolean;
  autoGrid: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: null,
  showTimer: false,
  trail: true,
  moveHelp: false,
  autoGrid: true,
};

export function getSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...readJSON<Partial<Settings>>('settings', {}) };
}

export function saveSettings(settings: Settings): void {
  writeJSON('settings', settings);
}
