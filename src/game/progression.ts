// Progresión (§16): rango por estrellas, desbloqueo de escenarios y archivo
// de arquetipos. Sin DOM: funciones puras sobre un Profile, igual que
// scoring.ts es puro sobre un GameState.
import type { DiffIndex } from '../engine/clues';
import type { Archetype, CaseDef, Unlock } from '../engine/types';
import type { ArchetypeExample, LevelKey, Profile } from './storage';
import { LEVEL_KEY_BY_DIFF } from './storage';

export type RankId = 'agente' | 'cabo' | 'detective' | 'inspector' | 'inspector_jefe' | 'comisario';

export interface RankDef {
  id: RankId;
  name: string;
  stars: number;
}

/** §16.1: agente (0) es el rango de partida; el resto se sube por estrellas
 * acumuladas. `RankDef.id` coincide con `MapDef.unlock` para poder comparar
 * directamente sin una tabla de traducción aparte. */
export const RANKS: RankDef[] = [
  { id: 'agente', name: 'Agente', stars: 0 },
  { id: 'cabo', name: 'Cabo', stars: 10 },
  { id: 'detective', name: 'Detective', stars: 30 },
  { id: 'inspector', name: 'Inspector', stars: 75 },
  { id: 'inspector_jefe', name: 'Inspector jefe', stars: 150 },
  { id: 'comisario', name: 'Comisario', stars: 300 },
];

const RANK_ORDER: Record<RankId, number> = Object.fromEntries(RANKS.map((r, i) => [r.id, i])) as Record<RankId, number>;

export function rankForStars(stars: number): RankDef {
  let current = RANKS[0];
  for (const rank of RANKS) {
    if (stars >= rank.stars) current = rank;
  }
  return current;
}

/** Rango actual y lo que falta para el siguiente (barra de rango, portada/perfil, §17.2). */
export function rankProgress(stars: number): { rank: RankDef; next: RankDef | null; starsToNext: number } {
  const rank = rankForStars(stars);
  const idx = RANK_ORDER[rank.id];
  const next = RANKS[idx + 1] ?? null;
  return { rank, next, starsToNext: next ? next.stars - stars : 0 };
}

/** §16.1: los niveles de dificultad están siempre disponibles; solo los
 * escenarios (`MapDef.unlock`) dependen del rango. 'start' es el único valor
 * que no coincide con un id de RANKS. */
export function isMapUnlocked(unlock: Unlock, stars: number): boolean {
  if (unlock === 'start') return true;
  return stars >= (RANKS.find((r) => r.id === unlock)?.stars ?? Infinity);
}

/** Para cosas que no son un escenario (p. ej. el tema sepia de Cabo, §16.1). */
export function hasReachedRank(stars: number, rankId: RankId): boolean {
  return stars >= (RANKS.find((r) => r.id === rankId)?.stars ?? Infinity);
}

export const ARCHETYPE_LABELS: Record<Archetype, string> = {
  coartada: 'La coartada imposible',
  paso: 'El paso obligado',
  pareja: 'La pareja inseparable',
  recuento: 'El recuento',
  objeto: 'La cadena del objeto',
  vacia: 'La sala vacía',
  callejon: 'El callejón sin salida',
};

/** Orden fijo del §10.2, para listar el archivo de arquetipos siempre igual. */
export const ARCHETYPE_ORDER: Archetype[] = ['coartada', 'paso', 'pareja', 'recuento', 'objeto', 'vacia', 'callejon'];

export interface ClosureRecord {
  caseData: CaseDef;
  stars: number;
  errors: number;
  elapsed: number;
}

export interface RecordClosureResult {
  profile: Profile;
  /** Arquetipos de este caso que no se habían visto antes (para el aviso "Nuevo en tu archivo…", §16.2). */
  newArchetypes: Archetype[];
}

/** Registra un caso RESUELTO en el perfil (§16): estrellas, rango, recuentos
 * por nivel, tiempo y arquetipos. Los casos archivados sin resolver no
 * cuentan para nada de esto. */
export function recordClosure(profile: Profile, record: ClosureRecord): RecordClosureResult {
  const level: LevelKey = LEVEL_KEY_BY_DIFF[record.caseData.diff as DiffIndex];
  const stars = profile.stars + record.stars;

  const solved = { ...profile.solved, [level]: profile.solved[level] + 1 };
  const perfect = record.stars >= 3 ? { ...profile.perfect, [level]: profile.perfect[level] + 1 } : profile.perfect;
  const firstTry = record.errors === 0 ? { ...profile.firstTry, [level]: profile.firstTry[level] + 1 } : profile.firstTry;
  const times = { ...profile.times, [level]: [...profile.times[level], record.elapsed] };

  const arch = { ...profile.arch };
  const archExample = { ...profile.archExample };
  const newArchetypes: Archetype[] = [];
  for (const archetype of new Set(record.caseData.solve.arch)) {
    if (arch[archetype] === 0) {
      newArchetypes.push(archetype);
      const example: ArchetypeExample = { id: record.caseData.id, diff: record.caseData.diff, map: record.caseData.map };
      archExample[archetype] = example;
    }
    arch[archetype] += 1;
  }

  const profileOut: Profile = {
    ...profile,
    stars,
    rank: rankForStars(stars).id,
    solved,
    perfect,
    firstTry,
    times,
    arch,
    archExample,
  };
  return { profile: profileOut, newArchetypes };
}

/** Tiempo mediano (§16.3), en segundos; `null` si no hay ninguna muestra todavía. */
export function medianTime(times: number[]): number | null {
  if (times.length === 0) return null;
  const sorted = [...times].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export interface DailyStreak {
  current: number;
  best: number;
}

/** Racha de casos del día consecutivos (§16.3), calculada a partir de las
 * fechas guardadas en hm2:daily en vez de un contador aparte, para que no
 * pueda desincronizarse. `today` en UTC (mismo criterio que dailyIndex, §13). */
export function computeDailyStreak(dailyDateKeys: string[], today: string): DailyStreak {
  const days = new Set(dailyDateKeys);
  const addDaysUTC = (key: string, delta: number): string => {
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + delta));
    return date.toISOString().slice(0, 10);
  };

  let current = 0;
  if (days.size > 0) {
    let cursor = days.has(today) ? today : addDaysUTC(today, -1);
    while (days.has(cursor)) {
      current += 1;
      cursor = addDaysUTC(cursor, -1);
    }
  }

  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const key of sorted) {
    run = prev !== null && addDaysUTC(prev, 1) === key ? run + 1 : 1;
    best = Math.max(best, run);
    prev = key;
  }

  return { current, best: Math.max(best, current) };
}
