import { describe, expect, it } from 'vitest';
import { buildCaseCandidate } from '../../src/engine/generate';

describe('determinismo (§7): la misma semilla produce el mismo caso', () => {
  it('genera el mismo candidato byte a byte para la misma semilla y dificultad', () => {
    const a = buildCaseCandidate('determinismo-1', 1);
    const b = buildCaseCandidate('determinismo-1', 1);
    expect(a).not.toBeNull();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('funciona igual para los tres niveles', () => {
    for (const diff of [0, 1, 2] as const) {
      const a = buildCaseCandidate('determinismo-niveles', diff);
      const b = buildCaseCandidate('determinismo-niveles', diff);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
  });

  it('semillas distintas no producen sistemáticamente el mismo caso', () => {
    const a = buildCaseCandidate('determinismo-a', 0);
    const b = buildCaseCandidate('determinismo-b', 0);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });
});
