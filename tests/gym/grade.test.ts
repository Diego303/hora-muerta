// Una prueba por cada regla de error de docs/MODOS.md 3.5, sobre los ejercicios reales.
import { describe, expect, it } from 'vitest';
import { DRILLS } from '../../src/modes/gym/drills';
import { grade } from '../../src/modes/gym/grade';
import type { Reply } from '../../src/modes/gym/types';

function drill(id: string) {
  const found = DRILLS.find((d) => d.drill.id === id);
  if (!found) throw new Error(`no existe ${id}`);
  return found;
}

function room(id: string, roomId: string): number {
  return drill(id).drill.plan.rooms.findIndex((r) => r.id === roomId);
}

function reach(id: string, rooms: string[]) {
  const { drill: d, answer } = drill(id);
  return grade(d, answer, { type: 'reach', rooms: rooms.map((r) => room(id, r)) });
}

function reply(id: string, r: Reply) {
  const { drill: d, answer } = drill(id);
  return grade(d, answer, r);
}

describe('reach (tocar salas)', () => {
  it('acierto: el conjunto exacto, en cualquier orden', () => {
    expect(reach('a1', ['inv', 'coc', 'sal'])).toEqual({ ok: true, rule: null, hint: '' });
  });

  it('regla 1: falta la sala de partida', () => {
    expect(reach('a1', ['sal', 'inv'])).toEqual({
      ok: false,
      rule: 'reach-stay',
      hint: 'En una hora también puede quedarse donde estaba: la Cocina también vale.',
    });
  });

  it('regla 2: una sala que toca la de partida pero sin puerta', () => {
    // El Salón y el Invernadero comparten pared en la Casa de prácticas, sin puerta.
    expect(reach('a3', ['coc', 'ves', 'inv', 'sal'])).toEqual({
      ok: false,
      rule: 'reach-no-door',
      hint: 'El Salón y el Invernadero se tocan, pero no hay puerta entre ellas.',
    });
  });

  it('regla 3: una sala a dos puertas o más', () => {
    expect(reach('a1', ['coc', 'sal', 'inv', 'bib'])).toEqual({
      ok: false,
      rule: 'reach-far',
      hint: 'La Biblioteca está a dos puertas: no da tiempo en una hora.',
    });
  });

  it('regla 3 con dos horas: el número de puertas y de horas cambia', () => {
    // Celia en la Bodega a las 21:00; a las 23:00 la Cocina queda a más de dos puertas.
    const g = reach('t1a', ['bib', 'est', 'sal', 'ves', 'com', 'bod', 'coc']);
    expect(g.rule).toBe('reach-far');
    expect(g.hint).toMatch(/^La Cocina está a (tres|cuatro) puertas: no da tiempo en dos horas\.$/);
  });

  it('regla 4: una sala que no cumple un rasgo', () => {
    expect(reach('t1d', ['sal', 'com', 'est'])).toEqual({ ok: false, rule: 'reach-feature', hint: 'El Estudio no tiene chimenea.' });
  });

  it('regla 5: encaja con una de las horas pero no con las dos', () => {
    expect(reach('t1c', ['inv', 'ves', 'coc'])).toEqual({ ok: false, rule: 'reach-both-hours', hint: 'Tiene que encajar con las dos horas a la vez.' });
  });

  it('sin regla que encaje (falta una sala que no es la de partida): solo la explicación', () => {
    expect(reach('a1', ['coc', 'sal'])).toEqual({ ok: false, rule: null, hint: '' });
  });
});

describe('tri y pick (verdadero, falso, no se puede saber, opciones)', () => {
  it('regla 6 (tri): responde V o F cuando no se puede saber', () => {
    expect(reply('a2', { type: 'tri', value: 'V' })).toEqual({
      ok: false,
      rule: 'not-proven',
      hint: 'Es posible, pero no está demostrado. Responder eso sería una corazonada.',
    });
  });

  it('regla 6 (pick): elige una opción cuando no se puede saber', () => {
    const t3d = drill('t3d').drill;
    expect(reply('t3d', { type: 'pick', value: t3d.ctx.suspects.findIndex((s) => s.name === 'Dora') }).rule).toBe('not-proven');
  });

  it('regla 7 (tri): responde "no se puede saber" cuando sí se puede', () => {
    expect(reply('a4', { type: 'tri', value: 'NS' })).toEqual({ ok: false, rule: 'knowable', hint: 'Sí se puede saber: hay una deducción que lo cierra.' });
  });

  it('regla 7 (pick): responde "no se puede saber" cuando sí se puede', () => {
    expect(reply('t3a', { type: 'pick', value: 'NS' }).rule).toBe('knowable');
  });

  it('regla 8: invierte verdadero y falso', () => {
    expect(reply('a4', { type: 'tri', value: 'F' })).toEqual({ ok: false, rule: 'reversed', hint: 'Es justo al revés.' });
  });

  it('pick con otra opción equivocada: sin regla, solo la explicación', () => {
    expect(reply('t3a', { type: 'pick', value: 0 })).toEqual({ ok: false, rule: null, hint: '' });
  });

  it('aciertos', () => {
    expect(reply('a4', { type: 'tri', value: 'V' }).ok).toBe(true);
    expect(reply('t3a', { type: 'pick', value: 2 }).ok).toBe(true);
    expect(reply('t3d', { type: 'pick', value: 'NS' }).ok).toBe(true);
  });
});

describe('remates (clue y contra)', () => {
  it('regla 9 (clue): una pista que no decide entre los dos', () => {
    expect(reply('r1', { type: 'decide', pick: 3 })).toEqual({ ok: false, rule: 'clue-irrelevant', hint: 'Esa pista no cambia nada entre los dos que quedan.' });
  });

  it('regla 10 (contra): una pista compatible con la hipótesis', () => {
    expect(reply('r2', { type: 'decide', pick: 0 })).toEqual({ ok: false, rule: 'contra-holds', hint: 'Con esa pista la hipótesis sigue en pie.' });
  });

  it('aciertos: la pista decisiva', () => {
    expect(reply('r1', { type: 'decide', pick: 2 }).ok).toBe(true);
    expect(reply('r2', { type: 'decide', pick: 1 }).ok).toBe(true);
    expect(reply('r3', { type: 'decide', pick: 2 }).ok).toBe(true);
  });
});

describe('respuesta de otro tipo', () => {
  it('es un error de programación, no un fallo de quien juega', () => {
    expect(() => reply('a1', { type: 'tri', value: 'V' })).toThrow(/no corresponde/);
  });
});
