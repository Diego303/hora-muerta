import { describe, expect, it } from 'vitest';
import { buildGraph } from '../../src/engine/graph';
import { buildTextContext } from '../../src/engine/generate';
import { solveHuman } from '../../src/engine/human';
import type { HumanContext } from '../../src/engine/human';
import { MANSION } from '../../src/engine/content/maps';
import { closingText, keyDeductionText, plainText, stepExplanation } from '../../src/engine/text';
import type { CaseDef, Clue, Truth } from '../../src/engine/types';

// Mismo ejemplo hand-verified que tests/engine/human.test.ts (Apéndice D):
// Casa Valdemar, Adela=culpable con el bastón, arquetipo "pareja".
const truth: Truth = {
  rooms: [
    [4, 6, 6],
    [2, 1, 1],
    [4, 5, 4],
    [7, 5, 7],
  ],
  obj: [1, 0, 2, 3],
};
const clues: Clue[] = [
  { k: 'at', c: 1, t: 0, r: 2 },
  { k: 'together', a: 2, b: 3, t: 1 },
  { k: 'cat', o: 0, t: 2, r: 1 },
  { k: 'ncarry', c: 0, o: 2 },
  { k: 'cat', o: 3, t: 0, r: 7 },
];
const graph = buildGraph(MANSION);
const ctx: HumanContext = { N: 4, T: 3, graph, rv: 6, td: 1 };

function buildCase(): CaseDef {
  const solved = solveHuman(ctx, clues);
  if (!solved) throw new Error('el ejemplo del Apéndice D debería resolverse');
  const criticalSteps = solved.steps.filter((s) => s.crit);
  const key = criticalSteps.indexOf(solved.steps[solved.key]);
  return {
    v: 2,
    id: 'TEST-D',
    mode: 'novato',
    diff: 0,
    map: 'mansion',
    cast: [0, 1, 2, 3],
    // índices globales en OBJECTS: 1=cuerda, 5=bastón, 0=candelabro, 7=pisapapeles.
    objects: [1, 5, 0, 7],
    victim: 0,
    motive: 0,
    N: 4,
    T: 3,
    rv: 6,
    td: 1,
    culprit: 0,
    weapon: 1,
    truth,
    clues,
    solve: { steps: criticalSteps, key: key >= 0 ? key : 0, arch: solved.arch, maxLv: solved.maxLv, score: solved.score },
    sig: 'test',
  };
}

describe('engine/text: cierre y explicación de pasos (Apéndice C/D)', () => {
  const caseData = buildCase();
  const textCtx = buildTextContext(MANSION, caseData.cast, caseData.objects);

  it('closingText: "{Culpable}, {rol}, estuvo a solas con {víctima} en {sala} a las {hora}. Llevaba {arma}. Motivo: {motivo}."', () => {
    const text = plainText(closingText(caseData, textCtx));
    expect(text).toContain('Adela');
    expect(text).toContain('el ama de llaves');
    expect(text).toContain('Don Aurelio Valdemar');
    expect(text).toContain('Bodega');
    expect(text).toContain('22:00');
    expect(text).toContain('bastón');
  });

  it('keyDeductionText: arquetipo "pareja" reproduce la frase exacta del Apéndice D', () => {
    expect(caseData.solve.arch).toContain('pareja');
    const text = plainText(keyDeductionText(caseData, textCtx));
    expect(text).toBe('La clave: Celia y Darío iban juntos; ninguno pudo estar a solas con la víctima.');
  });

  it('stepExplanation: R1_AT cita la pista 1 y la hora/sala correctas', () => {
    const i = caseData.solve.steps.findIndex((s) => s.rule === 'R1_AT');
    expect(i).toBeGreaterThanOrEqual(0);
    const text = plainText(stepExplanation(caseData.solve.steps[i], i, caseData.solve.steps, caseData, textCtx));
    expect(text).toContain('Bruno');
    expect(text).toContain('Invernadero');
    expect(text).toContain('21:00');
    expect(text).toContain('p. 1');
  });

  it('stepExplanation: R4_TOGETHER nombra a los dos de la pareja', () => {
    const i = caseData.solve.steps.findIndex((s) => s.rule === 'R4_TOGETHER');
    expect(i).toBeGreaterThanOrEqual(0);
    const text = plainText(stepExplanation(caseData.solve.steps[i], i, caseData.solve.steps, caseData, textCtx));
    expect(text).toContain('Celia');
    expect(text).toContain('Darío');
  });

  it('stepExplanation: R5_WEAPON nombra al culpable y el arma', () => {
    const i = caseData.solve.steps.findIndex((s) => s.rule === 'R5_WEAPON');
    expect(i).toBeGreaterThanOrEqual(0);
    const text = plainText(stepExplanation(caseData.solve.steps[i], i, caseData.solve.steps, caseData, textCtx));
    expect(text).toContain('Adela');
    expect(text).toContain('bastón');
  });
});
