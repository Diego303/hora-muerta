// Persistencia (§18). Prefijo hm2:, siempre con try/catch y valores por defecto
// si falla (modo privado, cuota superada, localStorage inexistente...).
import type { DiffIndex } from '../engine/clues';
import type { Archetype, MapId } from '../engine/types';

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
  /** Ayuda de movimiento (§17.4, §11): `null` = usar el valor por defecto de
   * cada nivel (activada en Novato, desactivada en Inspector/Comisario) hasta
   * que la persona la toque a mano en Ajustes; a partir de ahí es explícita. */
  moveHelp: boolean | null;
  autoGrid: boolean;
  /** Tema alternativo del plano desbloqueado en el rango Cabo (§16.1): no es
   * un tercer tema de interfaz, solo recolorea el plano en tinta sepia. */
  planTheme: 'default' | 'sepia';
}

export const DEFAULT_SETTINGS: Settings = {
  theme: null,
  showTimer: false,
  trail: true,
  moveHelp: null,
  autoGrid: true,
  planTheme: 'default',
};

export function getSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...readJSON<Partial<Settings>>('settings', {}) };
}

export function saveSettings(settings: Settings): void {
  writeJSON('settings', settings);
}

/** §11: por defecto la ayuda de movimiento solo viene activada en Novato. */
export function effectiveMoveHelp(settings: Settings, diff: DiffIndex): boolean {
  return settings.moveHelp ?? diff === 0;
}

// =====================================================================
// Perfil y progresión (§16, §18).
// =====================================================================

export type LevelKey = 'n' | 'i' | 'c';

export const LEVEL_KEY_BY_DIFF: Record<DiffIndex, LevelKey> = { 0: 'n', 1: 'i', 2: 'c' };

export interface LevelStats {
  n: number;
  i: number;
  c: number;
}

/** Un ejemplo del caso donde se descubrió cada arquetipo por primera vez
 * (§16.2, "un caso de ejemplo para rejugar"); la tabla de `hm2:profile` del
 * §18 solo lista los recuentos, así que esto es una ampliación razonada del
 * esquema, documentada en DECISIONES.md. */
export interface ArchetypeExample {
  id: string;
  diff: DiffIndex;
  map: MapId;
}

export interface Profile {
  /** Estrellas totales que cuentan para el rango (§16.1): solo casos
   * resueltos desde que existe v2; los casos de v1 no tenían estrellas. */
  stars: number;
  rank: string;
  solved: LevelStats;
  perfect: LevelStats;
  firstTry: LevelStats;
  times: { n: number[]; i: number[]; c: number[] };
  arch: Record<Archetype, number>;
  archExample: Partial<Record<Archetype, ArchetypeExample>>;
  /** Expedientes completados (todas las noches jugadas, se archivara o no la última). */
  series: number;
  /** Casos resueltos en v1 antes de migrar (§18): un recuento sin desglose
   * por nivel ni estrellas, porque v1 no los guardaba; se muestra aparte en
   * el perfil, no se suma a `solved` ni a `stars`. */
  legacySolvedV1: number;
}

const EMPTY_LEVEL_STATS: LevelStats = { n: 0, i: 0, c: 0 };

const EMPTY_ARCH: Record<Archetype, number> = {
  coartada: 0,
  paso: 0,
  pareja: 0,
  recuento: 0,
  objeto: 0,
  vacia: 0,
  callejon: 0,
};

export const DEFAULT_PROFILE: Profile = {
  stars: 0,
  rank: 'agente',
  solved: { ...EMPTY_LEVEL_STATS },
  perfect: { ...EMPTY_LEVEL_STATS },
  firstTry: { ...EMPTY_LEVEL_STATS },
  times: { n: [], i: [], c: [] },
  arch: { ...EMPTY_ARCH },
  archExample: {},
  series: 0,
  legacySolvedV1: 0,
};

export function getProfile(): Profile {
  const saved = readJSON<Partial<Profile>>('profile', {});
  return {
    ...DEFAULT_PROFILE,
    ...saved,
    solved: { ...EMPTY_LEVEL_STATS, ...saved.solved },
    perfect: { ...EMPTY_LEVEL_STATS, ...saved.perfect },
    firstTry: { ...EMPTY_LEVEL_STATS, ...saved.firstTry },
    times: { n: saved.times?.n ?? [], i: saved.times?.i ?? [], c: saved.times?.c ?? [] },
    arch: { ...EMPTY_ARCH, ...saved.arch },
    archExample: { ...saved.archExample },
  };
}

export function saveProfile(profile: Profile): void {
  writeJSON('profile', profile);
}

/**
 * Migración desde v1 (§18): si existe `hm:stats` (sin el prefijo hm2:, es la
 * clave que usaba v1), se importa una sola vez. v1 no tenía estrellas ni
 * desglose por nivel, así que `solved` se guarda aparte en `legacySolvedV1`
 * (no cuenta para el rango); `daily` sí se importa a `hm2:daily` con las
 * estrellas recalculadas a partir de los errores (v1 nunca tuvo pistas, así
 * que hints=0 es un dato real, no inventado). El caso en curso de v1 no se
 * migra (§18). Se borra `hm:stats` al terminar para que no se repita.
 */
export function migrateFromV1(computeStars: (errors: number, hints: number) => number): void {
  try {
    const raw = localStorage.getItem('hm:stats');
    if (!raw) return;
    const v1 = JSON.parse(raw) as { solved?: number; daily?: Record<string, { time: number; errors: number }> };

    if (typeof v1.solved === 'number' && v1.solved > 0) {
      const profile = getProfile();
      saveProfile({ ...profile, legacySolvedV1: profile.legacySolvedV1 + v1.solved });
    }

    if (v1.daily) {
      const daily = readJSON<Record<string, { stars: number; errors: number; hints: number; time: number }>>('daily', {});
      for (const [dateKey, entry] of Object.entries(v1.daily)) {
        if (daily[dateKey]) continue; // ya hay un resultado de v2 ese día: no se pisa
        daily[dateKey] = { stars: computeStars(entry.errors, 0), errors: entry.errors, hints: 0, time: entry.time };
      }
      writeJSON('daily', daily);
    }

    localStorage.removeItem('hm:stats');
  } catch {
    // modo privado, cuota superada o hm:stats corrupto: se ignora sin migrar
  }
}
