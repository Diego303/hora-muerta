// Render del plano (SVG), portado de v1 (buildPlan). Vive en ui/ porque usa el DOM;
// el motor (src/engine) no depende de esto.
import type { FeatureIcon, MapDef, RoomDef } from '../engine/types';

const SVGNS = 'http://www.w3.org/2000/svg';
const GRID = 40;
const PAD = 8;
const INSET = 4;

const ICON_HREF: Record<FeatureIcon, string> = {
  fire: '#ic-fire',
  window: '#ic-window',
  bed: '#ic-bed',
  case: '#ic-case',
  sky: '#ic-sky',
  balcony: '#ic-balcony',
  wave: '#ic-wave',
  porthole: '#ic-porthole',
  stage: '#ic-stage',
  mirror: '#ic-mirror',
};

export interface SuspectView {
  name: string;
  init: string;
  color: string;
}

export interface PlanOptions {
  /** Si es false (portada, reconstrucción), el plano no tiene zonas táctiles. */
  interactive?: boolean;
  crimeRoom: number;
  victimLabel: string;
}

export type MarkValue = 0 | 1 | 2; // 0 = sin marca, 1 = estaba (✓), 2 = no estaba (✗)

export interface PlanHandle {
  width: number;
  height: number;
  hits: SVGRectElement[];
  setCrime(on: boolean): void;
  marks(get: (room: number, suspect: number) => MarkValue, suspects: SuspectView[]): void;
  highlight(room: number | null): void;
  tokens(roomsAt: number[] | null, suspects: SuspectView[], show: boolean): void;
}

interface RoomRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
  parent?: SVGElement,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVGNS, tag) as SVGElementTagNameMap[K];
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (parent) parent.appendChild(node);
  return node;
}

function roomSlot(rect: RoomRect, index: number): [number, number] {
  const perRow = Math.max(1, Math.floor((rect.w - 14) / 25));
  return [rect.x + 18 + (index % perRow) * 25, rect.y + 42 + Math.floor(index / perRow) * 25];
}

function findRoom(map: MapDef, id: string): RoomDef {
  const room = map.rooms.find((r) => r.id === id);
  if (!room) throw new Error(`Sala desconocida en ${map.id}: ${id}`);
  return room;
}

export function buildPlan(svg: SVGSVGElement, map: MapDef, opts: PlanOptions): PlanHandle {
  svg.innerHTML = '';
  const width = map.w * GRID + PAD * 2;
  const height = map.h * GRID + PAD * 2;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const gRooms = svgEl('g', {}, svg);
  const gDoors = svgEl('g', {}, svg);
  const gLabels = svgEl('g', {}, svg);
  const gCrime = svgEl('g', {}, svg);
  const gMarks = svgEl('g', {}, svg);
  const gTokens = svgEl('g', {}, svg);
  const gHits = svgEl('g', {}, svg);

  const rects: RoomRect[] = map.rooms.map((r) => ({
    x: PAD + r.x * GRID + INSET,
    y: PAD + r.y * GRID + INSET,
    w: r.w * GRID - 2 * INSET,
    h: r.h * GRID - 2 * INSET,
  }));

  rects.forEach((r) => svgEl('rect', { x: r.x, y: r.y, width: r.w, height: r.h, class: 'room' }, gRooms));

  for (const [a, b] of map.edges) {
    const roomA = findRoom(map, a);
    const roomB = findRoom(map, b);
    const ox0 = Math.max(roomA.x, roomB.x);
    const ox1 = Math.min(roomA.x + roomA.w, roomB.x + roomB.w);
    const oy0 = Math.max(roomA.y, roomB.y);
    const oy1 = Math.min(roomA.y + roomA.h, roomB.y + roomB.h);
    if (ox1 > ox0) {
      const top = roomA.y < roomB.y ? roomA : roomB;
      const bottom = top === roomA ? roomB : roomA;
      const cx = PAD + ((ox0 + ox1) / 2) * GRID;
      const y0 = PAD + (top.y + top.h) * GRID - INSET - 3;
      const y1 = PAD + bottom.y * GRID + INSET + 3;
      svgEl('rect', { x: cx - 11, y: y0, width: 22, height: y1 - y0, class: 'door' }, gDoors);
      svgEl('line', { x1: cx - 11, y1: y0 + 1, x2: cx - 11, y2: y1 - 1, class: 'jamb' }, gDoors);
      svgEl('line', { x1: cx + 11, y1: y0 + 1, x2: cx + 11, y2: y1 - 1, class: 'jamb' }, gDoors);
    } else {
      const left = roomA.x < roomB.x ? roomA : roomB;
      const right = left === roomA ? roomB : roomA;
      const cy = PAD + ((oy0 + oy1) / 2) * GRID;
      const x0 = PAD + (left.x + left.w) * GRID - INSET - 3;
      const x1 = PAD + right.x * GRID + INSET + 3;
      svgEl('rect', { x: x0, y: cy - 11, width: x1 - x0, height: 22, class: 'door' }, gDoors);
      svgEl('line', { x1: x0 + 1, y1: cy - 11, x2: x1 - 1, y2: cy - 11, class: 'jamb' }, gDoors);
      svgEl('line', { x1: x0 + 1, y1: cy + 11, x2: x1 - 1, y2: cy + 11, class: 'jamb' }, gDoors);
    }
  }

  map.rooms.forEach((room, i) => {
    const rect = rects[i];
    const label = svgEl('text', { x: rect.x + 9, y: rect.y + 20, class: 'rlab' }, gLabels);
    label.textContent = room.name;
    room.f.forEach((featureId, k) => {
      const feature = map.features.find((f) => f.id === featureId);
      if (!feature) return;
      svgEl(
        'use',
        { href: ICON_HREF[feature.icon], x: rect.x + 8 + k * 19, y: rect.y + rect.h - 22, width: 15, height: 15, class: 'ficon' },
        gLabels,
      );
    });
  });

  const victimRect = rects[opts.crimeRoom];
  const crimeOutline = svgEl(
    'rect',
    { x: victimRect.x + 5, y: victimRect.y + 5, width: victimRect.w - 10, height: victimRect.h - 10, class: 'crime' },
    gCrime,
  );
  crimeOutline.style.display = 'none';
  const victimGroup = svgEl(
    'g',
    { class: 'victim', transform: `translate(${victimRect.x + victimRect.w - 17},${victimRect.y + victimRect.h - 17})` },
    gCrime,
  );
  svgEl('circle', { r: 10 }, victimGroup);
  svgEl('path', { d: 'M0 -5.5V5.5M-3.8 -1.5H3.8' }, victimGroup);
  const victimTitle = svgEl('title', {}, victimGroup);
  victimTitle.textContent = `${opts.victimLabel} (víctima)`;

  const hits: SVGRectElement[] = opts.interactive
    ? map.rooms.map((room, i) => {
        const rect = rects[i];
        return svgEl(
          'rect',
          {
            x: rect.x - 2,
            y: rect.y - 2,
            width: rect.w + 4,
            height: rect.h + 4,
            class: 'hit',
            'data-r': i,
            tabindex: 0,
            role: 'button',
            'aria-label': room.name,
          },
          gHits,
        );
      })
    : [];

  let tokenNodes: SVGGElement[] | null = null;

  return {
    width,
    height,
    hits,
    setCrime(on) {
      crimeOutline.style.display = on ? '' : 'none';
    },
    marks(get, suspects) {
      gMarks.innerHTML = '';
      rects.forEach((rect, r) => {
        let slot = 0;
        for (let c = 0; c < suspects.length; c++) {
          const value = get(r, c);
          if (!value) continue;
          const [x, y] = roomSlot(rect, slot);
          slot += 1;
          const suspect = suspects[c];
          const group = svgEl('g', { class: `mk ${value === 1 ? 'yes' : 'no'}`, transform: `translate(${x},${y})` }, gMarks);
          svgEl('circle', { r: 10.5, fill: suspect.color, stroke: suspect.color }, group);
          const text = svgEl('text', {}, group);
          text.textContent = suspect.init;
          if (value === 2) svgEl('line', { x1: -9, y1: 9, x2: 9, y2: -9 }, group);
        }
      });
    },
    highlight(room) {
      gMarks.querySelectorAll('.hlroom').forEach((n) => n.remove());
      if (room == null) return;
      const rect = rects[room];
      svgEl('rect', { x: rect.x + 3, y: rect.y + 3, width: rect.w - 6, height: rect.h - 6, class: 'hlroom' }, gMarks);
    },
    tokens(roomsAt, suspects, show) {
      if (!show || !roomsAt) {
        gTokens.innerHTML = '';
        tokenNodes = null;
        return;
      }
      if (!tokenNodes) {
        tokenNodes = suspects.map((s) => {
          const group = svgEl('g', { class: 'tok' }, gTokens);
          svgEl('circle', { r: 11, fill: s.color }, group);
          const text = svgEl('text', {}, group);
          text.textContent = s.init;
          const title = svgEl('title', {}, group);
          title.textContent = s.name;
          return group;
        });
      }
      const nodes = tokenNodes;
      const seenInRoom = new Map<number, number>();
      roomsAt.forEach((room, c) => {
        const slot = seenInRoom.get(room) ?? 0;
        seenInRoom.set(room, slot + 1);
        const [x, y] = roomSlot(rects[room], slot);
        nodes[c].style.transform = `translate(${x}px,${y}px)`;
      });
    },
  };
}
