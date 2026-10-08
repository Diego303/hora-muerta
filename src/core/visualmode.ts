// Cambio de modo visual (docs/MODOS.md §1.2): fija data-mode en <html> y, sin
// movimiento reducido, un destello breve: "ignite" al entrar en el fuego y
// "fade" al salir. Un único elemento que se borra al terminar su animación.
import type { VisualMode } from './router';

export type Veil = 'ignite' | 'fade';

export function veilFor(previous: VisualMode, next: VisualMode, reducedMotion: boolean): Veil | null {
  if (reducedMotion || previous === next) return null;
  return next === 'fuego' ? 'ignite' : 'fade';
}

export function applyVisualMode(next: VisualMode, previous: VisualMode, reducedMotion: boolean): void {
  document.querySelectorAll('.mode-veil').forEach((old) => old.remove());
  document.documentElement.dataset.mode = next ?? '';
  const veil = veilFor(previous, next, reducedMotion);
  if (!veil) return;
  const el = document.createElement('div');
  el.className = `mode-veil ${veil}`;
  el.setAttribute('aria-hidden', 'true');
  el.addEventListener('animationend', () => el.remove(), { once: true });
  document.body.appendChild(el);
}
