// Composición de una sesión de calentamiento (docs/MODOS.md 3.4 y 3.6) y su resumen
// final. Puro: recibe el banco y el progreso, y devuelve los ejercicios y el progreso
// con lo servido apuntado.
import { dueReviews, type DayTech, type Level } from './adapt';
import type { BankDrill } from './drills';
import { techProgress, type GymProgress } from './progress';
import type { Tech } from './types';

export type { DayTech };
export type BlockIndex = 0 | 1 | 2;
/** Diagnóstico: la primera vez. Remates: la sesión corta que se abre desde la hoja de acusación. */
export type SessionKind = 'diagnostico' | 'normal' | 'remates';

export const BLOCK_NAMES: Record<BlockIndex, string> = { 0: 'Activación', 1: 'Técnica del día', 2: 'Remate' };
export const BLOCK_SIZES: Record<BlockIndex, number> = { 0: 5, 1: 5, 2: 3 };
/** "Practicar remates" desde la hoja de acusación (MODOS 3.10.1). */
export const REMATES_SIZE = 5;
/** Repasos como mucho por bloque, para que no desplacen lo nuevo. */
export const REVIEWS_PER_BLOCK = 2;
const DIAGNOSTIC_TECHS: Tech[] = ['alcance', 'seguro', 'tabla', 'remate'];

export interface SessionItem {
  block: BlockIndex;
  bank: BankDrill;
  /** Vuelve porque se falló hace unas sesiones. */
  review?: boolean;
}

export interface SessionPlan {
  kind: SessionKind;
  tech: DayTech;
  items: SessionItem[];
  /** El progreso con los ejercicios servidos apuntados (se guarda al empezar). */
  progress: GymProgress;
}

const groupKey = (tech: Tech, level: number): string => `${tech}:${level}`;

/** Niveles del 1 al 3 ordenados por cercanía al pedido (a igual distancia, el más fácil). */
function levelsNear(level: Level): Level[] {
  return ([1, 2, 3] as Level[]).sort((a, b) => Math.abs(a - level) - Math.abs(b - level) || a - b);
}

/**
 * Elige ejercicios del banco sin repetir: dentro de la sesión nunca, y entre sesiones
 * no vuelve uno hasta agotar su grupo (técnica y nivel). Si al nivel pedido no queda
 * ninguno que sirva, se usa el nivel más cercano.
 */
class Picker {
  readonly used = new Set<string>();
  served: Record<string, string[]>;

  constructor(
    private readonly bank: readonly BankDrill[],
    served: Record<string, string[]>,
  ) {
    this.served = { ...served };
  }

  take(tech: Tech, level: Level, accept: (b: BankDrill) => boolean = () => true): BankDrill | null {
    for (const lv of levelsNear(level)) {
      const group = this.bank.filter((b) => b.drill.tech === tech && b.level === lv && accept(b) && !this.used.has(b.drill.id));
      if (group.length === 0) continue;
      const key = groupKey(tech, lv);
      let seen = this.served[key] ?? [];
      let fresh = group.filter((b) => !seen.includes(b.drill.id));
      if (fresh.length === 0) {
        // Grupo agotado: vuelve a empezar.
        seen = [];
        fresh = group;
      }
      const pick = fresh[0];
      this.served[key] = [...seen, pick.drill.id];
      this.used.add(pick.drill.id);
      return pick;
    }
    return null;
  }

  /** Un ejercicio concreto (un repaso), si sigue en el banco y no ha salido ya. */
  takeId(id: string): BankDrill | null {
    const found = this.bank.find((b) => b.drill.id === id);
    if (!found || this.used.has(id)) return null;
    this.used.add(id);
    return found;
  }
}

const levelOf = (progress: GymProgress, tech: Tech): Level => techProgress(progress, tech).level;
const isWarmUp = (b: BankDrill): boolean => b.drill.type === 'reach' || b.drill.type === 'tri';

/** Bloque en que vuelve un repaso: el de su técnica si es la del día o remate; si no, la activación. */
function reviewBlock(bank: BankDrill, tech: DayTech): BlockIndex {
  if (bank.drill.tech === 'remate') return 2;
  return bank.drill.tech === tech ? 1 : 0;
}

/**
 * Sesión de tres bloques (MODOS 3.4): activación con alcance y seguro (solo `reach` y
 * `tri`) a tu nivel menos 1; la técnica del día a tu nivel; remates a tu nivel de
 * remate. Los fallados vencidos vuelven primero, como mucho dos por bloque. La primera
 * vez es de diagnóstico: la activación trae 2 ejercicios de cada técnica, a nivel 1.
 * "Practicar remates" es un solo bloque de 5 remates.
 */
export function planSession(bank: readonly BankDrill[], progress: GymProgress, kind: SessionKind, tech: DayTech): SessionPlan {
  const picker = new Picker(bank, progress.served);
  const blocks: Record<BlockIndex, SessionItem[]> = { 0: [], 1: [], 2: [] };
  const push = (block: BlockIndex, b: BankDrill | null, review = false): void => {
    if (b) blocks[block].push(review ? { block, bank: b, review } : { block, bank: b });
  };

  if (kind === 'remates') {
    for (const id of dueReviews(progress)) {
      const b = bank.find((x) => x.drill.id === id);
      if (b?.drill.tech === 'remate' && blocks[2].length < REVIEWS_PER_BLOCK) push(2, picker.takeId(id), true);
    }
    while (blocks[2].length < REMATES_SIZE) {
      const b = picker.take('remate', levelOf(progress, 'remate'));
      if (!b) break;
      push(2, b);
    }
    return { kind, tech, items: blocks[2], progress: { ...progress, served: picker.served } };
  }

  // Repasos vencidos, cada uno en su bloque.
  for (const id of dueReviews(progress)) {
    const b = bank.find((x) => x.drill.id === id);
    if (!b) continue;
    const block = reviewBlock(b, tech);
    if (blocks[block].filter((i) => i.review).length < REVIEWS_PER_BLOCK) push(block, picker.takeId(id), true);
  }

  if (kind === 'diagnostico') {
    for (let round = 0; round < 2; round++) for (const t of DIAGNOSTIC_TECHS) push(0, picker.take(t, 1));
  } else {
    const warm: Tech[] = ['alcance', 'seguro'];
    for (let k = 0; blocks[0].length < BLOCK_SIZES[0] && k < BLOCK_SIZES[0] * 2; k++) {
      const t = warm[k % 2];
      push(0, picker.take(t, Math.max(1, levelOf(progress, t) - 1) as Level, isWarmUp));
    }
  }
  while (blocks[1].length < BLOCK_SIZES[1]) {
    const b = picker.take(tech, levelOf(progress, tech));
    if (!b) break;
    push(1, b);
  }
  while (blocks[2].length < BLOCK_SIZES[2]) {
    const b = picker.take('remate', levelOf(progress, 'remate'));
    if (!b) break;
    push(2, b);
  }
  return { kind, tech, items: [...blocks[0], ...blocks[1], ...blocks[2]], progress: { ...progress, served: picker.served } };
}

export interface SessionSummary {
  ok: number;
  total: number;
  /** Aciertos por bloque: [nombre, aciertos, ejercicios]. */
  blocks: [string, number, number][];
  /** Aciertos por técnica en esta sesión. */
  techs: Partial<Record<Tech, { ok: number; n: number }>>;
  /** Técnica más floja de la sesión (null si todo bien). */
  weakest: Tech | null;
}

export function summarize(items: readonly SessionItem[], results: readonly boolean[]): SessionSummary {
  const techs: SessionSummary['techs'] = {};
  items.forEach((item, i) => {
    if (results[i] === undefined) return;
    const t = (techs[item.bank.drill.tech] ??= { ok: 0, n: 0 });
    t.n += 1;
    if (results[i]) t.ok += 1;
  });
  const present = ([0, 1, 2] as BlockIndex[]).filter((b) => items.some((it) => it.block === b));
  const blocks = present.map((b): [string, number, number] => {
    const idx = items.map((it, i) => (it.block === b ? i : -1)).filter((i) => i >= 0);
    return [BLOCK_NAMES[b], idx.filter((i) => results[i] === true).length, idx.length];
  });
  const entries = Object.entries(techs) as [Tech, { ok: number; n: number }][];
  const failing = entries.filter(([, v]) => v.ok < v.n).sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n);
  return {
    ok: results.filter((r) => r === true).length,
    total: items.length,
    blocks,
    techs,
    weakest: failing.length ? failing[0][0] : null,
  };
}

/** Consejo para la próxima partida según la técnica más floja (textos del prototipo). */
export const TIPS: Record<Tech, string> = {
  alcance: 'Cuenta puertas, no distancia, y recuerda que también se puede quedar en la misma sala.',
  seguro: 'Antes de afirmar algo, pregúntate si hay otra forma de que encajen las pistas. Si la hay, no está demostrado.',
  tabla: 'Cada objeto lo lleva alguien: cuando a un objeto solo le queda una persona, o a una persona un objeto, ya lo tienes.',
  remate: 'Cuando te queden dos, relee las pistas sin tachar pensando en ellos, o supón que es uno y busca qué pista se rompe.',
};
