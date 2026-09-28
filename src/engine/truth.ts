import type { Rng } from './rng';
import { pick, shuffle } from './rng';
import type { Graph, Hour, Room, Sus, Truth } from './types';

const STAY_PROBABILITY = 0.38;
const MAX_REJECTION_ATTEMPTS = 50;

/**
 * Paseo aleatorio de `length` horas desde `start`: en cada hora se queda con
 * probabilidad STAY_PROBABILITY o cruza una puerta al azar (§7.2, "paseo aleatorio").
 */
export function randomWalk(rng: Rng, adj: number[][], start: Room, length: number): Room[] {
  const path: Room[] = [start];
  while (path.length < length) {
    const last = path[path.length - 1];
    path.push(rng() < STAY_PROBABILITY ? last : pick(rng, adj[last]));
  }
  return path;
}

export interface NightPlan {
  rv: Room;
  td: Hour;
  culprit: Sus;
}

/** Elige sala y hora del crimen (entre la segunda y la última hora) y al culpable (§7.2). */
export function planNight(rng: Rng, roomCount: number, suspectCount: number, hours: number): NightPlan {
  return {
    rv: Math.floor(rng() * roomCount),
    td: 1 + Math.floor(rng() * (hours - 1)),
    culprit: Math.floor(rng() * suspectCount),
  };
}

/**
 * Genera los recorridos de la noche: el del culpable pasa por `rv` exactamente
 * a la hora `td` (regla 2, construido hacia delante y hacia atrás desde ahí);
 * el resto son paseos aleatorios que nunca coinciden con la víctima a esa hora.
 * Devuelve null si algún sospechoso no consigue un recorrido válido tras varios
 * intentos: el llamador debe reintentar con otro intento de la misma semilla.
 */
export function generateNight(
  rng: Rng,
  graph: Graph,
  roomCount: number,
  plan: NightPlan,
  suspectCount: number,
  hours: number,
): Room[][] | null {
  const rooms: (Room[] | null)[] = [];
  for (let c = 0; c < suspectCount; c++) {
    if (c === plan.culprit) {
      const forward = randomWalk(rng, graph.adj, plan.rv, hours - plan.td);
      const backward = randomWalk(rng, graph.adj, plan.rv, plan.td + 1).reverse();
      rooms.push(backward.slice(0, plan.td).concat(forward));
      continue;
    }
    let path: Room[] | null = null;
    for (let attempt = 0; attempt < MAX_REJECTION_ATTEMPTS; attempt++) {
      const candidate = randomWalk(rng, graph.adj, Math.floor(rng() * roomCount), hours);
      if (candidate[plan.td] !== plan.rv) {
        path = candidate;
        break;
      }
    }
    rooms.push(path);
  }
  return rooms.every((path): path is Room[] => path !== null) ? rooms : null;
}

/** Permutación aleatoria de los N objetos del caso: cada sospechoso lleva uno distinto (regla 3). */
export function generateObjectAssignment(rng: Rng, suspectCount: number): number[] {
  const identity = Array.from({ length: suspectCount }, (_, i) => i);
  return shuffle(rng, identity);
}

export function buildTruth(rooms: Room[][], objectAssignment: number[]): Truth {
  return { rooms, obj: objectAssignment };
}
