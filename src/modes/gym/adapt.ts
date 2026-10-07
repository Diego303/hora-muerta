// Adaptación del calentamiento (docs/MODOS.md 3.6): niveles por técnica, técnica del
// día, repaso de fallados y racha. Funciones puras: reciben el progreso y devuelven
// uno nuevo, sin tocar el almacenamiento.
import type { Drill, Tech } from './types';
import { techProgress, type GymProgress, type TechProgress } from './progress';

export const HIST_SIZE = 20;
export const SESSIONS_KEPT = 30;
/** Ventana para subir o bajar de nivel. */
export const LEVEL_WINDOW = 10;
export const LEVEL_UP_AT = 8;
export const LEVEL_DOWN_AT = 4;
/** Un fallo vuelve como repaso 3 sesiones después. */
export const REVIEW_AFTER = 3;
/** "No se repite la del día anterior salvo que esté más de 15 puntos por debajo de la siguiente". */
export const REPEAT_MARGIN = 15;

/** Técnicas que pueden ser "técnica del día" (los remates tienen su propio bloque). */
export const DAY_TECHS = ['seguro', 'tabla', 'alcance'] as const;
export type DayTech = (typeof DAY_TECHS)[number];

export type Level = 1 | 2 | 3;

/**
 * Nivel de un ejercicio según la tabla de MODOS 3.6: 3 si hay hipótesis o tres pistas
 * o más; 2 si hay dos pistas, o un salto de dos horas; 1 en otro caso. Cuentan las
 * pistas que hay que usar: lo que se sabe, los hechos y, en los remates, las pistas
 * que aún no se han usado.
 */
export function drillLevel(drill: Drill): Level {
  if (drill.type === 'contra') return 3;
  const clues = drill.given.length + drill.facts.length + drill.clues.filter((_, i) => !drill.used[i]).length;
  if (clues >= 3) return 3;
  let hops = 1;
  const ask = drill.ask;
  if (drill.type === 'reach' && ask && ask.c !== null && ask.t !== null) {
    const { c, t } = ask;
    for (const k of [...drill.given, ...drill.facts]) if (k.k === 'at' && k.c === c) hops = Math.max(hops, Math.abs(k.t - t));
  }
  return clues === 2 || hops >= 2 ? 2 : 1;
}

/** Acierto (0 a 1) en los últimos 20, o null si no hay respuestas. */
export function recentRate(tp: TechProgress): number | null {
  return tp.hist.length === 0 ? null : tp.hist.reduce<number>((a, b) => a + b, 0) / tp.hist.length;
}

/** Registra una respuesta; si toca, sube o baja de nivel (y empieza a contar de nuevo). */
export function withAnswer(progress: GymProgress, tech: Tech, ok: boolean): { progress: GymProgress; levelChange: [Level, Level] | null } {
  const prev = techProgress(progress, tech);
  const hist = [...prev.hist, ok ? (1 as const) : (0 as const)].slice(-HIST_SIZE);
  let next: TechProgress = { level: prev.level, hist, ok: prev.ok + (ok ? 1 : 0), n: prev.n + 1, atLevel: prev.atLevel + 1 };
  let levelChange: [Level, Level] | null = null;
  if (next.atLevel >= LEVEL_WINDOW) {
    const lastTen = hist.slice(-LEVEL_WINDOW).reduce<number>((a, b) => a + b, 0);
    const target: Level = lastTen >= LEVEL_UP_AT ? (Math.min(3, next.level + 1) as Level) : lastTen <= LEVEL_DOWN_AT ? (Math.max(1, next.level - 1) as Level) : next.level;
    if (target !== next.level) {
      levelChange = [next.level, target];
      next = { ...next, level: target, atLevel: 0 };
    }
  }
  return { progress: { ...progress, tech: { ...progress.tech, [tech]: next } }, levelChange };
}

/**
 * Técnica del día: primero las que no se han practicado (en orden seguro, tabla,
 * alcance); después, la de menor acierto en sus últimos 20. La del día anterior no se
 * repite salvo que su acierto esté más de 15 puntos por debajo de la siguiente.
 */
export function techOfDay(progress: GymProgress, today: string): { tech: DayTech; why: string } {
  const untried = DAY_TECHS.find((t) => techProgress(progress, t).n === 0);
  if (untried) return { tech: untried, why: 'Todavía no la has practicado.' };

  // En puntos enteros, para que "más de 15 puntos" no dependa de redondeos.
  const rate = (t: DayTech): number => Math.round((recentRate(techProgress(progress, t)) ?? 0) * 100);
  const ranked = [...DAY_TECHS].sort((a, b) => rate(a) - rate(b) || techProgress(progress, a).n - techProgress(progress, b).n);
  // Las sesiones solo de remates no tienen técnica del día.
  const previous = [...progress.sessions].reverse().find((s) => s.date < today && s.tech !== 'remate')?.tech;
  let pick = ranked[0];
  if (pick === previous) {
    const second = ranked[1];
    if (rate(second) - rate(pick) <= REPEAT_MARGIN) pick = second;
  }
  const pct = rate(pick);
  const why = pick === ranked[0] ? `Es tu técnica con menos aciertos (${pct} %).` : `La siguiente con menos aciertos (${pct} %); la otra ya la practicaste en tu último calentamiento.`;
  return { tech: pick, why };
}

/** Un fallo vuelve a las `REVIEW_AFTER` sesiones; un acierto lo saca del repaso. */
export function withReview(progress: GymProgress, drillId: string, ok: boolean): GymProgress {
  const rest = progress.review.filter((r) => r.id !== drillId);
  if (ok) return { ...progress, review: rest };
  return { ...progress, review: [...rest, { id: drillId, due: progress.done + REVIEW_AFTER }] };
}

export function dueReviews(progress: GymProgress): string[] {
  return progress.review.filter((r) => r.due <= progress.done).map((r) => r.id);
}

function previousDay(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Racha de días con calentamiento: sigue si el último fue ayer, se queda igual si fue hoy. */
export function withStreak(progress: GymProgress, today: string): GymProgress {
  const { last, count, best } = progress.streak;
  if (last === today) return progress;
  const next = last === previousDay(today) ? count + 1 : 1;
  return { ...progress, streak: { last: today, count: next, best: Math.max(best, next) } };
}

export function withSession(progress: GymProgress, record: { date: string; score: number; n: number; tech: Tech }): GymProgress {
  return withStreak({ ...progress, done: progress.done + 1, sessions: [...progress.sessions, record].slice(-SESSIONS_KEPT) }, record.date);
}

/** Primera vez en la Academia: la sesión es de diagnóstico. */
export function isFirstTime(progress: GymProgress): boolean {
  return progress.done === 0 && Object.values(progress.tech).every((t) => !t || t.n === 0);
}
