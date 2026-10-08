// Los 23 ejercicios del prototipo, reverificados por fuerza bruta (docs/MODOS.md 3.8).
import { describe, expect, it } from 'vitest';
import { DRILLS } from '../../src/modes/gym/drills';
import { normalizeDrill } from '../../src/modes/gym/normalize';
import { SEED_BLOCKS } from '../../src/modes/gym/seed';
import { computeAnswer, drillErrors } from '../../src/modes/gym/verify';

describe('banco de ejercicios del prototipo', () => {
  it('son 23: 5 de activación, 5 por técnica y 3 remates', () => {
    expect(DRILLS).toHaveLength(23);
    expect(Object.values(SEED_BLOCKS).map((b) => b.length)).toEqual([5, 5, 5, 5, 3]);
    expect(new Set(DRILLS.map((d) => d.drill.id)).size).toBe(23);
  });

  it('cada ejercicio tiene el nivel de la tabla de MODOS 3.6', () => {
    const levels = Object.fromEntries(DRILLS.map((d) => [d.drill.id, d.level]));
    expect(levels).toEqual({
      a1: 1, a2: 1, a3: 1, a4: 1, a5: 1,
      t1a: 2, t1b: 1, t1c: 2, t1d: 2, t1e: 1,
      t2a: 2, t2b: 1, t2c: 2, t2d: 2, t2e: 2,
      t3a: 2, t3b: 3, t3c: 3, t3d: 1, t3e: 3,
      r1: 1, r2: 3, r3: 2,
    });
  });

  it.each(DRILLS.map((d) => [d.drill.id, d] as const))('%s: la respuesta guardada es la de la fuerza bruta', (_id, { drill, answer }) => {
    expect(drillErrors(answer, computeAnswer(drill))).toEqual([]);
  });

  it('el verificador detecta una respuesta cambiada (control de la propia prueba)', () => {
    const { drill, answer } = DRILLS.find((d) => d.drill.id === 'a1') ?? DRILLS[0];
    if (answer.type !== 'reach') throw new Error('a1 debería ser reach');
    const broken = { type: 'reach' as const, rooms: answer.rooms.slice(1) };
    expect(drillErrors(broken, computeAnswer(drill))).not.toEqual([]);
  });

  it('un error de escritura en un ejercicio (sala inexistente) se detecta al normalizar', () => {
    const typo = { ...SEED_BLOCKS.activacion[0], given: [{ k: 'at' as const, c: 'Bruno' as const, r: 'cocina', t: 0 }] };
    expect(() => normalizeDrill(typo)).toThrow(/sala desconocida "cocina"/);
  });
});
