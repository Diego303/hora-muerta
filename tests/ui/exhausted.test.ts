// Pantalla de agotamiento (§12.5): el texto dice por qué no queda ningún caso.
import { describe, expect, it } from 'vitest';
import type { BankFile, CaseDef, MapId } from '../../src/engine/types';
import { exhaustedMessage } from '../../src/ui/exhausted';

const bank = (maps: MapId[]): BankFile => ({
  version: 'v',
  mode: 'comisario',
  cases: maps.map((map, i) => ({ id: `C-00${i + 1}`, map }) as CaseDef),
});
const START = new Set<MapId>(['mansion', 'tren', 'museo']);

describe('exhaustedMessage', () => {
  it('un nivel sin casos lo dice, sin "Volver a empezar"', () => {
    expect(exhaustedMessage(bank([]), null, START)).toEqual({
      title: 'Todavía no hay casos de Comisario.',
      text: 'Puedes seguir con el modo infinito, un generador en tu propio navegador.',
      canRestart: false,
    });
  });

  it('si quedan casos en escenarios bloqueados, cuántos y cómo abrirlos', () => {
    const m = exhaustedMessage(bank(['mansion', 'tren', 'museo', 'hotel', 'barco']), null, START);
    expect(m.title).toBe('Has resuelto los casos de Comisario de tus escenarios.');
    expect(m.text).toMatch(/^Hay 2 más en escenarios que aún no has desbloqueado: sube de rango para abrirlos\./);
    expect(m.canRestart).toBe(true);
    expect(exhaustedMessage(bank(['mansion', 'hotel']), null, START).text).toMatch(/^Hay 1 más en un escenario que/);
  });

  it('con todo desbloqueado y jugado, o con un escenario elegido, "todos"', () => {
    expect(exhaustedMessage(bank(['mansion', 'tren']), null, START).title).toBe('Has resuelto todos los casos de Comisario.');
    expect(exhaustedMessage(bank(['mansion', 'hotel']), 'mansion', START).title).toBe('Has resuelto todos los casos de Comisario en ese escenario.');
  });
});
