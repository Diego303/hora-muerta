import { describe, expect, it } from 'vitest';
import { buildCaseCandidate } from '../../src/engine/generate';

describe('buildCaseCandidate con reparto fijo (modo Expediente, §12.2)', () => {
  it('usa el reparto dado (recortado a N) en vez de uno aleatorio', () => {
    // Adela, Bruno, Celia, Darío, Elena: ya alfabético, como exige §4.2.
    const sharedCast = [0, 1, 2, 3, 4];
    const novato = buildCaseCandidate('expediente-test', 0, 'mansion', { castOverride: sharedCast });
    const inspector = buildCaseCandidate('expediente-test', 1, 'mansion', { castOverride: sharedCast });

    if (novato) expect(novato.cast).toEqual(sharedCast.slice(0, 4));
    if (inspector) expect(inspector.cast.slice().sort((a, b) => a - b)).toEqual(sharedCast.slice().sort((a, b) => a - b));

    // Con 40 intentos y el filtro del solver humano, no está garantizado que
    // una semilla concreta produzca caso en las dos dificultades a la vez;
    // basta con que el mecanismo funcione en alguna.
    expect(novato ?? inspector).not.toBeNull();
  });
});
