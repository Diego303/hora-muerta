// Integración del calentamiento con la partida (docs/MODOS.md 3.10).
import { describe, expect, it } from 'vitest';
import { remainingSuspects, suggestTech, TWO_LEFT_STEPS } from '../../src/modes/gym/bridge';
import { markKey, type MarkValue } from '../../src/game/store';

const crime = { N: 4, rv: 2, td: 3 };

describe('"¿Te quedan dos?"', () => {
  it('cuenta los que no has descartado ni tachado en la sala y la hora del crimen', () => {
    expect(remainingSuspects(crime, new Set(), new Map())).toEqual([0, 1, 2, 3]);
    expect(remainingSuspects(crime, new Set([0, 3]), new Map())).toEqual([1, 2]);
    const marks = new Map<string, MarkValue>([[markKey(3, 2, 1), 2]]);
    expect(remainingSuspects(crime, new Set([0]), marks)).toEqual([2, 3]);
  });

  it('una ✓ o una ✗ en otra sala u hora no descarta a nadie', () => {
    const marks = new Map<string, MarkValue>([
      [markKey(3, 2, 0), 1],
      [markKey(2, 2, 1), 2],
      [markKey(3, 1, 2), 2],
    ]);
    expect(remainingSuspects(crime, new Set(), marks)).toEqual([0, 1, 2, 3]);
  });

  it('el protocolo tiene las cinco comprobaciones de MODOS 3.10.1', () => {
    expect(TWO_LEFT_STEPS).toHaveLength(5);
    expect(TWO_LEFT_STEPS[0]).toBe('¿Hay pistas sin tachar? Reléelas pensando solo en esos dos.');
  });
});

describe('técnica sugerida tras un caso fallado (MODOS 3.10.2)', () => {
  it('según el arquetipo de la deducción clave', () => {
    expect(suggestTech(['coartada'])?.tech).toBe('alcance');
    expect(suggestTech(['paso'])?.tech).toBe('alcance');
    expect(suggestTech(['objeto', 'pareja'])?.tech).toBe('tabla');
    expect(suggestTech(['pareja'])?.tech).toBe('seguro');
    expect(suggestTech(['recuento'])?.tech).toBe('seguro');
    expect(suggestTech(['callejon'])?.tech).toBe('remate');
  });

  it('la sala vacía no está en la tabla: se mira el siguiente, o no se sugiere nada', () => {
    expect(suggestTech(['vacia', 'recuento'])).toEqual({ tech: 'seguro', arch: 'recuento' });
    expect(suggestTech(['vacia'])).toBeNull();
    expect(suggestTech([])).toBeNull();
  });
});
