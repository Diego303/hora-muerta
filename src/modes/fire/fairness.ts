// Banco del Modo Incendio (docs/MODOS.md 2.4 y 2.5): elección determinista del foco
// y garantías de justicia. Funciones puras: las usan el generador, el validador y
// las pruebas, así que no pueden divergir.
import type { CaseDef, Room } from '../../engine/types';
import { doorDistances } from './timeline';

/** Garantías de MODOS 2.5.4, por orden. */
export type Guarantee = 'foco' | 'lectura' | 'ritmo' | 'cadena' | 'puntuacion';

export const GUARANTEES: Guarantee[] = ['foco', 'lectura', 'ritmo', 'cadena', 'puntuacion'];

export const GUARANTEE_TEXT: Record<Guarantee, string> = {
  foco: 'El foco está a 2 puertas o más de la escena del crimen',
  lectura: 'Cada pista es legible durante al menos 90 s',
  ritmo: 'Como mucho el 40 % de las pistas arde antes de 2:30',
  cadena: 'Al menos la mitad de las pistas de la cadena crítica arde después de 2:30',
  puntuacion: 'La puntuación está en el tercio bajo o medio de la banda del nivel',
};

export const FAIR_MIN_ORIGIN_DOORS = 2;
export const FAIR_MIN_READ_S = 90;
export const FAIR_PACE_S = 150;
export const FAIR_MAX_EARLY_SHARE = 0.4;
export const FAIR_MIN_LATE_CHAIN_SHARE = 0.5;

/**
 * Foco (MODOS 2.5.2): la sala más alejada en puertas de la escena del crimen. En
 * empate, la que tenga más pistas ancladas a salas de distancia intermedia desde
 * ella (ni el propio foco ni las salas más lejanas, D9): así el fuego quema pistas
 * de forma gradual en vez de todas al principio o todas al final. Después, por índice.
 */
export function chooseOrigin(adj: readonly (readonly number[])[], crime: Room, clueRooms: readonly (Room | null)[]): Room {
  const fromCrime = doorDistances(adj, crime);
  const farthest = Math.max(...fromCrime);
  let best: Room = -1;
  let bestScore = -1;
  for (let room = 0; room < adj.length; room++) {
    if (fromCrime[room] !== farthest) continue;
    const fromRoom = doorDistances(adj, room);
    const reach = Math.max(...fromRoom);
    const score = clueRooms.filter((r) => r !== null && fromRoom[r] >= 1 && fromRoom[r] <= reach - 1).length;
    if (score > bestScore) {
      best = room;
      bestScore = score;
    }
  }
  return best;
}

/** Pistas que usa la cadena crítica del solver humano (sin repetir, en orden). */
export function criticalClues(caseData: CaseDef): number[] {
  return [...new Set(caseData.solve.steps.flatMap((s) => s.cl))].sort((a, b) => a - b);
}

export interface FairnessInput {
  adj: readonly (readonly number[])[];
  origin: Room;
  crime: Room;
  burnAt: readonly number[];
  critical: readonly number[];
  score: number;
  band: readonly [number, number];
}

/** Garantías que el caso NO cumple (vacío: el caso es justo). */
export function fairnessFailures(input: FairnessInput): Guarantee[] {
  const failed: Guarantee[] = [];
  if (doorDistances(input.adj, input.origin)[input.crime] < FAIR_MIN_ORIGIN_DOORS) failed.push('foco');
  if (input.burnAt.some((at) => at < FAIR_MIN_READ_S)) failed.push('lectura');
  const early = input.burnAt.filter((at) => at < FAIR_PACE_S).length;
  if (early > FAIR_MAX_EARLY_SHARE * input.burnAt.length) failed.push('ritmo');
  const late = input.critical.filter((i) => input.burnAt[i] > FAIR_PACE_S).length;
  if (late < FAIR_MIN_LATE_CHAIN_SHARE * input.critical.length) failed.push('cadena');
  const [lo, hi] = input.band;
  if (input.score > lo + ((hi - lo) * 2) / 3) failed.push('puntuacion');
  return failed;
}
