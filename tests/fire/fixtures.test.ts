import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { holds } from '../../src/engine/clues';
import { checkUnique, type SolveContext } from '../../src/engine/exact';
import { buildGraph } from '../../src/engine/graph';
import { solveHuman, type HumanContext } from '../../src/engine/human';
import { enumeratePaths } from '../../src/engine/paths';
import { MAPS } from '../../src/engine/content/maps';
import { clueRoom, doorDistances, fireTimes } from '../../src/modes/fire/timeline';
import type { FireCase } from '../../src/modes/fire/types';

const file = JSON.parse(readFileSync(path.join(process.cwd(), 'public', 'cases', 'incendio.json'), 'utf8')) as { cases: FireCase[] };

describe('casos de incendio de prueba (public/cases/incendio.json)', () => {
  it('son los dos casos del prototipo: Casa Valdemar (Novato) y Museo Aldana (Inspector exprés)', () => {
    expect(file.cases.map((c) => [c.caseData.map, c.fire.level, c.fire.title])).toEqual([
      ['mansion', 'Novato', 'Casa Valdemar en llamas'],
      ['museo', 'Inspector exprés', 'Museo Aldana en llamas'],
    ]);
  });

  it.each(file.cases.map((c) => [c.caseData.id, c] as const))('%s: los tiempos guardados son los que sale de la fórmula desde el foco', (_id, fixture) => {
    const map = MAPS.find((m) => m.id === fixture.caseData.map);
    if (!map) throw new Error('mapa desconocido');
    const graph = buildGraph(map);
    const times = fireTimes({
      adj: graph.adj,
      origin: fixture.fire.origin,
      crime: fixture.caseData.rv,
      clueRooms: fixture.caseData.clues.map(clueRoom),
    });
    expect(fixture.fire.ign).toEqual(times.ign);
    expect(fixture.fire.burnAt).toEqual(times.burnAt);
  });

  it.each(file.cases.map((c) => [c.caseData.id, c] as const))('%s: el foco está a dos puertas o más de la escena (MODOS 2.5.1)', (_id, fixture) => {
    const map = MAPS.find((m) => m.id === fixture.caseData.map);
    if (!map) throw new Error('mapa desconocido');
    const distance = doorDistances(buildGraph(map).adj, fixture.fire.origin)[fixture.caseData.rv];
    expect(distance).toBeGreaterThanOrEqual(2);
  });

  it.each(file.cases.map((c) => [c.caseData.id, c] as const))('%s: cada pista es verdad, el puzle tiene una única solución y el solver humano lo resuelve', (_id, fixture) => {
    const { caseData } = fixture;
    const map = MAPS.find((m) => m.id === caseData.map);
    if (!map) throw new Error('mapa desconocido');
    const graph = buildGraph(map);
    expect(caseData.clues.every((clue) => holds(clue, caseData.truth, graph))).toBe(true);

    const paths = enumeratePaths(graph.adj, map.rooms.length, caseData.T);
    const ctx: SolveContext = { N: caseData.N, T: caseData.T, paths, rv: caseData.rv, td: caseData.td, graph };
    expect(checkUnique(ctx, caseData.culprit, caseData.weapon, caseData.clues).status).toBe('unique');

    const human: HumanContext = { N: caseData.N, T: caseData.T, graph, rv: caseData.rv, td: caseData.td };
    const solved = solveHuman(human, caseData.clues);
    expect(solved).not.toBeNull();
    expect(solved?.maxLv).toBe(caseData.solve.maxLv);
  });

  it('no tienen más pistas que el tope del modo (9)', () => {
    for (const fixture of file.cases) expect(fixture.caseData.clues.length).toBeLessThanOrEqual(9);
  });
});
