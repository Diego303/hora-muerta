// Integración del calentamiento con la partida normal (docs/MODOS.md 3.10). Puro: lo
// usan la hoja de acusación y el cierre del caso.
import type { Archetype, CaseDef, Sus } from '../../engine/types';
import { markKey, type MarkValue } from '../../game/store';
import type { Tech } from './types';

/** Protocolo de "¿Te quedan dos?" (MODOS 3.10.1), en este orden. */
export const TWO_LEFT_STEPS = [
  '¿Hay pistas sin tachar? Reléelas pensando solo en esos dos.',
  'Supón que es el primero: sigue su noche hora a hora. ¿Rompe alguna pista?',
  'Mira sus objetos posibles en la tabla: ¿alguno queda sin dueño?',
  'Revisa los recuentos y los rasgos de sala.',
  'Mira de dónde pudo venir cada uno una hora antes del crimen.',
] as const;

/**
 * Sospechosos que siguen en pie según tus descartes o tus marcas: no descartados y sin
 * ✗ en la sala del crimen a la hora del crimen (quien no estaba allí no pudo ser).
 */
export function remainingSuspects(caseData: Pick<CaseDef, 'N' | 'rv' | 'td'>, discarded: ReadonlySet<Sus>, marks: ReadonlyMap<string, MarkValue>): Sus[] {
  const left: Sus[] = [];
  for (let c = 0; c < caseData.N; c++) {
    if (discarded.has(c) || marks.get(markKey(caseData.td, caseData.rv, c)) === 2) continue;
    left.push(c);
  }
  return left;
}

/** Técnica que conviene practicar según el arquetipo de la deducción clave (MODOS 3.10.2). */
const ARCH_TECH: Partial<Record<Archetype, Tech>> = {
  coartada: 'alcance',
  paso: 'alcance',
  objeto: 'tabla',
  pareja: 'seguro',
  recuento: 'seguro',
  callejon: 'remate',
};

/** La primera técnica que corresponda a los arquetipos del caso (el primero es el de la clave); null si ninguno está en la tabla. */
export function suggestTech(arch: readonly Archetype[]): { tech: Tech; arch: Archetype } | null {
  for (const a of arch) {
    const tech = ARCH_TECH[a];
    if (tech) return { tech, arch: a };
  }
  return null;
}
