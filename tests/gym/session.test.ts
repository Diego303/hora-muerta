import { describe, expect, it } from 'vitest';
import { composeSession, summarize } from '../../src/modes/gym/compose';
import { emptyProgress, HIST_SIZE, SESSIONS_KEPT, techOfDay, techProgress, withAnswer, withSession } from '../../src/modes/gym/progress';

describe('sesión de tres bloques (MODOS 3.4)', () => {
  it('5 de activación, 5 de la técnica del día y 3 remates', () => {
    const items = composeSession('tabla');
    expect(items).toHaveLength(13);
    expect(items.map((i) => i.block)).toEqual([0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2]);
    expect(items.slice(5, 10).every((i) => i.bank.drill.tech === 'tabla')).toBe(true);
    expect(items.slice(10).every((i) => i.bank.drill.tech === 'remate')).toBe(true);
  });

  it('el resumen cuenta aciertos por bloque y por técnica, y señala la más floja', () => {
    const items = composeSession('seguro');
    const results = items.map((_, i) => i !== 6 && i !== 7);
    const s = summarize(items, results);
    expect(s.ok).toBe(11);
    expect(s.total).toBe(13);
    expect(s.blocks).toEqual([
      ['Activación', 5, 5],
      ['Técnica del día', 3, 5],
      ['Remate', 3, 3],
    ]);
    expect(s.weakest).toBe('seguro');
  });

  it('sin fallos no hay técnica floja; si se sale a mitad, solo cuenta lo respondido', () => {
    const items = composeSession('alcance');
    expect(summarize(items, items.map(() => true)).weakest).toBeNull();
    const half = summarize(items, [true, false]);
    expect(half.ok).toBe(1);
    expect(Object.values(half.techs).reduce((n, t) => n + (t?.n ?? 0), 0)).toBe(2);
  });
});

describe('progreso en hm2:gym (MODOS 3.12)', () => {
  it('cada respuesta suma a su técnica y guarda los últimos 20 resultados', () => {
    let p = emptyProgress();
    for (let i = 0; i < 25; i++) p = withAnswer(p, 'tabla', i % 2 === 0);
    const t = techProgress(p, 'tabla');
    expect(t.n).toBe(25);
    expect(t.ok).toBe(13);
    expect(t.hist).toHaveLength(HIST_SIZE);
    expect(t.hist[t.hist.length - 1]).toBe(1);
    expect(t.level).toBe(1);
  });

  it('guarda como mucho las 30 últimas sesiones', () => {
    let p = emptyProgress();
    for (let i = 0; i < 35; i++) p = withSession(p, { date: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`, score: i, n: 13, tech: 'tabla' });
    expect(p.sessions).toHaveLength(SESSIONS_KEPT);
    expect(p.sessions[0].score).toBe(5);
  });
});

describe('técnica del día (regla del prototipo; F5 la completa)', () => {
  it('primero las que no se han practicado, en orden: seguro, tabla, alcance', () => {
    expect(techOfDay(emptyProgress())).toEqual({ tech: 'seguro', why: 'Todavía no la has practicado.' });
    const p = withAnswer(emptyProgress(), 'seguro', true);
    expect(techOfDay(p).tech).toBe('tabla');
  });

  it('con todas practicadas, la de menor acierto', () => {
    let p = emptyProgress();
    p = withAnswer(p, 'seguro', true);
    p = withAnswer(p, 'tabla', false);
    p = withAnswer(p, 'alcance', true);
    expect(techOfDay(p)).toEqual({ tech: 'tabla', why: 'Es tu técnica con menos aciertos (0 %).' });
  });
});
