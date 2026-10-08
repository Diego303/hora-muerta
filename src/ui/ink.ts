// Color de la letra sobre una ficha de color (la inicial de cada sospechoso): blanco o
// la tinta oscura del tema claro, el que más contraste dé según WCAG. Con letra blanca
// siempre, el ámbar se quedaba en 2,4:1; así ninguna ficha baja de 4:1. Puro.
const LIGHT = '#ffffff';
const DARK = '#15222c';

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(full.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** La letra que mejor se lee sobre `background` (un color #rrggbb o #rgb). */
export function inkOn(background: string): string {
  return contrast(LIGHT, background) >= contrast(DARK, background) ? LIGHT : DARK;
}
