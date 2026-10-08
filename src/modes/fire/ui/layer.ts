// Capa de fuego sobre un plano (docs/MODOS.md 2.6): humo mientras no arde nada,
// carbón y llama en las salas en llamas, y aviso naranja con cuenta atrás en las
// que van a arder. Solo se vuelve a dibujar cuando cambia el estado de alguna
// sala; las cuentas atrás se actualizan como texto, para que las llamas no
// reinicien su animación cada segundo. Sirve igual para el plano normal y el ampliado.
import type { PlanHandle } from '../../../ui/plan';
import { FIRE_SMOKE_S } from '../config';
import { clockText } from '../status';
import { roomState, type RoomFire } from '../timeline';

const SVG_NS = 'http://www.w3.org/2000/svg';
let seq = 0;

export interface FireLayer {
  update(t: number): void;
  destroy(): void;
}

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent?: Element): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  parent?.appendChild(node);
  return node;
}

/** Llama pequeña sobre la sala. Se anima con CSS. */
function flamePath(cx: number, cy: number): string {
  const s = 9;
  return `M${cx},${cy - s}C${cx + s * 0.6},${cy - s * 0.2} ${cx + s * 0.4},${cy + s * 0.6} ${cx},${cy + s * 0.4}C${cx - s * 0.4},${cy + s * 0.6} ${cx - s * 0.6},${cy - s * 0.2} ${cx},${cy - s}Z`;
}

export function mountFireLayer(svg: SVGSVGElement, plan: PlanHandle, ign: readonly number[]): FireLayer {
  const id = ++seq;
  const roomCount = ign.length;
  const layer = el('g', { class: 'fire-layer', 'pointer-events': 'none', 'aria-hidden': 'true' });
  // Las salas son el primer grupo que pinta el plano; la capa va justo encima de
  // ellas y debajo de puertas, nombres, marcas y fichas.
  svg.querySelector(':scope > g')?.after(layer);

  const defs = el('defs', {}, layer);
  const charId = `fire-char-${id}`;
  const pattern = el('pattern', { id: charId, width: 14, height: 14, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(35)' }, defs);
  el('rect', { width: 14, height: 14, fill: '#140b08' }, pattern);
  el('path', { d: 'M0 3H14M0 10H14', stroke: '#2a1a13', 'stroke-width': 3 }, pattern);
  const content = el('g', {}, layer);

  let signature = '';
  let countdowns = new Map<number, SVGTextElement>();

  function rebuild(states: RoomFire[], smoke: boolean): void {
    content.replaceChildren();
    countdowns = new Map();
    if (smoke) el('rect', { class: 'fl-smoke', x: 0, y: 0, width: plan.width, height: plan.height }, content);
    for (let room = 0; room < roomCount; room++) {
      const state = states[room];
      if (state === 'cold') continue;
      const rect = plan.roomRect(room);
      const inset = 3;
      const box = { x: rect.x + inset, y: rect.y + inset, width: rect.w - inset * 2, height: rect.h - inset * 2 };
      if (state === 'burning') {
        el('rect', { class: 'fl-char', ...box, fill: `url(#${charId})` }, content);
        el('rect', { class: 'fl-glow', ...box }, content);
        el('path', { class: 'fl-flame', d: flamePath(rect.x + rect.w / 2, rect.y + rect.h / 2) }, content);
        const tag = el('text', { class: 'fl-tag', x: rect.x + 8, y: rect.y + rect.h - 10 }, content);
        tag.textContent = 'En llamas';
      } else {
        el('rect', { class: 'fl-heat', ...box }, content);
        countdowns.set(room, el('text', { class: 'fl-count', x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 + 7, 'text-anchor': 'middle' }, content));
      }
    }
  }

  return {
    update(t) {
      const states: RoomFire[] = [];
      for (let room = 0; room < roomCount; room++) states.push(roomState(ign, room, t));
      const smoke = t < FIRE_SMOKE_S;
      const next = `${smoke ? 's' : '-'}${states.map((s) => s[0]).join('')}`;
      if (next !== signature) {
        signature = next;
        rebuild(states, smoke);
      }
      for (const [room, text] of countdowns) text.textContent = clockText(ign[room] - t);
    },
    destroy() {
      layer.remove();
    },
  };
}
