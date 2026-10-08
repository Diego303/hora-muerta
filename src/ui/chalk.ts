// Tiza (§17.5): trazo libre en un <canvas> superpuesto al plano, escalado por
// devicePixelRatio, con las coordenadas guardadas en el espacio del viewBox
// del plano (no en píxeles de pantalla), tal como pide §19.4.
import type { ChalkStroke, GameStore } from '../game/store';

export interface ChalkHandle {
  redraw(): void;
  destroy(): void;
}

const STROKE_WIDTH = 3.2;
const ERASE_RADIUS = 14;

function get2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo obtener el contexto 2D del canvas de tiza.');
  return ctx;
}

export function setupChalk(canvas: HTMLCanvasElement, planWidth: number, planHeight: number, store: GameStore): ChalkHandle {
  const ctx = get2dContext(canvas);

  let drawing: ChalkStroke | null = null;

  function toViewBox(clientX: number, clientY: number): [number, number] {
    const rect = canvas.getBoundingClientRect();
    const x = rect.width === 0 ? 0 : ((clientX - rect.left) / rect.width) * planWidth;
    const y = rect.height === 0 ? 0 : ((clientY - rect.top) / rect.height) * planHeight;
    return [x, y];
  }

  function redraw(): void {
    const state = store.getState();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (canvas.width === 0 || planWidth === 0) return;
    const scale = canvas.width / planWidth;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = STROKE_WIDTH;
    const styles = getComputedStyle(document.documentElement);
    const strokes = state.strokes.filter((s) => s.hour === 'all' || s.hour === state.hour);
    const toDraw = drawing ? strokes.concat(drawing) : strokes;
    for (const stroke of toDraw) {
      // Los nombres de ChalkColor coinciden con los tokens de color --ink/--amber/--pencil.
      ctx.strokeStyle = styles.getPropertyValue(`--${stroke.color}`).trim() || '#b3261e';
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      stroke.points.forEach((point, i) => {
        if (i === 0) ctx.moveTo(point[0], point[1]);
        else ctx.lineTo(point[0], point[1]);
      });
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function resize(): void {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    redraw();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  function pointerDown(event: PointerEvent): void {
    const state = store.getState();
    if (state.mode !== 'chalk') return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    const point = toViewBox(event.clientX, event.clientY);
    if (state.eraseMode) {
      store.eraseStrokeNear(point, ERASE_RADIUS);
      redraw();
      return;
    }
    if (!store.requestStroke([Math.round(point[0]), Math.round(point[1])])) return;
    drawing = {
      color: state.chalkColor,
      hour: state.allLayer ? 'all' : state.hour,
      points: [[Math.round(point[0]), Math.round(point[1])]],
    };
  }

  function pointerMove(event: PointerEvent): void {
    if (!drawing) return;
    const point = toViewBox(event.clientX, event.clientY);
    const last = drawing.points[drawing.points.length - 1];
    if (Math.hypot(point[0] - last[0], point[1] - last[1]) < 2) return;
    drawing.points.push([Math.round(point[0]), Math.round(point[1])]);
    redraw();
  }

  function pointerUp(): void {
    if (!drawing) return;
    if (drawing.points.length === 1) {
      const [x, y] = drawing.points[0];
      drawing.points.push([x + 1, y + 1]);
    }
    const stroke = drawing;
    drawing = null;
    store.addStroke(stroke);
  }

  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('pointercancel', pointerUp);

  return {
    redraw,
    destroy() {
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerup', pointerUp);
      canvas.removeEventListener('pointercancel', pointerUp);
    },
  };
}
