// Composición de una sesión de calentamiento (docs/MODOS.md 3.4) y su resumen final.
// Puro. En F4 la sesión usa los ejercicios fijos del prototipo: 5 de activación, 5 de
// la técnica del día y 3 remates. F5 añade niveles, diagnóstico y repaso.
import { DRILL_GROUPS, type BankDrill } from './drills';
import type { Tech } from './types';

export type BlockIndex = 0 | 1 | 2;
export type DayTech = Exclude<Tech, 'remate'>;

export const BLOCK_NAMES: Record<BlockIndex, string> = { 0: 'Activación', 1: 'Técnica del día', 2: 'Remate' };

export interface SessionItem {
  block: BlockIndex;
  bank: BankDrill;
}

export function composeSession(tech: DayTech): SessionItem[] {
  return [
    ...DRILL_GROUPS.activacion.map((bank) => ({ block: 0 as const, bank })),
    ...DRILL_GROUPS[tech].map((bank) => ({ block: 1 as const, bank })),
    ...DRILL_GROUPS.remate.map((bank) => ({ block: 2 as const, bank })),
  ];
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
  const blocks = ([0, 1, 2] as BlockIndex[]).map((b): [string, number, number] => {
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
