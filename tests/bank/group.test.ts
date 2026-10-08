// Generación de un solo grupo (scripts/build-group.ts): piezas puras.
import { describe, expect, it } from 'vitest';
import { caseId, findGroup, slotMap } from '../../scripts/bank-group';
import { mapLimit } from '../../scripts/parallel';

describe('mapLimit', () => {
  it('devuelve los resultados en el orden de entrada aunque terminen desordenados', async () => {
    const delays = [30, 5, 20, 1, 10];
    const out = await mapLimit(delays, 2, (ms) => new Promise<number>((r) => setTimeout(() => r(ms), ms)));
    expect(out).toEqual(delays);
  });

  it('nunca tiene más de `jobs` trabajos a la vez', async () => {
    let running = 0;
    let peak = 0;
    await mapLimit([...Array(12).keys()], 3, async () => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 2));
      running--;
    });
    expect(peak).toBe(3);
  });

  it('con una lista vacía no hace nada', async () => {
    expect(await mapLimit([], 4, async () => 1)).toEqual([]);
  });
});

describe('huecos de un grupo', () => {
  it('los mapas van por turnos entre los huecos', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(slotMap)).toEqual(['mansion', 'tren', 'museo', 'hotel', 'barco', 'teatro', 'mansion']);
  });

  it('ids con el prefijo del grupo y tres cifras', () => {
    expect(caseId(findGroup('comisario'), 0)).toBe('C-001');
    expect(caseId(findGroup('novato'), 41)).toBe('N-042');
  });

  it('Comisario lleva su tope estricto de 14 pistas (§11)', () => {
    expect(findGroup('comisario').maxClues).toBe(14);
  });

  it('un grupo desconocido falla con un mensaje claro', () => {
    expect(() => findGroup('expediente')).toThrow(/Grupo desconocido: "expediente"/);
  });
});
