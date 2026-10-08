import { describe, expect, it } from 'vitest';
import { FIRE_TOTAL_S } from '../../src/modes/fire/config';
import { clueBurnAt, clueRoom, clueState, doorDistances, fireTimes, roomState } from '../../src/modes/fire/timeline';

// Los dos casos de prueba (public/cases/incendio.json). ign y burnAt son los que
// calcula fireTimes desde el foco, y se comprueban aparte en fixtures.test.ts.
const VALDEMAR = {
  // Foco en la Cocina (sala 7); escena del crimen en la Biblioteca (sala 0).
  ign: [240, 180, 135, 180, 135, 90, 180, 45],
  burnAt: [90, 135, 285, 285, 240, 180, 240, 180],
};
const ALDANA = {
  // Foco en el Archivo (sala 8); escena del crimen en la Sala Egipcia (sala 0).
  ign: [240, 180, 135, 180, 135, 90, 135, 90, 45],
  burnAt: [180, 135, 225, 240, 240, 180, 135, 285, 225],
};

describe('roomState (MODOS 2.3): frío, aviso de 15 s y en llamas', () => {
  it('Valdemar: la Cocina (foco) avisa desde 30 s y arde a 45 s', () => {
    expect(roomState(VALDEMAR.ign, 7, 0)).toBe('cold');
    expect(roomState(VALDEMAR.ign, 7, 29)).toBe('cold');
    expect(roomState(VALDEMAR.ign, 7, 30)).toBe('heat');
    expect(roomState(VALDEMAR.ign, 7, 44)).toBe('heat');
    expect(roomState(VALDEMAR.ign, 7, 45)).toBe('burning');
    expect(roomState(VALDEMAR.ign, 7, 300)).toBe('burning');
  });

  it('Valdemar: la escena del crimen aguanta hasta 240 s, con aviso desde 225 s', () => {
    expect(roomState(VALDEMAR.ign, 0, 224)).toBe('cold');
    expect(roomState(VALDEMAR.ign, 0, 225)).toBe('heat');
    expect(roomState(VALDEMAR.ign, 0, 239)).toBe('heat');
    expect(roomState(VALDEMAR.ign, 0, 240)).toBe('burning');
  });

  it('Aldana: el Archivo (foco) arde a 45 s y la Sala Egipcia a 240 s', () => {
    expect(roomState(ALDANA.ign, 8, 44)).toBe('heat');
    expect(roomState(ALDANA.ign, 8, 45)).toBe('burning');
    expect(roomState(ALDANA.ign, 0, 239)).toBe('heat');
    expect(roomState(ALDANA.ign, 0, 240)).toBe('burning');
  });

  it('una sala sin camino desde el foco nunca arde', () => {
    expect(roomState([Infinity, 45], 0, 10_000)).toBe('cold');
  });
});

describe('clueBurnAt (MODOS 2.2): pista con sala, pista sin sala y pista salvada', () => {
  it('una pista que nombra sala arde 45 s después de su sala', () => {
    expect(clueBurnAt(VALDEMAR.ign, 7, false)).toBe(90);
    expect(clueBurnAt(VALDEMAR.ign, 5, false)).toBe(135);
    expect(clueBurnAt(VALDEMAR.ign, 0, false)).toBe(285);
  });

  it('una pista sin sala arde a 240 s', () => {
    expect(clueBurnAt(VALDEMAR.ign, null, false)).toBe(240);
  });

  it('una pista fotografiada nunca arde', () => {
    expect(clueBurnAt(VALDEMAR.ign, 7, true)).toBe(Infinity);
    expect(clueBurnAt(VALDEMAR.ign, null, true)).toBe(Infinity);
  });

  it('clueRoom devuelve la sala que nombra la pista, o null', () => {
    expect(clueRoom({ k: 'at', c: 1, t: 0, r: 7 })).toBe(7);
    expect(clueRoom({ k: 'cat', o: 1, t: 0, r: 2 })).toBe(2);
    expect(clueRoom({ k: 'feat', c: 0, t: 1, f: 1, neg: false })).toBeNull();
    expect(clueRoom({ k: 'together', a: 0, b: 1, t: 1 })).toBeNull();
    expect(clueRoom({ k: 'ncarry', c: 0, o: 0 })).toBeNull();
  });
});

describe('clueState (MODOS 2.3): ok, mecha de 30 s, quemándose, quemada y salvada', () => {
  // Valdemar, pista 0: arde a 90 s, con mecha desde 60 s y quemada desde 94 s.
  const at = 90;
  it.each([
    [0, 'ok'],
    [59, 'ok'],
    [60, 'heat'],
    [89, 'heat'],
    [90, 'burning'],
    [93, 'burning'],
    [94, 'burnt'],
    [299, 'burnt'],
  ])('a los %i s la pista está en estado %s', (t, expected) => {
    expect(clueState(at, t, false)).toBe(expected);
  });

  it('una pista salvada no cambia nunca, aunque su segundo de quemado haya pasado', () => {
    expect(clueState(Infinity, 0, true)).toBe('saved');
    expect(clueState(Infinity, 299, true)).toBe('saved');
  });

  it('Valdemar, pista 2 (arde a 285 s): mecha desde 255 s, quemada desde 289 s', () => {
    const burnAt = VALDEMAR.burnAt[2];
    expect(clueState(burnAt, 254, false)).toBe('ok');
    expect(clueState(burnAt, 255, false)).toBe('heat');
    expect(clueState(burnAt, 285, false)).toBe('burning');
    expect(clueState(burnAt, 289, false)).toBe('burnt');
  });
});

describe('fireTimes (MODOS 2.2 y 2.5.3): tiempos desde el foco', () => {
  // Camino 0-1-2-3, sin más salas: las distancias son 0, 1, 2 y 3 desde el foco 0.
  const path = [[1], [0, 2], [1, 3], [2]];

  it('cada puerta suma 45 s desde los 45 s de ignición del foco', () => {
    const times = fireTimes({ adj: path, origin: 0, crime: 3, clueRooms: [] });
    expect(times.ign).toEqual([45, 90, 135, 240]);
  });

  it('la escena del crimen arde como mínimo a 240 s', () => {
    const times = fireTimes({ adj: path, origin: 0, crime: 1, clueRooms: [] });
    expect(times.ign).toEqual([45, 240, 135, 180]);
  });

  it('las pistas arden 45 s después de su sala, o a 240 s si no nombran sala', () => {
    const times = fireTimes({ adj: path, origin: 0, crime: 3, clueRooms: [2, null, 0] });
    expect(times.burnAt).toEqual([180, 240, 90]);
  });

  it('una sala sin camino desde el foco nunca arde', () => {
    const isolated = [[1], [0], []];
    const times = fireTimes({ adj: isolated, origin: 0, crime: 1, clueRooms: [] });
    expect(times.ign[2]).toBe(Infinity);
  });

  it('doorDistances cuenta puertas, no metros', () => {
    expect(doorDistances(path, 0)).toEqual([0, 1, 2, 3]);
    expect(doorDistances([[], []], 0)).toEqual([0, -1]);
  });

  it('la duración total del caso sigue siendo 300 s', () => {
    expect(FIRE_TOTAL_S).toBe(300);
  });
});
