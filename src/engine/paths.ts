import type { Room } from './types';

/**
 * Enumera todos los recorridos posibles de longitud `hours` sobre el grafo:
 * en cada hora, cada recorrido se queda en la misma sala o cruza una puerta
 * (regla 1, §3). Los recorridos no dependen del sospechoso, solo del mapa y T.
 */
export function enumeratePaths(adj: number[][], roomCount: number, hours: number): Room[][] {
  const result: Room[][] = [];
  const extend = (path: Room[]): void => {
    if (path.length === hours) {
      result.push(path.slice());
      return;
    }
    const last = path[path.length - 1];
    for (const next of [last, ...adj[last]]) {
      path.push(next);
      extend(path);
      path.pop();
    }
  };
  for (let room = 0; room < roomCount; room++) extend([room]);
  return result;
}
