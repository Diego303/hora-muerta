// El grupo "incendio" del banco (public/cases/incendio.json, docs/MODOS.md 2.4 y 2.5).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { holds } from '../../src/engine/clues';
import { checkUnique, type SolveContext } from '../../src/engine/exact';
import { buildGraph } from '../../src/engine/graph';
import { solveHuman, type HumanContext } from '../../src/engine/human';
import { enumeratePaths } from '../../src/engine/paths';
import { MAPS } from '../../src/engine/content/maps';
import type { FireCase } from '../../src/modes/fire/types';
import { FIRE_GROUPS } from '../../scripts/bank.config';
import { fireCaseErrors } from '../../scripts/fire-bank';

const file = JSON.parse(readFileSync(path.join(process.cwd(), 'public', 'cases', 'incendio.json'), 'utf8')) as { cases: FireCase[] };
const byId = file.cases.map((c) => [c.caseData.id, c] as const);

describe('banco del Modo Incendio', () => {
  it('tiene el cupo de cada nivel: 20 Novato y 20 Inspector exprés', () => {
    for (const g of FIRE_GROUPS) expect(file.cases.filter((c) => c.fire.level === g.level)).toHaveLength(g.count);
  });

  it('ids y firmas sin repetir', () => {
    expect(new Set(file.cases.map((c) => c.caseData.id)).size).toBe(file.cases.length);
    expect(new Set(file.cases.map((c) => c.caseData.sig)).size).toBe(file.cases.length);
  });

  it.each(byId)('%s: foco, tiempos, textos y garantías de justicia', (_id, fire) => {
    expect(fireCaseErrors(fire)).toEqual([]);
  });

  it.each(byId)('%s: pistas verdaderas, solución única y resoluble por el solver humano', (_id, fire) => {
    const { caseData } = fire;
    const map = MAPS.find((m) => m.id === caseData.map);
    if (!map) throw new Error('mapa desconocido');
    const graph = buildGraph(map);
    expect(caseData.clues.every((clue) => holds(clue, caseData.truth, graph))).toBe(true);
    const paths = enumeratePaths(graph.adj, map.rooms.length, caseData.T);
    const ctx: SolveContext = { N: caseData.N, T: caseData.T, paths, rv: caseData.rv, td: caseData.td, graph };
    expect(checkUnique(ctx, caseData.culprit, caseData.weapon, caseData.clues).status).toBe('unique');
    const human: HumanContext = { N: caseData.N, T: caseData.T, graph, rv: caseData.rv, td: caseData.td };
    expect(solveHuman(human, caseData.clues)?.score).toBe(caseData.solve.score);
  });
});
