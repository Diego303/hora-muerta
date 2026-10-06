import { describe, expect, it } from 'vitest';
import { veilFor } from '../../src/core/visualmode';

describe('veilFor', () => {
  it('destella al entrar en el fuego y se funde al salir', () => {
    expect(veilFor(null, 'fuego', false)).toBe('ignite');
    expect(veilFor('fuego', null, false)).toBe('fade');
  });

  it('no hace nada si el modo no cambia', () => {
    expect(veilFor(null, null, false)).toBeNull();
    expect(veilFor('fuego', 'fuego', false)).toBeNull();
  });

  it('con movimiento reducido no hay destello en ningún sentido', () => {
    expect(veilFor(null, 'fuego', true)).toBeNull();
    expect(veilFor('fuego', null, true)).toBeNull();
  });
});
