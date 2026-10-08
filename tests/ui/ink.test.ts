// Letra sobre las fichas de color (ui/ink.ts): siempre la que más contrasta.
import { describe, expect, it } from 'vitest';
import { CHIP_COLORS } from '../../src/engine/content/cast';
import { contrast, inkOn } from '../../src/ui/ink';

describe('inkOn', () => {
  it.each([...CHIP_COLORS])('%s: la letra elegida es la de más contraste y no baja de 4:1', (color) => {
    const ink = inkOn(color);
    const other = ink === '#ffffff' ? '#15222c' : '#ffffff';
    expect(contrast(ink, color)).toBeGreaterThanOrEqual(contrast(other, color));
    expect(contrast(ink, color)).toBeGreaterThanOrEqual(4);
  });

  it('el ámbar, que con blanco se quedaba en 2,4:1, lleva letra oscura', () => {
    expect(contrast('#ffffff', '#d99a1c')).toBeLessThan(2.5);
    expect(inkOn('#d99a1c')).toBe('#15222c');
  });

  it('acepta colores cortos (#rgb)', () => {
    expect(inkOn('#000')).toBe('#ffffff');
    expect(inkOn('#fff')).toBe('#15222c');
  });
});
