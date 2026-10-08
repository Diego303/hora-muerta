import { describe, expect, it } from 'vitest';
import type { Level } from '../../src/modes/gym/adapt';
import { planSession, summarize, type SessionItem } from '../../src/modes/gym/compose';
import { DRILLS } from '../../src/modes/gym/drills';
import { emptyProgress, type GymProgress } from '../../src/modes/gym/progress';
import type { Tech } from '../../src/modes/gym/types';

/** Progreso ya practicado (no es la primera vez) con estos niveles. */
function atLevels(levels: Partial<Record<Tech, Level>>): GymProgress {
  const p = { ...emptyProgress(), done: 1 };
  for (const [tech, level] of Object.entries(levels) as [Tech, Level][]) p.tech[tech] = { level, hist: [1], ok: 1, n: 1, atLevel: 1 };
  return p;
}

const ids = (items: readonly SessionItem[]): string[] => items.map((i) => i.bank.drill.id);
const inBlock = (items: readonly SessionItem[], b: number): SessionItem[] => items.filter((i) => i.block === b);

describe('sesión de tres bloques (MODOS 3.4)', () => {
  it('5 de activación (alcance y seguro, solo reach y tri, a tu nivel menos 1), 5 de la técnica del día y 3 remates', () => {
    const { items } = planSession(DRILLS, atLevels({ alcance: 2, seguro: 1, tabla: 1 }), 'normal', 'tabla');
    expect(items).toHaveLength(13);
    expect(items.map((i) => i.block)).toEqual([0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2]);
    const warm = inBlock(items, 0);
    expect(warm.every((i) => ['alcance', 'seguro'].includes(i.bank.drill.tech) && ['reach', 'tri'].includes(i.bank.drill.type))).toBe(true);
    expect(warm.every((i) => i.bank.level === 1)).toBe(true);
    expect(inBlock(items, 1).every((i) => i.bank.drill.tech === 'tabla')).toBe(true);
    expect(inBlock(items, 2).every((i) => i.bank.drill.tech === 'remate')).toBe(true);
    expect(new Set(ids(items)).size).toBe(13);
  });

  it('la técnica del día va a tu nivel y, si no hay bastantes, completa con el nivel más cercano', () => {
    const { items } = planSession(DRILLS, atLevels({ tabla: 3 }), 'normal', 'tabla');
    expect(inBlock(items, 1).map((i) => i.bank.level)).toEqual([3, 3, 3, 2, 1]);
    const lv2 = planSession(DRILLS, atLevels({ seguro: 2 }), 'normal', 'seguro');
    expect(inBlock(lv2.items, 1).every((i) => i.bank.level === 2)).toBe(true);
  });

  it('la primera vez es de diagnóstico: 2 de cada técnica en la activación, a nivel 1 si lo hay', () => {
    const { items, kind } = planSession(DRILLS, emptyProgress(), 'diagnostico', 'seguro');
    expect(kind).toBe('diagnostico');
    const warm = inBlock(items, 0);
    expect(warm.map((i) => i.bank.drill.tech)).toEqual(['alcance', 'seguro', 'tabla', 'remate', 'alcance', 'seguro', 'tabla', 'remate']);
    expect(warm.filter((i) => i.bank.drill.tech === 'alcance' || i.bank.drill.tech === 'seguro').every((i) => i.bank.level === 1)).toBe(true);
    // Solo hay un ejercicio de tabla de nivel 1: el segundo es del nivel más cercano.
    expect(warm.filter((i) => i.bank.drill.tech === 'tabla').map((i) => i.bank.level)).toEqual([1, 2]);
    // El primer ejercicio es el de siempre: Bruno en la Cocina (a1).
    expect(warm[0].bank.drill.id).toBe('a1');
    // El banco del prototipo tiene 6 de seguro y 2 ya salieron: el bloque se queda en 4 (F6 amplía el banco).
    expect(inBlock(items, 1).map((i) => i.bank.drill.tech)).toEqual(['seguro', 'seguro', 'seguro', 'seguro']);
    // Con 3 remates en el banco, el bloque de remate se queda con el que sobra.
    expect(new Set(ids(items)).size).toBe(items.length);
  });

  it('"Practicar remates": un solo bloque de remates, hasta 5 (el banco del prototipo tiene 3)', () => {
    const { items } = planSession(DRILLS, atLevels({}), 'remates', 'seguro');
    expect(items.every((i) => i.block === 2 && i.bank.drill.tech === 'remate')).toBe(true);
    expect(items).toHaveLength(3);
  });
});

describe('sin repeticiones (MODOS 3.6)', () => {
  it('un ejercicio no vuelve hasta agotar su grupo de técnica y nivel', () => {
    const alcance = (plan: { items: SessionItem[] }): string[] => ids(inBlock(plan.items, 0).filter((i) => i.bank.drill.tech === 'alcance'));
    const first = planSession(DRILLS, atLevels({ alcance: 1, seguro: 1 }), 'normal', 'tabla');
    expect(alcance(first)).toEqual(['a1', 'a3', 'a4']);
    const second = planSession(DRILLS, first.progress, 'normal', 'tabla');
    expect(alcance(second)).toEqual(['a5', 't1b', 't1e']);
    expect(second.progress.served['alcance:1']).toHaveLength(6);
    // Grupo agotado: vuelve a empezar.
    const third = planSession(DRILLS, second.progress, 'normal', 'tabla');
    expect(alcance(third)).toEqual(['a1', 'a3', 'a4']);
    expect(third.progress.served['alcance:1']).toEqual(['a1', 'a3', 'a4']);
  });

  it('nunca repite un ejercicio dentro de la misma sesión', () => {
    let p = atLevels({ alcance: 1, seguro: 1, tabla: 1 });
    for (let k = 0; k < 6; k++) {
      const plan = planSession(DRILLS, p, 'normal', 'alcance');
      expect(new Set(ids(plan.items)).size).toBe(plan.items.length);
      p = plan.progress;
    }
  });
});

describe('repaso de fallados', () => {
  it('los vencidos vuelven primero, cada uno en su bloque y marcados como repaso', () => {
    const p: GymProgress = {
      ...atLevels({ tabla: 1 }),
      done: 5,
      review: [
        { id: 't3b', due: 5 },
        { id: 'r2', due: 4 },
        { id: 'a2', due: 3 },
        { id: 't3c', due: 6 },
      ],
    };
    const { items } = planSession(DRILLS, p, 'normal', 'tabla');
    expect(inBlock(items, 0)[0]).toMatchObject({ review: true, bank: { drill: { id: 'a2' } } });
    expect(inBlock(items, 1)[0]).toMatchObject({ review: true, bank: { drill: { id: 't3b' } } });
    expect(inBlock(items, 2)[0]).toMatchObject({ review: true, bank: { drill: { id: 'r2' } } });
    // Aún no vencido: no sale como repaso.
    expect(items.some((i) => i.review && i.bank.drill.id === 't3c')).toBe(false);
    expect(items).toHaveLength(13);
  });
});

describe('resumen', () => {
  it('cuenta aciertos por bloque y por técnica, y señala la más floja', () => {
    const { items } = planSession(DRILLS, atLevels({}), 'normal', 'tabla');
    const results = items.map((_, i) => i !== 6 && i !== 7);
    const s = summarize(items, results);
    expect(s.ok).toBe(11);
    expect(s.total).toBe(13);
    expect(s.blocks).toEqual([
      ['Activación', 5, 5],
      ['Técnica del día', 3, 5],
      ['Remate', 3, 3],
    ]);
    expect(s.weakest).toBe('tabla');
  });

  it('sin fallos no hay técnica floja; si se sale a mitad, solo cuenta lo respondido', () => {
    const { items } = planSession(DRILLS, atLevels({}), 'normal', 'alcance');
    expect(summarize(items, items.map(() => true)).weakest).toBeNull();
    const half = summarize(items, [true, false]);
    expect(half.ok).toBe(1);
    expect(Object.values(half.techs).reduce((n, t) => n + (t?.n ?? 0), 0)).toBe(2);
  });

  it('una sesión de remates tiene un solo bloque', () => {
    const { items } = planSession(DRILLS, atLevels({}), 'remates', 'seguro');
    expect(summarize(items, items.map(() => true)).blocks).toEqual([['Remate', 3, 3]]);
  });
});
