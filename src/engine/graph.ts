import type { FloorPlan, Graph } from './types';

/** Construye el grafo (adyacencia, matriz, rasgos, distancias) a partir de un plano. */
export function buildGraph(map: FloorPlan): Graph {
  const n = map.rooms.length;
  const index = new Map<string, number>(map.rooms.map((room, i) => [room.id, i]));

  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const [a, b] of map.edges) {
    const ia = index.get(a);
    const ib = index.get(b);
    if (ia === undefined || ib === undefined) throw new Error(`Arista con sala desconocida en ${map.id}: ${a}-${b}`);
    adj[ia].push(ib);
    adj[ib].push(ia);
  }

  const adjM: boolean[][] = Array.from({ length: n }, () => new Array<boolean>(n).fill(false));
  for (let i = 0; i < n; i++) for (const j of adj[i]) adjM[i][j] = true;

  const feat: boolean[][] = map.rooms.map((room) => map.features.map((feature) => room.f.includes(feature.id)));

  const dist: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(Infinity));
  for (let start = 0; start < n; start++) {
    dist[start][start] = 0;
    const queue: number[] = [start];
    let head = 0;
    while (head < queue.length) {
      const current = queue[head];
      head += 1;
      for (const next of adj[current]) {
        if (dist[start][next] === Infinity) {
          dist[start][next] = dist[start][current] + 1;
          queue.push(next);
        }
      }
    }
  }

  return { adj, adjM, feat, dist };
}
