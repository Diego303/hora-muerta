// Contraste AA de la paleta de fuego (docs/MODOS.md 2.7), leído de la hoja de estilos
// real: si alguien cambia un color de tokens.css, esta prueba lo vigila.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function fireTokens(): Record<string, string> {
  const css = readFileSync(path.join(process.cwd(), 'src', 'styles', 'tokens.css'), 'utf8');
  const block = /:root\[data-mode='fuego'\]\s*\{([^}]*)\}/.exec(css)?.[1];
  if (!block) throw new Error('No se encontró el bloque de la paleta de fuego en tokens.css.');
  const tokens: Record<string, string> = {};
  for (const [, name, value] of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) tokens[name] = value;
  return tokens;
}

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** color-mix(in srgb, a p%, b) */
function mix(a: string, b: string, p: number): string {
  const [ra, ga, ba] = rgb(a);
  const [rb, gb, bb] = rgb(b);
  const ch = (x: number, y: number): string => Math.round(x * p + y * (1 - p)).toString(16).padStart(2, '0');
  return `#${ch(ra, rb)}${ch(ga, gb)}${ch(ba, bb)}`;
}

const T = fireTokens();
const surfaces = { paper: T.paper, panel: T.panel, room: T.room };
const statusBg = mix(T.pencil, T.panel, 0.14);

describe('paleta de fuego: contraste AA (4,5:1 para texto, 3:1 para bordes de control)', () => {
  it('existen todos los tokens que usa el modo', () => {
    for (const name of ['paper', 'panel', 'room', 'ink', 'ink-2', 'grid', 'wall', 'pencil', 'on-pencil', 'amber', 'focus']) {
      expect(T[name], name).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it.each(Object.entries(surfaces))('texto principal y secundario sobre %s', (_name, bg) => {
    expect(contrast(T.ink, bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(T['ink-2'], bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('texto de acento (brasa y llama) sobre hollín y panel', () => {
    for (const bg of [T.paper, T.panel]) {
      expect(contrast(T.pencil, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(T.amber, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('texto oscuro sobre brasa (botón rojo, reloj del último minuto, "Ardiendo")', () => {
    expect(contrast(T['on-pencil'], T.pencil)).toBeGreaterThanOrEqual(4.5);
  });

  it('texto oscuro sobre llama (mecha de la pista, medalla conseguida)', () => {
    expect(contrast(T['on-pencil'], T.amber)).toBeGreaterThanOrEqual(4.5);
  });

  it('texto de la línea de estado sobre su fondo teñido', () => {
    expect(contrast(T.ink, statusBg)).toBeGreaterThanOrEqual(4.5);
  });

  it('bordes de control y paredes del plano: 3:1 o más', () => {
    for (const bg of Object.values(surfaces)) {
      expect(contrast(T.grid, bg)).toBeGreaterThanOrEqual(3);
      expect(contrast(T.wall, bg)).toBeGreaterThanOrEqual(3);
      expect(contrast(T.focus, bg)).toBeGreaterThanOrEqual(3);
    }
  });
});
