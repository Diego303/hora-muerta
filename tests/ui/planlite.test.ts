import { describe, expect, it } from 'vitest';
import { MANSION } from '../../src/engine/content/maps';
import { planLiteMarkup, planLiteSize } from '../../src/ui/planlite';

const count = (haystack: string, needle: string): number => haystack.split(needle).length - 1;

describe('planLiteMarkup', () => {
  it('dibuja una sala por cada sala del mapa, con el tamaño del plano', () => {
    const markup = planLiteMarkup(MANSION);
    expect(count(markup, 'class="pl-room"')).toBe(MANSION.rooms.length);
    expect(planLiteSize(MANSION)).toEqual({ width: 12 * 40 + 16, height: 9 * 40 + 16 });
  });

  it('marca la sala de la víctima sin depender de ningún otro dato', () => {
    expect(planLiteMarkup(MANSION)).not.toContain('pl-victim');
    expect(planLiteMarkup(MANSION, { victimRoom: 0 })).toContain('class="pl-victim"');
  });

  it('las marcas llevan símbolo además de color: ✓ acertadas, ✗ sobrantes, borde discontinuo las que faltaron', () => {
    const markup = planLiteMarkup(MANSION, { marks: { ok: [0], bad: [1], miss: [2], no: [3] } });
    expect(count(markup, '✓')).toBe(1);
    expect(count(markup, '✗')).toBe(1);
    expect(count(markup, 'class="pl-miss"')).toBe(1);
    expect(count(markup, 'class="pl-no"')).toBe(1);
  });

  it('el camino numera cada puerta: una por cada paso entre salas', () => {
    const markup = planLiteMarkup(MANSION, { path: [0, 1, 2] });
    expect(count(markup, 'class="pl-path"')).toBe(1);
    expect(count(markup, 'class="pl-door"')).toBe(2);
    expect(markup).toContain('>1</text>');
    expect(markup).toContain('>2</text>');
  });

  it('el calor es la opacidad de cada sala, y solo se pinta donde hay calor', () => {
    const heat = [0, 0, 0, 0.5];
    const markup = planLiteMarkup(MANSION, { heat });
    expect(count(markup, 'class="pl-heat"')).toBe(1);
    expect(markup).toContain('fill-opacity="0.50"');
  });

  it('una ficha usa el color de su sospechoso y puede ir con borde discontinuo', () => {
    const markup = planLiteMarkup(MANSION, { tokens: [{ c: 0, r: 3 }, { c: 1, r: 3, dashed: true }] });
    expect(count(markup, '<g class="pl-token')).toBe(2);
    expect(markup).toContain('fill="#1f9e8c"');
    expect(markup).toContain('stroke-dasharray="3 2"');
  });

  it('escapa el texto de las etiquetas', () => {
    const markup = planLiteMarkup(MANSION, { tokens: [{ c: 0, r: 0, label: '<b>x</b>' }] });
    expect(markup).not.toContain('<b>x</b>');
    expect(markup).toContain('&lt;b&gt;x&lt;/b&gt;');
  });

  it('solo es interactiva con selectable: cada sala es un botón con su estado', () => {
    expect(planLiteMarkup(MANSION)).not.toContain('data-room');
    const markup = planLiteMarkup(MANSION, { selectable: true, selected: [2] });
    expect(count(markup, 'role="button"')).toBe(MANSION.rooms.length);
    expect(markup).toContain('data-room="2" role="button" tabindex="0" aria-pressed="true"');
    expect(markup).toContain('aria-pressed="false"');
  });
});
