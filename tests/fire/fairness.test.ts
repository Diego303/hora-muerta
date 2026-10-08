import { describe, expect, it } from 'vitest';
import { MAPS } from '../../src/engine/content/maps';
import { chooseOrigin, fairnessFailures, type FairnessInput } from '../../src/modes/fire/fairness';
import { FIRE_CAUSES, fireIntro, fireTitle } from '../../src/modes/fire/texts';

// Camino 0-1-2-3-4: la sala más alejada de 0 es 4.
const PATH = [[1], [0, 2], [1, 3], [2, 4], [3]];
// Estrella: 0 en el centro, 1..4 en las puntas (todas a una puerta).
const STAR = [[1, 2, 3, 4], [0], [0], [0], [0]];

describe('chooseOrigin (MODOS 2.5.2): la sala más alejada de la escena, con desempates deterministas', () => {
  it('elige la sala más alejada en puertas', () => {
    expect(chooseOrigin(PATH, 0, [])).toBe(4);
    expect(chooseOrigin(PATH, 4, [])).toBe(0);
  });

  it('en empate y sin pistas ancladas, gana el índice más bajo', () => {
    expect(chooseOrigin(STAR, 0, [])).toBe(1);
  });

  it('en empate, si las pistas intermedias no desempatan, gana el índice más bajo', () => {
    // Estrella con la escena en una punta (1): empatan las otras puntas (2, 3 y 4, a 2
    // puertas). Desde cualquiera de ellas la sala intermedia es el centro 0, así que
    // las pistas en 0 cuentan lo mismo para todas.
    expect(chooseOrigin(STAR, 1, [0, 0])).toBe(2);
  });

  it('el desempate por pistas intermedias cambia el foco cuando hay diferencia', () => {
    // Escena en 0. Aristas 0-1, 0-3, 1-2, 1-5, 3-4: empatan 2, 4 y 5 (a 2 puertas).
    // Una pista anclada en la sala 2 es intermedia solo vista desde 5 (desde 2 es el
    // propio foco y desde 4 es de las más lejanas), así que con ella gana 5.
    const graph = [[1, 3], [0, 2, 5], [1], [0, 4], [3], [1]];
    expect(chooseOrigin(graph, 0, [])).toBe(2);
    expect(chooseOrigin(graph, 0, [2, 2])).toBe(5);
  });

  it('en los mapas reales el foco nunca es la escena del crimen', () => {
    for (const map of MAPS) {
      const adj = map.rooms.map(() => [] as number[]);
      const index = new Map(map.rooms.map((r, i) => [r.id, i]));
      for (const [a, b] of map.edges) {
        const ia = index.get(a) ?? -1;
        const ib = index.get(b) ?? -1;
        adj[ia].push(ib);
        adj[ib].push(ia);
      }
      for (let crime = 0; crime < map.rooms.length; crime++) expect(chooseOrigin(adj, crime, [])).not.toBe(crime);
    }
  });
});

describe('fairnessFailures (MODOS 2.5.4): una prueba por garantía', () => {
  const base: FairnessInput = {
    adj: PATH,
    origin: 4,
    crime: 0,
    burnAt: [240, 240, 240, 285, 135],
    critical: [0, 1, 2],
    score: 10,
    band: [8, 25],
  };

  it('un caso que lo cumple todo no falla nada', () => {
    expect(fairnessFailures(base)).toEqual([]);
  });

  it('foco a menos de 2 puertas de la escena', () => {
    expect(fairnessFailures({ ...base, origin: 1 })).toEqual(['foco']);
  });

  it('una pista legible menos de 90 s', () => {
    expect(fairnessFailures({ ...base, burnAt: [240, 240, 240, 285, 89] })).toEqual(['lectura']);
  });

  it('más del 40 % de las pistas arde antes de 2:30 (2 de 5 vale; 3 de 5 no)', () => {
    expect(fairnessFailures({ ...base, burnAt: [240, 240, 240, 135, 135] })).toEqual([]);
    expect(fairnessFailures({ ...base, burnAt: [240, 135, 240, 135, 135], critical: [0, 2] })).toEqual(['ritmo']);
  });

  it('menos de la mitad de la cadena crítica arde después de 2:30', () => {
    expect(fairnessFailures({ ...base, burnAt: [135, 135, 240, 285, 240], critical: [0, 1, 2] })).toEqual(['cadena']);
    // Justo la mitad vale.
    expect(fairnessFailures({ ...base, burnAt: [135, 240, 240, 285, 240], critical: [0, 1] })).toEqual([]);
    // Arder justo a 2:30 no es "después".
    expect(fairnessFailures({ ...base, burnAt: [150, 150, 240, 285, 240], critical: [0, 1, 2] })).toEqual(['cadena']);
  });

  it('puntuación en el tercio alto de la banda', () => {
    // Banda Novato 8-25: el tope del tercio medio es 8 + 17 × 2/3 ≈ 19,3.
    expect(fairnessFailures({ ...base, score: 19 })).toEqual([]);
    expect(fairnessFailures({ ...base, score: 20 })).toEqual(['puntuacion']);
  });
});

describe('textos de los casos de incendio', () => {
  it('cada sala de cada escenario tiene su causa, y la causa nombra la sala', () => {
    for (const map of MAPS) {
      for (const room of map.rooms) {
        const cause = FIRE_CAUSES[map.id][room.id];
        expect(cause, `${map.id}/${room.id}`).toBeTruthy();
        expect(cause).toContain(room.name);
      }
    }
  });

  it('título "{Lugar} en llamas" y presentación que nombra el foco', () => {
    const museo = MAPS.find((m) => m.id === 'museo');
    if (!museo) throw new Error('falta el museo');
    const archivo = museo.rooms.findIndex((r) => r.id === 'arc');
    expect(fireTitle(museo)).toBe('Museo Aldana en llamas');
    expect(fireIntro(museo, archivo, 1)).toBe('Un cortocircuito en el Archivo ha incendiado el museo. Cinco minutos para dar con el culpable entre el humo.');
  });
});
