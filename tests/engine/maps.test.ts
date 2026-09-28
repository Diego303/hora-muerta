import { describe, expect, it } from 'vitest';
import { buildGraph } from '../../src/engine/graph';
import { MAPS } from '../../src/engine/content/maps';
import type { MapDef, RoomDef } from '../../src/engine/types';

function rect(room: RoomDef): { x0: number; y0: number; x1: number; y1: number } {
  return { x0: room.x, y0: room.y, x1: room.x + room.w, y1: room.y + room.h };
}

function overlaps(a: RoomDef, b: RoomDef): boolean {
  const ra = rect(a);
  const rb = rect(b);
  return ra.x0 < rb.x1 && rb.x0 < ra.x1 && ra.y0 < rb.y1 && rb.y0 < ra.y1;
}

function sharesWall(a: RoomDef, b: RoomDef): boolean {
  const ra = rect(a);
  const rb = rect(b);
  const verticalWall = (ra.x1 === rb.x0 || rb.x1 === ra.x0) && Math.min(ra.y1, rb.y1) > Math.max(ra.y0, rb.y0);
  const horizontalWall = (ra.y1 === rb.y0 || rb.y1 === ra.y0) && Math.min(ra.x1, rb.x1) > Math.max(ra.x0, rb.x0);
  return verticalWall || horizontalWall;
}

function isConnected(map: MapDef): boolean {
  const graph = buildGraph(map);
  const n = map.rooms.length;
  const visited = new Array<boolean>(n).fill(false);
  visited[0] = true;
  const stack = [0];
  let count = 1;
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) break;
    for (const next of graph.adj[current]) {
      if (!visited[next]) {
        visited[next] = true;
        count += 1;
        stack.push(next);
      }
    }
  }
  return count === n;
}

/** La única excepción a "toda puerta comparte pared": la pasarela del tren (§17.4, Apéndice A.2). */
const KNOWN_GAPS: Partial<Record<MapDef['id'], [string, string][]>> = {
  tren: [['coc', 'cma']],
};

describe('geometría de los 6 mapas (Apéndice A)', () => {
  it('hay exactamente 6 mapas, cada uno con id único', () => {
    expect(MAPS.length).toBe(6);
    expect(new Set(MAPS.map((m) => m.id)).size).toBe(6);
  });

  for (const map of MAPS) {
    describe(map.name, () => {
      it('cada sala mide al menos 3 de ancho y 2 de alto, dentro de la rejilla 12×9', () => {
        for (const room of map.rooms) {
          expect(room.w).toBeGreaterThanOrEqual(3);
          expect(room.h).toBeGreaterThanOrEqual(2);
          expect(room.x + room.w).toBeLessThanOrEqual(map.w);
          expect(room.y + room.h).toBeLessThanOrEqual(map.h);
        }
      });

      it('ninguna sala se solapa con otra', () => {
        for (let i = 0; i < map.rooms.length; i++) {
          for (let j = i + 1; j < map.rooms.length; j++) {
            expect(overlaps(map.rooms[i], map.rooms[j])).toBe(false);
          }
        }
      });

      it('cada puerta une salas que comparten pared, salvo la pasarela conocida', () => {
        const gaps = KNOWN_GAPS[map.id] ?? [];
        const byId = new Map(map.rooms.map((r) => [r.id, r]));
        for (const [a, b] of map.edges) {
          const isKnownGap = gaps.some(([ga, gb]) => (ga === a && gb === b) || (ga === b && gb === a));
          const roomA = byId.get(a);
          const roomB = byId.get(b);
          expect(roomA).toBeDefined();
          expect(roomB).toBeDefined();
          if (!roomA || !roomB) continue;
          expect(sharesWall(roomA, roomB) || isKnownGap).toBe(true);
        }
      });

      it('el grafo es conexo: todas las salas son alcanzables', () => {
        expect(isConnected(map)).toBe(true);
      });
    });
  }
});
