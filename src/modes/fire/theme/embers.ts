// Chispas del Modo Incendio (docs/MODOS.md 2.7): un único <canvas> fijo, como mucho
// 80 partículas y una intensidad que sube con el calor. Se paran con la pestaña
// oculta y no arrancan con movimiento reducido. Devuelve cómo pararlas del todo.
import { prefersReducedMotion } from '../../../ui/a11y';

export const MAX_EMBERS = 80;

interface Ember {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  max: number;
  phase: number;
}

/** `heat` entre 0 y 1: cuántas chispas nacen y lo rápido que suben. */
export function startEmbers(heat: () => number): () => void {
  if (prefersReducedMotion()) return () => undefined;
  const canvas = document.createElement('canvas');
  canvas.className = 'fire-embers';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return () => undefined;
  }

  const embers: Ember[] = [];
  let width = 0;
  let height = 0;
  let dpr = 1;
  let frame: number | null = null;

  function resize(): void {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    width = canvas.width = Math.round(window.innerWidth * dpr);
    height = canvas.height = Math.round(window.innerHeight * dpr);
  }

  function step(): void {
    frame = null;
    if (!ctx) return;
    const h = Math.max(0, Math.min(1, heat()));
    if (embers.length < MAX_EMBERS && Math.random() < 0.15 + h * 0.6) {
      embers.push({
        x: Math.random() * width,
        y: height + 8 * dpr,
        vx: (Math.random() - 0.5) * 0.4 * dpr,
        vy: -(0.45 + Math.random() * 1.3) * dpr * (0.8 + h),
        r: (0.7 + Math.random() * 1.7) * dpr,
        life: 0,
        max: 220 + Math.random() * 240,
        phase: Math.random() * 6,
      });
    }
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = embers.length - 1; i >= 0; i--) {
      const p = embers[i];
      p.life += 1;
      p.y += p.vy;
      p.x += p.vx + Math.sin((p.life + p.phase * 30) / 22) * 0.35 * dpr;
      const alpha = Math.max(0, 1 - p.life / p.max);
      if (alpha <= 0 || p.y < -10) {
        embers.splice(i, 1);
        continue;
      }
      ctx.fillStyle = `rgba(255,${120 + Math.floor(90 * alpha)},40,${(alpha * 0.75).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    schedule();
  }

  function schedule(): void {
    if (frame === null && !document.hidden) frame = requestAnimationFrame(step);
  }

  function onVisibility(): void {
    if (document.hidden) {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    } else {
      schedule();
    }
  }

  resize();
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', onVisibility);
  schedule();

  return () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', onVisibility);
    canvas.remove();
  };
}
