// Línea de tiempo del Modo Incendio (docs/MODOS.md 2.2 y 2.3). Funciones puras, sin
// DOM ni estado acumulado: el mismo `t` da siempre la misma imagen. `t` son los
// segundos consumidos; `ign` y `burnAt` vienen precalculados por caso.
import type { Clue, Room } from '../../engine/types';
import {
  FIRE_BURN_ANIM_S,
  FIRE_CLUE_DELAY_S,
  FIRE_CLUE_WARNING_S,
  FIRE_IGNITION_S,
  FIRE_ROOMLESS_CLUE_S,
  FIRE_SCENE_MIN_S,
  FIRE_STEP_S,
  FIRE_WARNING_S,
} from './config';

export type RoomFire = 'cold' | 'heat' | 'burning';
export type ClueFire = 'ok' | 'heat' | 'burning' | 'burnt' | 'saved';

/** Segundo de ignición de cada sala, y segundo de quemado de cada pista (índice = Room o Clue). */
export interface FireTimes {
  ign: number[];
  burnAt: number[];
}

export function roomState(ign: readonly number[], room: Room, t: number): RoomFire {
  if (t >= ign[room]) return 'burning';
  if (t >= ign[room] - FIRE_WARNING_S) return 'heat';
  return 'cold';
}

/** La sala que nombra una pista, o null si no nombra ninguna (rasgos, encuentros, portadores...). */
export function clueRoom(clue: Clue): Room | null {
  return 'r' in clue ? clue.r : null;
}

/** Segundo en que arde una pista. Una pista fotografiada nunca arde. */
export function clueBurnAt(ign: readonly number[], room: Room | null, saved: boolean): number {
  if (saved) return Infinity;
  return room !== null ? ign[room] + FIRE_CLUE_DELAY_S : FIRE_ROOMLESS_CLUE_S;
}

export function clueState(burnAt: number, t: number, saved: boolean): ClueFire {
  if (saved) return 'saved';
  if (t >= burnAt + FIRE_BURN_ANIM_S) return 'burnt';
  if (t >= burnAt) return 'burning';
  return burnAt - t <= FIRE_CLUE_WARNING_S ? 'heat' : 'ok';
}

export interface FireInput {
  /** Lista de adyacencia del plano (puertas), como la de `buildGraph`. */
  adj: readonly (readonly number[])[];
  origin: Room;
  /** Sala del crimen: aguanta hasta el mínimo de la escena. */
  crime: Room;
  /** Sala que nombra cada pista, en el orden de `caseData.clues`. */
  clueRooms: readonly (Room | null)[];
}

/** Distancias en puertas desde `origin` (BFS). -1 si no hay camino. */
export function doorDistances(adj: readonly (readonly number[])[], origin: Room): number[] {
  const dist = adj.map(() => -1);
  dist[origin] = 0;
  const queue: number[] = [origin];
  // for...of sobre un array que crece recorre también lo que se añade: es una cola BFS.
  for (const room of queue) {
    for (const next of adj[room]) {
      if (dist[next] < 0) {
        dist[next] = dist[room] + 1;
        queue.push(next);
      }
    }
  }
  return dist;
}

/** Tiempos de todo el edificio a partir del foco (MODOS 2.2 y 2.5.3). */
export function fireTimes(input: FireInput): FireTimes {
  const dist = doorDistances(input.adj, input.origin);
  const ign = dist.map((d, room) => {
    if (d < 0) return Infinity;
    const base = FIRE_IGNITION_S + FIRE_STEP_S * d;
    return room === input.crime ? Math.max(FIRE_SCENE_MIN_S, base) : base;
  });
  const burnAt = input.clueRooms.map((room) => clueBurnAt(ign, room, false));
  return { ign, burnAt };
}
