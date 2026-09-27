import { describe, expect, it } from 'vitest';
import { buildCaseCandidate } from '../../src/engine/generate';
import type { DiffIndex } from '../../src/engine/clues';

// La tubería ahora exige que el solver humano resuelva dentro de la banda de
// la dificultad (§11), así que una semilla concreta puede devolver null tras
// los 40 intentos (es un rechazo legítimo, no un fallo). El determinismo debe
// cumplirse igual en ese caso (null === null), así que no se exige que cada
// semilla concreta produzca un caso; solo que el comportamiento sea idéntico
// para la misma semilla, y que al menos alguna de varias semillas sí produzca
// un caso (si no, el generador estaría roto, no solo siendo selectivo).
// Inspector/Comisario son mucho más lentos de generar que Novato (ver
// docs/DECISIONES.md: R6_HYPOTHESIS pendiente), así que se muestrean menos
// semillas ahí — el determinismo no necesita muchas repeticiones para
// comprobarse, solo alguna en cada dificultad.
const SEEDS_PER_DIFF: Record<DiffIndex, number> = { 0: 5, 1: 2, 2: 2 };

describe('determinismo (§7): la misma semilla produce el mismo caso', () => {
  it(
    'genera el mismo resultado (caso o null) para la misma semilla y dificultad',
    () => {
      let sawCase = false;
      for (const diff of [0, 1, 2] as DiffIndex[]) {
        for (let i = 0; i < SEEDS_PER_DIFF[diff]; i++) {
          const seed = `determinismo-${diff}-${i}`;
          const a = buildCaseCandidate(seed, diff);
          const b = buildCaseCandidate(seed, diff);
          expect(JSON.stringify(a)).toBe(JSON.stringify(b));
          if (a) sawCase = true;
        }
      }
      expect(sawCase).toBe(true);
    },
    300000,
  );

  it('semillas distintas no producen sistemáticamente el mismo caso', () => {
    const a = buildCaseCandidate('determinismo-a', 0);
    const b = buildCaseCandidate('determinismo-b', 0);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });
});
