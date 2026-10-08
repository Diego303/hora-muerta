// Junta de huecos del grupo incendio (scripts/fire-bank.ts#generateFireGroup): el
// resultado no puede depender de cuántos huecos se generen a la vez.
import { describe, expect, it } from 'vitest';
import { generateFireGroup, type SlotOutcome, type SlotRunner } from '../../scripts/fire-bank';
import type { FireCase } from '../../src/modes/fire/types';

const GROUPS = [
  { level: 'Novato' as const, count: 3, idPrefix: 'T-N' },
  { level: 'Inspector exprés' as const, count: 2, idPrefix: 'T-I' },
];

/** Hueco falso y determinista: los múltiplos de 3 salen vacíos y el hueco 4 repite la firma del 1. */
function fakeOutcome(groupIndex: number, slot: number): SlotOutcome {
  const empty = slot % 3 === 0;
  const sig = groupIndex === 0 && slot === 4 ? 'g0-s1' : `g${groupIndex}-s${slot}`;
  return {
    slot,
    fire: empty ? null : ({ caseData: { id: '', sig }, fire: {} } as unknown as FireCase),
    candidates: 2,
    duplicates: 0,
    rejections: { foco: 0, lectura: 0, ritmo: 1, cadena: 0, puntuacion: 0 },
  };
}

const fakeRunner: SlotRunner = (groupIndex, slots) => Promise.resolve(slots.map((slot) => fakeOutcome(groupIndex, slot)).reverse());

async function run(batch: number) {
  return generateFireGroup(new Set(), fakeRunner, batch, () => undefined, GROUPS);
}

describe('generateFireGroup: juntar huecos', () => {
  it('llena el cupo saltando huecos vacíos y repetidos, con ids correlativos', async () => {
    const { cases, stats } = await run(1);
    expect(cases.map((c) => [c.caseData.id, c.caseData.sig])).toEqual([
      ['T-N-01', 'g0-s1'],
      ['T-N-02', 'g0-s2'],
      ['T-N-03', 'g0-s5'],
      ['T-I-01', 'g1-s1'],
      ['T-I-02', 'g1-s2'],
    ]);
    // Grupo 0: huecos 0..5 (0 y 3 vacíos, 4 repetido); grupo 1: huecos 0..2 (0 vacío).
    expect(stats.emptySlots).toBe(4);
    expect(stats.duplicates).toBe(1);
    expect(stats.candidates).toBe(2 * 9);
    expect(stats.rejections.ritmo).toBe(9);
  });

  it('da exactamente lo mismo (casos y cifras) con cualquier tamaño de tanda', async () => {
    const serial = await run(1);
    for (const batch of [2, 4, 7, 16]) expect(await run(batch)).toEqual(serial);
  });

  it('se detiene en 3 × cupo si no hay casos suficientes', async () => {
    const none: SlotRunner = (gi, slots) => Promise.resolve(slots.map((slot) => ({ ...fakeOutcome(gi, slot), fire: null })));
    const { cases, stats } = await generateFireGroup(new Set(), none, 4, () => undefined, GROUPS);
    expect(cases).toEqual([]);
    expect(stats.emptySlots).toBe(3 * 3 + 2 * 3);
  });
});
