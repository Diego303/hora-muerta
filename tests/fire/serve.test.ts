import { describe, expect, it } from 'vitest';
import type { MapId } from '../../src/engine/types';
import type { FireRecords } from '../../src/modes/fire/records';
import { fireOffers, fireOrder } from '../../src/modes/fire/serve';
import type { FireCase } from '../../src/modes/fire/types';

function fake(id: string, level: 'Novato' | 'Inspector exprés', map: MapId): FireCase {
  return { caseData: { id, map } as FireCase['caseData'], fire: { level } as FireCase['fire'] };
}

const CASES = [
  fake('N1', 'Novato', 'mansion'),
  fake('N2', 'Novato', 'hotel'),
  fake('N3', 'Novato', 'tren'),
  fake('I1', 'Inspector exprés', 'museo'),
  fake('I2', 'Inspector exprés', 'teatro'),
];
const ALL_MAPS = new Set<MapId>(['mansion', 'tren', 'museo', 'hotel', 'barco', 'teatro']);
const solved = (...ids: string[]): FireRecords =>
  Object.fromEntries(ids.map((id) => [id, { bestLeft: 100, medals: [], attempts: 1, solvedAt: '2026-10-07T00:00:00Z' }]));

describe('servicio sin repetir de la sala del incendio', () => {
  it('ofrece el primer edificio sin resolver de cada nivel, en el orden dado', () => {
    const [novato, inspector] = fireOffers(CASES, {}, ALL_MAPS);
    expect(novato.next?.caseData.id).toBe('N1');
    expect(inspector.next?.caseData.id).toBe('I1');
    expect(novato.total).toBe(3);
  });

  it('un edificio resuelto pasa a la lista de resueltos y se ofrece el siguiente', () => {
    const [novato] = fireOffers(CASES, solved('N1'), ALL_MAPS);
    expect(novato.next?.caseData.id).toBe('N2');
    expect(novato.solved.map((c) => c.caseData.id)).toEqual(['N1']);
  });

  it('un intento sin resolver (derrumbe) no cuenta: se sigue ofreciendo', () => {
    const records: FireRecords = { N1: { bestLeft: null, medals: [], attempts: 3, solvedAt: null } };
    expect(fireOffers(CASES, records, ALL_MAPS)[0].next?.caseData.id).toBe('N1');
  });

  it('con todo resuelto no hay siguiente, pero siguen todos para mejorar la marca', () => {
    const [novato] = fireOffers(CASES, solved('N1', 'N2', 'N3'), ALL_MAPS);
    expect(novato.next).toBeNull();
    expect(novato.solved).toHaveLength(3);
  });

  it('solo ofrece escenarios desbloqueados; si un nivel no tiene ninguno, ofrece todos', () => {
    const start = new Set<MapId>(['mansion', 'tren', 'museo']);
    const [novato, inspector] = fireOffers(CASES, solved('N1'), start);
    expect(novato.next?.caseData.id).toBe('N3');
    expect(novato.total).toBe(2);
    expect(inspector.next?.caseData.id).toBe('I1');

    const none = new Set<MapId>(['barco']);
    expect(fireOffers(CASES, {}, none)[1].total).toBe(2);
  });

  it('el orden depende de la semilla del jugador y es estable', () => {
    const a = fireOrder(CASES, 'jugador-1|incendio|v').map((c) => c.caseData.id);
    const b = fireOrder(CASES, 'jugador-1|incendio|v').map((c) => c.caseData.id);
    const c = fireOrder(CASES, 'jugador-2|incendio|v').map((x) => x.caseData.id);
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual(CASES.map((x) => x.caseData.id).sort());
    expect(c).not.toEqual(a);
  });
});
