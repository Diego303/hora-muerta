// Banco de ejercicios generado (docs/MODOS.md 3.7 y 3.8): el verificador con poda
// coincide con la fuerza bruta literal, el generador es determinista y cada ejercicio
// que produce se sostiene, y el banco publicado cumple la cifra de D4.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildGraph } from '../../src/engine/graph';
import { propagateHuman } from '../../src/engine/human';
import type { BankFile, Clue } from '../../src/engine/types';
import { drillLevel } from '../../src/modes/gym/adapt';
import { bankDrillFromDef, DRILLS } from '../../src/modes/gym/drills';
import { analyzeCase, drillsFromCase } from '../../src/modes/gym/generate';
import { PRACTICE_PLAN } from '../../src/modes/gym/content';
import type { DrillBankFile } from '../../src/modes/gym/types';
import { computeAnswer, drillErrors, scenariosLiteral } from '../../src/modes/gym/verify';

const novato = JSON.parse(readFileSync('public/cases/novato.json', 'utf8')) as BankFile;

describe('verificador con poda frente a la fuerza bruta literal', () => {
  it.each(DRILLS.map((d) => [d.drill.id, d] as const))('%s: misma respuesta', (_id, { drill }) => {
    expect(computeAnswer(drill)).toEqual(computeAnswer(drill, scenariosLiteral));
  });
});

describe('propagateHuman (solver humano sin exigir caso resuelto)', () => {
  const graph = buildGraph(PRACTICE_PLAN);
  it('sin crimen, deduce el alcance y no toca los candidatos', () => {
    // Bruno (0) en la Cocina (2) a las 21:00: a las 22:00, Salón, Cocina o Invernadero.
    const clues: Clue[] = [{ k: 'at', c: 0, t: 0, r: 2 }];
    const run = propagateHuman({ N: 2, T: 2, graph, rv: 0, td: 1 }, clues, { crime: false });
    expect(run.contradiction).toBe(false);
    expect(run.poss[0][1]).toBe((1 << 1) | (1 << 2) | (1 << 4));
    expect(run.cand).toBe(0b11);
    expect(run.steps.every((s) => !s.rule.startsWith('R2_'))).toBe(true);
  });

  it('con crimen, aplica la regla del crimen', () => {
    // Nadie más que Celia (1) pudo estar en la Biblioteca (0) a las 22:00.
    const clues: Clue[] = [{ k: 'at', c: 0, t: 1, r: 2 }];
    const run = propagateHuman({ N: 2, T: 2, graph, rv: 0, td: 1 }, clues, { crime: true });
    expect(run.cand).toBe(0b10);
  });
});

describe('generador (scripts/build-drills.ts)', () => {
  const sample = novato.cases.slice(0, 6);

  it('es determinista', () => {
    const a = analyzeCase(sample[0]);
    const b = analyzeCase(sample[0]);
    if (!a || !b) throw new Error('el caso no se resuelve');
    expect(drillsFromCase(a).map((c) => c.def)).toEqual(drillsFromCase(b).map((c) => c.def));
  });

  it('cada ejercicio generado tiene la respuesta de la fuerza bruta, su nivel y una explicación', () => {
    let n = 0;
    for (const caseData of sample) {
      const a = analyzeCase(caseData);
      if (!a) continue;
      for (const { def } of drillsFromCase(a)) {
        n++;
        const { drill } = bankDrillFromDef(def);
        expect(drillErrors(def.answer, computeAnswer(drill)), def.id).toEqual([]);
        expect(def.level, def.id).toBe(drillLevel(drill));
        expect(def.explain.length, def.id).toBeGreaterThan(20);
        expect(drill.N, def.id).toBeLessThanOrEqual(4);
        expect(def.given.length, def.id).toBeLessThanOrEqual(def.tech === 'remate' ? 6 : 4);
      }
    }
    expect(n).toBeGreaterThan(10);
  });
});

describe('banco publicado (public/drills.json)', () => {
  const path = 'public/drills.json';
  it.runIf(existsSync(path))('30 por técnica y nivel: 360 en total, 90 remates (D4)', () => {
    const file = JSON.parse(readFileSync(path, 'utf8')) as DrillBankFile;
    const buckets = new Map<string, number>();
    for (const d of file.drills) buckets.set(`${d.tech}:${d.level}`, (buckets.get(`${d.tech}:${d.level}`) ?? 0) + 1);
    for (const tech of ['alcance', 'seguro', 'tabla', 'remate']) for (const level of [1, 2, 3]) expect(buckets.get(`${tech}:${level}`), `${tech}:${level}`).toBe(30);
    expect(file.drills).toHaveLength(360);
    expect(new Set(file.drills.map((d) => d.id)).size).toBe(360);
  });
});
