// Miniplano compartido (docs/MODOS.md §1.3): el plano de una casa en pequeño,
// con fichas, marcas, camino con puertas numeradas y calor por sala. Lo usan el
// calentamiento y la vista previa del incendio. El marcado se genera como
// cadena (función pura, comprobable en Node); renderPlanLite solo lo escribe
// en un <svg> y conecta los toques.
import { CHIP_COLORS } from '../engine/content/cast';
import type { FloorPlan, Room } from '../engine/types';

export interface PlanLiteToken {
  c: number;
  r: Room;
  label?: string;
  /** Ficha de quien no está en la sala (borde discontinuo). */
  dashed?: boolean;
  /** Texto bajo la ficha, p. ej. la hora ("22:00"). */
  caption?: string;
  /** Color propio; si falta, el del índice `c` en la paleta de fichas. */
  color?: string;
}

export interface PlanLiteMarks {
  /** Acertadas: ✓. */
  ok?: Room[];
  /** Faltaron: borde discontinuo. */
  miss?: Room[];
  /** Sobrantes: ✗. */
  bad?: Room[];
  /** Descartadas ("no puede estar aquí"): aspa sobre la sala. */
  no?: Room[];
}

export interface PlanLiteOptions {
  victimRoom?: Room;
  tokens?: PlanLiteToken[];
  selectable?: boolean;
  /** Salas marcadas por quien responde (solo con selectable). */
  selected?: Room[];
  onToggle?: (r: Room) => void;
  marks?: PlanLiteMarks;
  /** Camino: salas en orden; cada puerta lleva su número. */
  path?: Room[];
  /** Opacidad de calor por sala (índice = Room), de 0 a 1. */
  heat?: number[];
  /** Puertas dibujadas como huecos en la pared (hace falta para contar puertas). */
  doors?: boolean;
  /** Nombre de cada sala y los iconos de sus rasgos (chimenea, ventana...). */
  labels?: boolean;
}

const UNIT = 40;
const PAD = 8;
const INSET = 4;
const FIRE = '#ff5a1f';
const VICTIM = '#b3261e';

export function planLiteSize(map: FloorPlan): { width: number; height: number } {
  return { width: map.w * UNIT + PAD * 2, height: map.h * UNIT + PAD * 2 };
}

function rectOf(map: FloorPlan, r: Room): { x: number; y: number; w: number; h: number } {
  const room = map.rooms[r];
  return { x: PAD + room.x * UNIT + INSET, y: PAD + room.y * UNIT + INSET, w: room.w * UNIT - 2 * INSET, h: room.h * UNIT - 2 * INSET };
}

/** Centro de una sala en coordenadas del miniplano (para dibujar encima, p. ej. el foco de un incendio). */
export function planLiteRoomCenter(map: FloorPlan, r: Room): { x: number; y: number } {
  return centerOf(map, r);
}

function centerOf(map: FloorPlan, r: Room): { x: number; y: number } {
  const q = rectOf(map, r);
  return { x: q.x + q.w / 2, y: q.y + q.h / 2 };
}

/** Punto medio de la pared compartida entre dos salas contiguas (la puerta). */
function doorOf(map: FloorPlan, a: Room, b: Room): { x: number; y: number } {
  const A = map.rooms[a];
  const B = map.rooms[b];
  const ox0 = Math.max(A.x, B.x);
  const ox1 = Math.min(A.x + A.w, B.x + B.w);
  if (ox1 > ox0) {
    const upper = A.y < B.y ? A : B;
    return { x: PAD + ((ox0 + ox1) / 2) * UNIT, y: PAD + (upper.y + upper.h) * UNIT };
  }
  const oy0 = Math.max(A.y, B.y);
  const oy1 = Math.min(A.y + A.h, B.y + B.h);
  const left = A.x < B.x ? A : B;
  return { x: PAD + (left.x + left.w) * UNIT, y: PAD + ((oy0 + oy1) / 2) * UNIT };
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Tamaño del nombre de sala en unidades del plano: en un móvil de 360 px el plano se
 * pinta a ~0,6, así que 16 se ven como ~10 px. */
const LABEL_SIZE = 16;
const LABEL_MIN = 11;
/** Ancho medio de un carácter, en ems, de la fuente del cuerpo en negrita. */
const CHAR_EM = 0.58;

/** Nombre de la sala dentro de su caja: en una línea si cabe; si no, en dos (por el
 * espacio que mejor reparte) si la sala es alta; y si aún no cabe, más pequeño. */
function labelMarkup(name: string, q: { x: number; y: number; w: number; h: number }): string {
  const room = q.w - 14;
  const width = (text: string, size: number): number => text.length * CHAR_EM * size;
  let lines = [name];
  if (width(name, LABEL_SIZE) > room && q.h >= 100 && name.includes(' ')) {
    const words = name.split(' ');
    let best = lines;
    for (let i = 1; i < words.length; i++) {
      const pair = [words.slice(0, i).join(' '), words.slice(i).join(' ')];
      if (best.length === 1 || Math.max(...pair.map((l) => l.length)) < Math.max(...best.map((l) => l.length))) best = pair;
    }
    lines = best;
  }
  const longest = Math.max(...lines.map((l) => l.length));
  const size = Math.max(LABEL_MIN, Math.min(LABEL_SIZE, room / (longest * CHAR_EM)));
  const tspans = lines.map((l, i) => `<tspan x="${q.x + 7}" dy="${i === 0 ? 0 : size * 1.1}">${esc(l)}</tspan>`).join('');
  return `<text class="pl-label" x="${q.x + 7}" y="${q.y + 6 + size}" font-size="${size.toFixed(1)}" aria-hidden="true">${tspans}</text>`;
}

/** Marcado del miniplano, sin tocar el DOM. */
export function planLiteMarkup(map: FloorPlan, options: PlanLiteOptions = {}): string {
  const selected = new Set(options.selected ?? []);
  const ok = new Set(options.marks?.ok ?? []);
  const miss = new Set(options.marks?.miss ?? []);
  const bad = new Set(options.marks?.bad ?? []);
  const no = new Set(options.marks?.no ?? []);
  let out = '';

  map.rooms.forEach((room, r) => {
    const q = rectOf(map, r);
    const interactive = options.selectable === true;
    const open = interactive ? ` data-room="${r}" role="button" tabindex="0" aria-pressed="${selected.has(r)}" aria-label="${esc(room.name)}${selected.has(r) ? ', seleccionada' : ''}"` : '';
    out += `<g class="pl-room-box"${open}>`;
    out += `<rect class="pl-room" x="${q.x}" y="${q.y}" width="${q.w}" height="${q.h}"/>`;
    const heat = options.heat?.[r] ?? 0;
    if (heat > 0) out += `<rect class="pl-heat" x="${q.x}" y="${q.y}" width="${q.w}" height="${q.h}" fill="${FIRE}" fill-opacity="${heat.toFixed(2)}"/>`;
    if (selected.has(r)) out += `<rect class="pl-selected" x="${q.x + 2}" y="${q.y + 2}" width="${q.w - 4}" height="${q.h - 4}"/>`;
    if (miss.has(r)) out += `<rect class="pl-miss" x="${q.x + 5}" y="${q.y + 5}" width="${q.w - 10}" height="${q.h - 10}"/>`;
    if (no.has(r)) {
      const c = centerOf(map, r);
      out += `<path class="pl-no" d="M${c.x - 14},${c.y - 14}L${c.x + 14},${c.y + 14}M${c.x + 14},${c.y - 14}L${c.x - 14},${c.y + 14}"/>`;
    }
    if (ok.has(r)) {
      const c = centerOf(map, r);
      out += `<text class="pl-mark pl-ok" x="${c.x}" y="${c.y + 8}" text-anchor="middle">✓</text>`;
    }
    if (bad.has(r)) {
      const c = centerOf(map, r);
      out += `<text class="pl-mark pl-bad" x="${c.x}" y="${c.y + 8}" text-anchor="middle">✗</text>`;
    }
    out += '</g>';
  });

  if (options.doors) {
    const index = new Map(map.rooms.map((room, i) => [room.id, i]));
    for (const [a, b] of map.edges) {
      const ra = index.get(a);
      const rb = index.get(b);
      if (ra === undefined || rb === undefined) continue;
      const d = doorOf(map, ra, rb);
      const A = map.rooms[ra];
      const B = map.rooms[rb];
      const stacked = Math.min(A.x + A.w, B.x + B.w) > Math.max(A.x, B.x);
      const [w, h] = stacked ? [22, INSET * 2 + 6] : [INSET * 2 + 6, 22];
      out += `<rect class="pl-door-gap" x="${d.x - w / 2}" y="${d.y - h / 2}" width="${w}" height="${h}" aria-hidden="true"/>`;
    }
  }

  if (options.labels) {
    map.rooms.forEach((room, r) => {
      const q = rectOf(map, r);
      out += labelMarkup(room.name, q);
      room.f.forEach((fid, k) => {
        const feature = map.features.find((f) => f.id === fid);
        if (feature) out += `<use class="pl-ficon" href="#ic-${feature.icon}" x="${q.x + 7 + k * 22}" y="${q.y + q.h - 25}" width="18" height="18"><title>${esc(feature.label)}</title></use>`;
      });
    });
  }

  if (options.victimRoom !== undefined) {
    const c = centerOf(map, options.victimRoom);
    out += `<g class="pl-victim" aria-hidden="true"><circle cx="${c.x}" cy="${c.y}" r="7" fill="${VICTIM}" stroke="#fff" stroke-width="1.6"/></g>`;
  }

  const tokens = options.tokens ?? [];
  const perRoom = new Map<Room, number>();
  for (const t of tokens) {
    const i = perRoom.get(t.r) ?? 0;
    perRoom.set(t.r, i + 1);
    const total = tokens.filter((x) => x.r === t.r).length;
    const c = centerOf(map, t.r);
    const dx = (i - (total - 1) / 2) * (t.caption ? 44 : 28);
    const cy = t.caption ? c.y - 4 : c.y;
    const color = t.color ?? CHIP_COLORS[t.c % CHIP_COLORS.length];
    out += `<g class="pl-token${t.dashed ? ' dashed' : ''}"><circle cx="${c.x + dx}" cy="${cy}" r="${t.caption ? 13 : 12}" fill="${color}" stroke="${t.dashed ? 'currentColor' : '#fff'}" stroke-width="${t.dashed ? 2.4 : 1.6}"${t.dashed ? ' stroke-dasharray="4 3"' : ''}/>`;
    out += `<text x="${c.x + dx}" y="${cy + 4.5}" text-anchor="middle" class="pl-token-label">${esc(t.label ?? String(t.c + 1))}</text>`;
    if (t.caption) out += `<text x="${c.x + dx}" y="${cy + 29}" text-anchor="middle" class="pl-token-caption">${esc(t.caption)}</text>`;
    out += '</g>';
  }

  const path = options.path ?? [];
  if (path.length > 1) {
    const pts = path.map((r) => centerOf(map, r));
    out += `<path class="pl-path" d="M${pts.map((p) => `${p.x},${p.y}`).join('L')}" fill="none"/>`;
    for (let i = 0; i < path.length - 1; i++) {
      const d = doorOf(map, path[i], path[i + 1]);
      out += `<g class="pl-door" aria-hidden="true"><circle class="pl-door-dot" cx="${d.x}" cy="${d.y}" r="10"/><text x="${d.x}" y="${d.y + 4.5}" text-anchor="middle">${i + 1}</text></g>`;
    }
  }

  return out;
}

/** Pinta el miniplano en un <svg>: marcado, viewBox y, si es seleccionable, toques y teclado. */
export function renderPlanLite(svg: SVGSVGElement, map: FloorPlan, options: PlanLiteOptions = {}): void {
  const { width, height } = planLiteSize(map);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.classList.add('planlite');
  svg.innerHTML = planLiteMarkup(map, options);
  const toggle = options.onToggle;
  if (options.selectable && toggle) {
    const roomOf = (target: EventTarget | null): Room | null => {
      const box = target instanceof Element ? target.closest<SVGGElement>('[data-room]') : null;
      return box ? Number(box.dataset.room) : null;
    };
    svg.onclick = (e) => {
      const r = roomOf(e.target);
      if (r !== null) toggle(r);
    };
    svg.onkeydown = (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const r = roomOf(e.target);
      if (r === null) return;
      e.preventDefault();
      toggle(r);
    };
  } else {
    svg.onclick = null;
    svg.onkeydown = null;
  }
}
