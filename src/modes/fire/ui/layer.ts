// Capa de fuego sobre el plano (docs/MODOS.md 2.6): carbón en las salas en llamas,
// brillo en sus bordes y un aviso naranja con cuenta atrás en las que van a arder.
// Solo se vuelve a dibujar cuando cambia el estado de alguna sala; las cuentas atrás
// se actualizan como texto, para que las llamas no reinicien su animación cada segundo.
import type { PlanHandle } from '../../../ui/plan';
import { roomState, type RoomFire } from '../timeline';
import type { FireRun } from '../session';

const SVG_NS = 'http://www.w3.org/2000/svg';
let seq = 0;

export interface FireLayer {
  update(): void;
  destroy(): void;
}

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent?: Element): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  parent?.appendChild(node);
  return node;
}

/** m:ss, como el reloj de la cabecera. */
export function clockText(seconds: number): string {
  const whole = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function mountFireLayer(svg: SVGSVGElement, plan: PlanHandle, roomCount: number, run: FireRun, ign: readonly number[]): FireLayer {
  const id = ++seq;
  const layer = el('g', { class: 'fire-layer', 'pointer-events': 'none', 'aria-hidden': 'true' });
  // Las salas van en el grupo que el plano pinta primero; la capa de fuego va justo después.
  svg.querySelector(':scope > g')?.after(layer);

  const defs = el('defs', {}, layer);
  const charId = `fire-char-${id}`;
  const pattern = el('pattern', { id: charId, width: 14, height: 14, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(35)' }, defs);
  el('rect', { width: 14, height: 14, fill: '#140b08' }, pattern);
  el('path', { d: 'M0 3H14M0 10H14', stroke: '#2a1a13', 'stroke-width': 3 }, pattern);

  let signature = '';
  let labels = new Map<number, SVGTextElement>();

  function rebuild(states: RoomFire[]): void {
    while (layer.childNodes.length > 1) layer.removeChild(layer.lastChild as Node);
    labels = new Map();
    for (let room = 0; room < roomCount; room++) {
      const state = states[room];
      if (state === 'cold') continue;
      const rect = plan.roomRect(room);
      const inset = 3;
      const x = rect.x + inset;
      const y = rect.y + inset;
      const w = rect.w - inset * 2;
      const h = rect.h - inset * 2;
      if (state === 'burning') {
        el('rect', { class: 'fl-char', x, y, width: w, height: h, fill: `url(#${charId})` }, layer);
        el('rect', { class: 'fl-glow', x, y, width: w, height: h }, layer);
        el('path', { class: 'fl-flame', d: flamePath(rect.x + rect.w / 2, rect.y + rect.h / 2) }, layer);
        const text = el('text', { class: 'fl-tag', x: rect.x + 8, y: rect.y + 18 }, layer);
        text.textContent = 'En llamas';
      } else {
        el('rect', { class: 'fl-heat', x, y, width: w, height: h }, layer);
        const text = el('text', { class: 'fl-count', x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 + 6, 'text-anchor': 'middle' }, layer);
        labels.set(room, text);
      }
    }
  }

  function refreshLabels(): void {
    const now = run.consumed();
    for (const [room, text] of labels) text.textContent = clockText(ign[room] - now);
  }

  return {
    update() {
      const states: RoomFire[] = [];
      for (let room = 0; room < roomCount; room++) states.push(roomState(ign, room, run.consumed()));
      const next = states.map((s, room) => `${room}${s[0]}`).join('');
      if (next !== signature) {
        signature = next;
        rebuild(states);
      }
      refreshLabels();
    },
    destroy() {
      layer.remove();
    },
  };
}

/** Llama pequeña sobre la sala (un triángulo con dos lenguas). Se anima con CSS. */
function flamePath(cx: number, cy: number): string {
  const s = 9;
  return `M${cx},${cy - s}C${cx + s * 0.6},${cy - s * 0.2} ${cx + s * 0.4},${cy + s * 0.6} ${cx},${cy + s * 0.4}C${cx - s * 0.4},${cy + s * 0.6} ${cx - s * 0.6},${cy - s * 0.2} ${cx},${cy - s}Z`;
}
