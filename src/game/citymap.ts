// Fondo del "plano de casos" (§ mejora, ver DECISIONES.md): el plano
// ilustrado de Valdeniebla, la ciudad ficticia del prototipo de referencia
// (docs/referencia/Hora Muerta_ plano de casos y tutorial.html), portado tal
// cual (misma geografía, mismos barrios, mismo trazado de calles y colores
// fijos, sin engancharlos a los tokens de tema: es un plano impreso, no
// cambia con el tema claro/oscuro, igual que en la referencia). El mosaico de
// los 6 escenarios reales que había antes se sustituye por esto porque, tras
// probarlo, quedaba "muy soso" comparado con el plano de la referencia.
//
// Los pines de caso (game/casepins.ts) ya no pueden colocarse "sobre la sala
// real" del caso -- Valdeniebla no tiene relación con Casa Valdemar, el tren
// o el museo -- así que se colocan al azar pero de forma coherente: sobre
// zonas de tierra de verdad (barrios, estación, puerto...), nunca sobre el
// mar, el río o el monte, y cada tipo de escenario tiene sus zonas propias
// (un tren aparece en una estación, un barco en el puerto, etc.), siguiendo
// el mismo criterio que ya usaba la propia referencia para su puñado de casos
// fijos ("Correo de las nueve" en la Estación de Poniente, "Gran Casino" en
// el Puerto...).
//
// Sin DOM: solo construye cadenas SVG y calcula puntos, igual que
// engine/text.ts. La semilla del plano es fija (20260927, la misma que usaba
// la referencia): Valdeniebla es siempre el mismo plano, no algo que se
// regenere en cada visita.
import { mulberry32 } from '../engine/rng';
import type { MapId } from '../engine/types';

export const CITY_VW = 1200;
export const CITY_VH = 848;

type Pt = [number, number];
type RoadKind = 'mw' | 'pr' | 'sec' | 'st';

const f1 = (n: number): number => Math.round(n * 10) / 10;

/** Catmull-Rom -> Bézier, igual que la referencia. */
function smooth(pts: Pt[], closed = false): string {
  const p: Pt[] = closed ? [pts[pts.length - 1], ...pts, pts[0], pts[1]] : [pts[0], ...pts, pts[pts.length - 1]];
  let d = `M${f1(p[1][0])},${f1(p[1][1])}`;
  for (let i = 1; i < p.length - 2; i++) {
    const [x0, y0] = p[i - 1];
    const [x1, y1] = p[i];
    const [x2, y2] = p[i + 1];
    const [x3, y3] = p[i + 2];
    d += ` C${f1(x1 + (x2 - x0) / 6)},${f1(y1 + (y2 - y0) / 6)} ${f1(x2 - (x3 - x1) / 6)},${f1(y2 - (y3 - y1) / 6)} ${f1(x2)},${f1(y2)}`;
  }
  return d + (closed ? 'Z' : '');
}
function sample(pts: Pt[], step: number): Pt[] {
  const p: Pt[] = [pts[0], ...pts, pts[pts.length - 1]];
  const out: Pt[] = [];
  for (let i = 1; i < p.length - 2; i++) {
    const [x0, y0] = p[i - 1];
    const [x1, y1] = p[i];
    const [x2, y2] = p[i + 1];
    const [x3, y3] = p[i + 2];
    for (let k = 0; k < step; k++) {
      const t = k / step;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([
        0.5 * (2 * x1 + (-x0 + x2) * t + (2 * x0 - 5 * x1 + 4 * x2 - x3) * t2 + (-x0 + 3 * x1 - 3 * x2 + x3) * t3),
        0.5 * (2 * y1 + (-y0 + y2) * t + (2 * y0 - 5 * y1 + 4 * y2 - y3) * t2 + (-y0 + 3 * y1 - 3 * y2 + y3) * t3),
      ]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
const poly = (pts: Pt[]): string => 'M' + pts.map((p) => `${f1(p[0])},${f1(p[1])}`).join('L') + 'Z';
const line = (pts: Pt[]): string => 'M' + pts.map((p) => `${f1(p[0])},${f1(p[1])}`).join('L');

// ---------- geografía (coordenadas exactas de la referencia) ----------
const RIVER: Pt[] = [
  [-30, 300],
  [110, 334],
  [220, 302],
  [330, 352],
  [430, 420],
  [560, 432],
  [680, 466],
  [790, 452],
  [880, 478],
  [990, 446],
  [1070, 440],
];
const riverS = sample(RIVER, 24);
function riverY(x: number): number {
  for (let i = 1; i < riverS.length; i++) {
    const a = riverS[i - 1];
    const b = riverS[i];
    if (x >= a[0] && x <= b[0]) return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0] || 1);
  }
  return riverS[riverS.length - 1][1];
}
function offsetLine(x0: number, x1: number, dy: number, step = 20): Pt[] {
  const o: Pt[] = [];
  for (let x = x0; x <= x1; x += step) o.push([x, riverY(x) + dy]);
  return o;
}

const SEA = 'M1200,-10 L1048,-10 C1036,40 1046,96 1086,122 C1132,140 1178,150 1172,184 C1166,220 1102,214 1070,240 C1036,268 1030,332 1040,384 C1046,410 1046,428 1046,446 C1050,470 1052,500 1052,540 C1052,590 1030,622 1004,662 C978,704 976,768 1000,860 L1210,860 Z';
const COAST_S: Pt[] = [
  [1052, 560],
  [1030, 622],
  [1004, 662],
  [982, 720],
  [990, 800],
  [1004, 860],
];

// ---------- zonas de barrio (mismos polígonos que dibuja el plano; se
// reutilizan tal cual para el trazado de calles y para colocar pines) ----------
const PONIENTE: Pt[] = [
  [20, 352],
  [140, 372],
  [250, 338],
  [300, 380],
  [330, 470],
  [250, 520],
  [120, 536],
  [20, 520],
];
const SAN_ROQUE: Pt[] = [
  [300, 60],
  [420, 40],
  [560, 52],
  [700, 70],
  [700, 160],
  [640, 178],
  [500, 176],
  [420, 200],
  [360, 190],
  [350, 120],
];
const LEVANTE: Pt[] = [
  [700, 70],
  [860, 58],
  [1030, 60],
  [1040, 150],
  [1026, 250],
  [1010, 330],
  [1006, 392],
  [900, 420],
  [800, 410],
  [700, 398],
  [690, 300],
  [700, 170],
];
const PUERTO: Pt[] = [
  [930, 486],
  [1044, 470],
  [1050, 560],
  [1030, 622],
  [1000, 662],
  [940, 650],
  [928, 560],
];
const ARENAL: Pt[] = [
  [900, 660],
  [995, 668],
  [978, 730],
  [982, 848],
  [880, 848],
  [892, 760],
];
const ENSANCHE: Pt[] = [
  [430, 510],
  [892, 510],
  [892, 792],
  [430, 792],
];
const DIST = [
  { d: PONIENTE, box: [20, 340, 330, 540] as const, ang: 0.35, px: 30, py: 26, jit: 4 },
  { d: SAN_ROQUE, box: [300, 40, 700, 200] as const, ang: -0.12, px: 34, py: 26, jit: 4 },
  { d: LEVANTE, box: [690, 55, 1040, 420] as const, ang: -0.18, px: 32, py: 26, jit: 3.5 },
  { d: PUERTO, box: [925, 465, 1050, 665] as const, ang: 0, px: 40, py: 34, jit: 4 },
  { d: ARENAL, box: [880, 655, 1000, 848] as const, ang: 0.1, px: 28, py: 26, jit: 4 },
];

// ---------- helpers de dibujo ----------
function jitterGrid(P: (s: string) => void, clip: (d: string) => string, R: () => number, d: string, box: readonly [number, number, number, number], ang: number, pitchX: number, pitchY: number, jit: number, cls: string): void {
  const id = clip(d);
  const [x0, y0, x1, y1] = box;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const span = Math.hypot(x1 - x0, y1 - y0) / 2 + 20;
  let s = '';
  const rot = (x: number, y: number): Pt => {
    const c = Math.cos(ang);
    const sn = Math.sin(ang);
    return [cx + (x - cx) * c - (y - cy) * sn, cy + (x - cx) * sn + (y - cy) * c];
  };
  for (let x = cx - span; x <= cx + span; x += pitchX) {
    const pts: Pt[] = [];
    for (let y = cy - span; y <= cy + span; y += 40) pts.push(rot(x + (R() - 0.5) * jit, y));
    s += `<path d="${line(pts)}"/>`;
  }
  for (let y = cy - span; y <= cy + span; y += pitchY) {
    let x = cx - span;
    const pts: Pt[] = [];
    while (x <= cx + span) {
      pts.push(rot(x, y + (R() - 0.5) * jit));
      x += 40;
    }
    s += `<path d="${line(pts)}"/>`;
  }
  P(`<g clip-path="url(#${id})" class="${cls}">${s}</g>`);
}

function build(): string {
  const R = mulberry32(20260927);
  const out: string[] = [];
  const P = (s: string): void => void out.push(s);
  const clipDefs: string[] = [];
  let clipN = 0;
  const clip = (d: string): string => {
    const id = 'vdc' + clipN++;
    clipDefs.push(`<clipPath id="${id}"><path d="${d}"/></clipPath>`);
    return id;
  };

  // papel
  P(`<rect x="-20" y="-20" width="${CITY_VW + 40}" height="${CITY_VH + 40}" fill="#eef0e9"/>`);

  // huertas del sur-oeste
  const fields: Pt[][] = [
    [
      [30, 560],
      [150, 548],
      [168, 600],
      [40, 612],
    ],
    [
      [170, 560],
      [236, 556],
      [230, 640],
      [176, 636],
    ],
    [
      [30, 712],
      [128, 706],
      [150, 790],
      [36, 800],
    ],
    [
      [160, 786],
      [250, 780],
      [300, 848],
      [170, 848],
    ],
    [
      [20, 808],
      [140, 810],
      [150, 848],
      [20, 848],
    ],
  ];
  fields.forEach((q, i) => P(`<path d="${poly(q)}" fill="${i % 2 ? '#e7ead8' : '#ebe8d6'}" stroke="#dcd9c3" stroke-width="1"/>`));
  P(
    `<path d="${poly([
      [30, 560],
      [150, 548],
      [168, 600],
      [40, 612],
    ])}" fill="url(#vdHatch)" opacity=".5"/>`,
  );

  // camino rural y caseríos
  P(
    `<path d="${smooth([
      [96, 720],
      [150, 742],
      [210, 730],
      [262, 760],
      [300, 800],
      [330, 848],
    ])}" fill="none" stroke="#d8d2bd" stroke-width="2.2" stroke-dasharray="5 3"/>`,
  );
  (
    [
      [196, 600],
      [212, 738],
      [60, 582],
      [268, 812],
      [40, 760],
    ] as Pt[]
  ).forEach(([x, y]) => P(`<rect x="${x - 5}" y="${y - 4}" width="10" height="8" fill="#d6cfbe" stroke="#b3a88f" stroke-width=".7"/>`));

  // monte sereno: bosque y curvas de nivel
  const hill: Pt[] = [
    [20, 30],
    [150, 14],
    [300, 40],
    [360, 110],
    [330, 210],
    [250, 250],
    [130, 248],
    [40, 200],
    [10, 110],
  ];
  P(`<path d="${smooth(hill, true)}" fill="#d6e4c6"/>`);
  for (let k = 1; k <= 5; k++) {
    const sc = 1 - k * 0.16;
    const cx = 172;
    const cy = 132;
    const ring: Pt[] = hill.map(([x, y], i) => [cx + (x - cx) * sc + Math.sin(i * 1.7 + k) * 6, cy + (y - cy) * sc + Math.cos(i * 2.1 + k) * 5]);
    P(`<path d="${smooth(ring, true)}" fill="none" stroke="#b7ab86" stroke-width="${k === 3 ? 1.1 : 0.7}" opacity=".7"/>`);
  }
  for (let i = 0; i < 90; i++) {
    const a = R() * Math.PI * 2;
    const r = Math.sqrt(R());
    const x = 172 + Math.cos(a) * r * 165;
    const y = 132 + Math.sin(a) * r * 105;
    P(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(2 + R() * 2.2)}" fill="#bcd3a8" opacity=".85"/>`);
  }

  // barrios residenciales (manchas urbanas con calles)
  DIST.forEach((z) => {
    P(`<path d="${poly(z.d)}" fill="#e2e1d9"/>`);
    jitterGrid(P, clip, R, poly(z.d), z.box, z.ang, z.px, z.py, z.jit, 'vd-st');
  });
  P(`<path d="${poly(LEVANTE)}" fill="url(#vdBlocks)" opacity=".35"/>`);

  // naves del puerto
  (
    [
      [946, 500, 34, 18],
      [986, 498, 40, 16],
      [948, 528, 26, 24],
      [984, 530, 30, 20],
      [944, 586, 40, 18],
      [990, 586, 26, 26],
      [954, 616, 30, 16],
    ] as [number, number, number, number][]
  ).forEach(([x, y, w, h]) => P(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#cfcdc3" stroke="#b9b6aa" stroke-width=".8"/>`));

  // parque de la alameda
  const park: Pt[] = [
    [256, 528],
    [396, 522],
    [414, 610],
    [400, 690],
    [276, 700],
    [246, 620],
  ];
  P(`<path d="${smooth(park, true)}" fill="#cde0bd" stroke="#b4cc9f" stroke-width="1.2"/>`);
  for (let i = 0; i < 70; i++) {
    const x = 262 + R() * 140;
    const y = 534 + R() * 160;
    if (Math.hypot(x - 360, y - 655) < 26) continue;
    P(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(1.8 + R() * 1.8)}" fill="#a9c792"/>`);
  }
  P(`<ellipse cx="362" cy="656" rx="30" ry="16" fill="#a9cfe0" stroke="#86b5cc" stroke-width="1"/>`);
  P(
    `<path d="${smooth([
      [256, 560],
      [300, 586],
      [330, 600],
      [372, 590],
      [410, 570],
    ])}" class="vd-pk"/><path d="${smooth([
      [330, 600],
      [318, 640],
      [300, 690],
    ])}" class="vd-pk"/><path d="${smooth([
      [330, 600],
      [350, 628],
      [396, 640],
    ])}" class="vd-pk"/>`,
  );
  // palacio de bellas artes
  P(`<rect x="318" y="592" width="26" height="18" fill="#cbc5b6" stroke="#a79f8c"/>`);

  // cementerio
  P(`<rect x="44" y="624" width="104" height="72" fill="#dde3d3" stroke="#a9ad9c" stroke-width="1.5"/>`);
  for (let x = 56; x < 142; x += 13) for (let y = 636; y < 690; y += 12) P(`<path d="M${x},${y - 3}v7M${x - 2.5},${y - 0.5}h5" stroke="#8f9585" stroke-width=".9"/>`);
  (
    [
      [50, 630],
      [140, 630],
      [50, 690],
      [140, 690],
      [95, 628],
    ] as Pt[]
  ).forEach(([x, y]) => P(`<ellipse cx="${x}" cy="${y}" rx="2.6" ry="4.4" fill="#7fa06c"/>`));

  // ensanche: calles (fondo claro) y manzanas achaflanadas con patio
  P(`<path d="${poly(ENSANCHE)}" fill="#f6f5ef"/>`);
  const BX = 432;
  const BY = 514;
  const PITCH = 46;
  const BS = 38;
  const CH = 7;
  for (let i = 0; i < 10; i++)
    for (let j = 0; j < 6; j++) {
      const x = BX + i * PITCH;
      const y = BY + j * PITCH;
      if (y < riverY(x) + 44 || y < riverY(x + BS) + 44) continue;
      const oct: Pt[] = [
        [x + CH, y],
        [x + BS - CH, y],
        [x + BS, y + CH],
        [x + BS, y + BS - CH],
        [x + BS - CH, y + BS],
        [x + CH, y + BS],
        [x, y + BS - CH],
        [x, y + CH],
      ];
      P(`<path d="${poly(oct)}" fill="#dcdad1" stroke="#c7c4b8" stroke-width=".8"/><rect x="${x + 11}" y="${y + 11}" width="${BS - 22}" height="${BS - 22}" fill="#e8e7df"/>`);
    }
  // plaza de la constitución
  P(`<circle cx="612" cy="648" r="24" fill="#f6f5ef" stroke="#c7c4b8"/><circle cx="612" cy="648" r="8" fill="#a9cfe0" stroke="#86b5cc"/>`);

  // casco viejo dentro de la muralla
  const C0: Pt = [560, 292];
  const wall: Pt[] = [];
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    wall.push([C0[0] + Math.cos(a) * (124 + Math.sin(k * 2.3) * 8), C0[1] + Math.sin(a) * (106 + Math.cos(k * 1.9) * 7)]);
  }
  const wallD = smooth(wall, true);
  P(`<path d="${wallD}" fill="#d9d5c8"/>`);
  const cid = clip(wallD);
  let cs = '';
  for (let k = 0; k < 11; k++) {
    const a = (k / 11) * Math.PI * 2 + (R() - 0.5) * 0.25;
    const pts: Pt[] = [[C0[0] + Math.cos(a) * 16, C0[1] + Math.sin(a) * 13]];
    for (let r = 40; r <= 160; r += 30) {
      const aa = a + (R() - 0.5) * 0.28;
      pts.push([C0[0] + Math.cos(aa) * r, C0[1] + Math.sin(aa) * r * 0.86]);
    }
    cs += `<path d="${smooth(pts)}" stroke-width="${k % 3 ? 2.4 : 3.6}"/>`;
  }
  [46, 82].forEach((rr) => {
    const pts: Pt[] = [];
    for (let k = 0; k <= 18; k++) {
      const a = (k / 18) * Math.PI * 2;
      pts.push([C0[0] + Math.cos(a) * (rr + (R() - 0.5) * 10), C0[1] + Math.sin(a) * (rr * 0.86 + (R() - 0.5) * 8)]);
    }
    cs += `<path d="${smooth(pts)}" stroke-width="2.6"/>`;
  });
  for (let k = 0; k < 26; k++) {
    const a = R() * Math.PI * 2;
    const r = 20 + R() * 95;
    const x = C0[0] + Math.cos(a) * r;
    const y = C0[1] + Math.sin(a) * r * 0.86;
    const b = a + Math.PI / 2 + (R() - 0.5);
    cs += `<path d="M${f1(x)},${f1(y)}l${f1(Math.cos(b) * (12 + R() * 14))},${f1(Math.sin(b) * (12 + R() * 14))}" stroke-width="1.6"/>`;
  }
  P(`<g clip-path="url(#${cid})" fill="none" stroke="#fbfaf5" stroke-linecap="round">${cs}</g>`);
  // plaza y catedral
  P(
    `<path d="${poly([
      [536, 276],
      [586, 272],
      [590, 312],
      [534, 314],
    ])}" fill="#fbfaf5"/>`,
  );
  P(`<path d="M548,288h24v10h-24zM556,280h8v26h-8z" fill="#b3aa96"/>`);
  // muralla
  P(`<path d="${wallD}" fill="none" stroke="#a3927a" stroke-width="3" stroke-dasharray="10 4"/>`);
  wall.filter((_, i) => i % 2 === 0).forEach(([x, y]) => P(`<circle cx="${f1(x)}" cy="${f1(y)}" r="3.4" fill="#a3927a"/>`));

  // villas del barrio alto (sobre el monte)
  const villaRoad: Pt[] = [
    [438, 256],
    [400, 236],
    [372, 200],
    [330, 168],
    [292, 186],
    [258, 160],
    [228, 188],
    [196, 170],
    [170, 196],
    [140, 176],
    [110, 200],
  ];
  sample(villaRoad, 3).forEach(([x, y], i) => {
    if (i % 2) return;
    const s = i % 4 ? 1 : -1;
    const w = 9 + R() * 5;
    const h = 7 + R() * 4;
    P(`<rect x="${f1(x - w / 2 + s * 4)}" y="${f1(y + s * 12 - h / 2)}" width="${f1(w)}" height="${f1(h)}" fill="#dcd5c5" stroke="#b9ae97" stroke-width=".8" transform="rotate(${f1((R() - 0.5) * 30)} ${f1(x)} ${f1(y)})"/>`);
  });
  // quintas aisladas
  (
    [
      [92, 392, 16, 11],
      [122, 772, 16, 12],
      [1102, 196, 16, 12],
      [210, 168, 14, 10],
      [326, 116, 16, 12],
    ] as [number, number, number, number][]
  ).forEach(([x, y, w, h]) => P(`<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" fill="#d8cfbd" stroke="#a89c83" stroke-width=".9"/><rect x="${x - w / 2 - 5}" y="${y - h / 2 - 5}" width="${w + 10}" height="${h + 10}" fill="none" stroke="#b9cfa6" stroke-width="3" opacity=".8"/>`));

  // arena de la playa
  P(`<path d="${smooth(COAST_S)}" fill="none" stroke="#ecdfb8" stroke-width="26"/>`);

  // agua: río, isla y mar
  const rW = smooth(RIVER.slice(0, 7));
  const rE = smooth(RIVER.slice(5));
  P(`<path d="${rW}" fill="none" stroke="#7fb0c8" stroke-width="30" stroke-linecap="round"/><path d="${rE}" fill="none" stroke="#7fb0c8" stroke-width="42" stroke-linecap="round"/>`);
  P(`<ellipse cx="596" cy="${f1(riverY(596))}" rx="58" ry="27" fill="#7fb0c8"/>`);
  P(`<path d="${rW}" fill="none" stroke="#a9cfe0" stroke-width="27" stroke-linecap="round"/><path d="${rE}" fill="none" stroke="#a9cfe0" stroke-width="39" stroke-linecap="round"/>`);
  P(`<ellipse cx="596" cy="${f1(riverY(596))}" rx="56" ry="25" fill="#a9cfe0"/>`);
  P(`<ellipse cx="596" cy="${f1(riverY(596) + 1)}" rx="38" ry="11" fill="#d3e3c2" stroke="#86b5cc" stroke-width="1"/>`);
  P(`<path d="${SEA}" fill="#a9cfe0" stroke="#7fb0c8" stroke-width="2"/>`);
  // batimetría suave
  [18, 40, 70].forEach((o, i) => P(`<path d="${SEA}" fill="none" stroke="#95c1d6" stroke-width="1" opacity="${0.7 - i * 0.18}" transform="translate(${o},0)" clip-path="url(#vdSeaClip)"/>`));
  // muelles y dique
  (
    [
      [1048, 482, 110, 16],
      [1048, 522, 86, 14],
      [1048, 558, 64, 12],
    ] as [number, number, number, number][]
  ).forEach(([x, y, w, h]) => P(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#dcdad2" stroke="#b3b0a4" stroke-width="1"/>`));
  P(
    `<path d="M1066,462 C1130,452 1184,486 1180,540 C1178,574 1158,600 1136,612" fill="none" stroke="#b3b0a4" stroke-width="7" stroke-linecap="round"/><path d="M1066,462 C1130,452 1184,486 1180,540 C1178,574 1158,600 1136,612" fill="none" stroke="#dcdad2" stroke-width="4.5" stroke-linecap="round"/>`,
  );

  // ---------- carreteras ----------
  const roads: { d: string; k: RoadKind; name: string; id: string }[] = [];
  const road = (d: string, k: RoadKind, name: string, id: string): void => void roads.push({ d, k, name, id });
  road(
    smooth([
      [-20, 546],
      [80, 540],
      [170, 520],
      [250, 506],
      [340, 494],
      [400, 480],
      [446, 466],
    ]),
    'mw',
    'Autovía del Sur',
    'rdAuto',
  );
  road(smooth(offsetLine(300, 960, 34, 40)), 'pr', 'Avenida del Río', 'rdRio');
  road(smooth(offsetLine(250, 1000, -32, 40)), 'sec', 'Paseo de la Ribera', 'rdRib');
  const ronda: Pt[] = wall.map(([x, y]) => [C0[0] + (x - C0[0]) * 1.12, C0[1] + (y - C0[1]) * 1.12]);
  road(smooth(ronda, true), 'pr', 'Ronda de la Muralla', 'rdRonda');
  road(
    smooth([
      [430, 190],
      [520, 170],
      [640, 168],
      [760, 140],
      [900, 110],
      [1036, 96],
    ]),
    'pr',
    'Ronda Norte',
    'rdNorte',
  );
  road(
    line([
      [750, 160],
      [750, 300],
      [750, 400],
      [750, 520],
      [750, 800],
    ]),
    'pr',
    'Gran Vía',
    'rdGV',
  );
  road(
    line([
      [444, 784],
      [890, 520],
    ]),
    'pr',
    'Avenida Diagonal',
    'rdDiag',
  );
  road(
    smooth([
      [1030, -10],
      [1036, 70],
      [1040, 150],
      [1026, 250],
      [1016, 350],
      [1016, 440],
      [1030, 500],
      [1040, 560],
      [1010, 640],
      [984, 700],
      [974, 770],
      [986, 860],
    ]),
    'sec',
    'Paseo Marítimo',
    'rdMar',
  );
  road(smooth(villaRoad), 'sec', 'Camino de las Colinas', 'rdCol');
  road(
    smooth([
      [250, 196],
      [244, 250],
      [236, 300],
      [228, 360],
      [196, 420],
      [152, 470],
      [120, 540],
      [100, 620],
      [96, 720],
      [90, 860],
    ]),
    'sec',
    'Carretera de Poniente',
    'rdPon',
  );
  road(
    line([
      [474, 380],
      [472, 470],
      [470, 520],
    ]),
    'sec',
    'Puente Viejo',
    'rdPV',
  );
  road(
    line([
      [600, 392],
      [598, 470],
      [596, 520],
    ]),
    'sec',
    'Puente de Hierro',
    'rdPH',
  );
  road(
    line([
      [1000, 350],
      [1004, 440],
      [1010, 520],
    ]),
    'sec',
    '',
    'rdLev',
  );
  road(
    smooth([
      [1040, 150],
      [1080, 168],
      [1120, 180],
      [1146, 178],
    ]),
    'st',
    '',
    'rdPunta',
  );

  const W: Record<RoadKind, [number, number]> = { mw: [10, 6.6], pr: [8, 5.4], sec: [6, 4.2], st: [3.6, 2.4] };
  const FILL: Record<RoadKind, string> = { mw: '#eea97c', pr: '#f6dc93', sec: '#ffffff', st: '#ffffff' };
  const CAS: Record<RoadKind, string> = { mw: '#b8764b', pr: '#c4a458', sec: '#bdb6a4', st: '#c9c3b3' };
  (['st', 'sec', 'pr', 'mw'] as RoadKind[]).forEach((k) => roads.filter((r) => r.k === k).forEach((r) => P(`<path d="${r.d}" fill="none" stroke="${CAS[k]}" stroke-width="${W[k][0]}" stroke-linecap="round" stroke-linejoin="round"/>`)));
  (['st', 'sec', 'pr', 'mw'] as RoadKind[]).forEach((k) => roads.filter((r) => r.k === k).forEach((r) => P(`<path ${r.id ? `id="${r.id}"` : ''} d="${r.d}" fill="none" stroke="${FILL[k]}" stroke-width="${W[k][1]}" stroke-linecap="round" stroke-linejoin="round"/>`)));

  // puentes (tablero con pretiles sobre el agua)
  const bridge = (x: number, k: RoadKind, halfLen: number): void => {
    const y = riverY(x);
    const [cw, fw] = W[k];
    P(`<g><path d="M${x},${f1(y - halfLen)}V${f1(y + halfLen)}" stroke="#5f5a50" stroke-width="${cw + 4}" stroke-linecap="butt"/><path d="M${x},${f1(y - halfLen)}V${f1(y + halfLen)}" stroke="${FILL[k]}" stroke-width="${fw + 1.5}" stroke-linecap="butt"/></g>`);
  };
  bridge(236, 'sec', 19);
  bridge(473, 'sec', 20);
  bridge(599, 'sec', 30);
  bridge(750, 'pr', 24);
  bridge(1004, 'sec', 24);

  // ---------- ferrocarril ----------
  const rail = smooth([
    [-20, 468],
    [70, 466],
    [150, 470],
    [196, 560],
    [250, 690],
    [310, 770],
    [440, 814],
    [560, 818],
    [650, 818],
    [780, 816],
    [860, 804],
    [902, 746],
    [914, 640],
    [920, 540],
    [926, 470],
    [944, 380],
    [976, 290],
    [1006, 200],
    [1004, 110],
    [994, -10],
  ]);
  P(`<path d="${rail}" fill="none" stroke="#3d434b" stroke-width="5"/><path d="${rail}" fill="none" stroke="#f4f4ef" stroke-width="2.6" stroke-dasharray="9 9"/>`);
  P(`<path d="M926,${f1(riverY(926) - 24)}V${f1(riverY(926) + 24)}" stroke="#3d434b" stroke-width="10"/><path d="M926,${f1(riverY(926) - 24)}V${f1(riverY(926) + 24)}" stroke="#f4f4ef" stroke-width="2.6" stroke-dasharray="9 9"/>`);
  // estaciones
  P(`<rect x="604" y="796" width="96" height="14" rx="2" fill="#3d434b"/><rect x="608" y="824" width="88" height="6" fill="#9aa0a6"/>`);
  P(`<rect x="132" y="452" width="36" height="10" rx="2" fill="#3d434b"/>`);
  P(`<rect x="994" y="190" width="10" height="22" rx="2" fill="#3d434b"/>`);

  // faro
  P(`<g transform="translate(1152,178)"><circle r="11" fill="#fff" stroke="#3d434b" stroke-width="1.4"/><path d="M-3,6 L-1.6,-6 H1.6 L3,6Z" fill="#3d434b"/><path d="M0,-7 l-14,-6 M0,-7 l14,-6" stroke="#d99a1c" stroke-width="1.4" stroke-linecap="round"/></g>`);
  // cima
  P(`<path d="M172,122 l6,10 h-12z" fill="#6f6650"/>`);
  // molino en la isla
  P(`<g transform="translate(596,${f1(riverY(596) + 1)})"><circle r="3" fill="#8d8471"/><path d="M0,0 l6,-6 M0,0 l-6,6 M0,0 l6,6 M0,0 l-6,-6" stroke="#8d8471" stroke-width="1.2"/></g>`);

  // ---------- rótulos ----------
  const FD = `font-family="Big Shoulders Display, Arial Narrow, Roboto Condensed, sans-serif"`;
  const FB = `font-family="Atkinson Hyperlegible, Segoe UI, system-ui, sans-serif"`;
  const halo = `paint-order="stroke" stroke="#f3f4ee" stroke-width="3.2" stroke-linejoin="round"`;
  const district = (x: number, y: number, t: string, s = 17, rot = 0): void =>
    P(`<text x="${x}" y="${y}" ${FD} font-weight="700" font-size="${s}" letter-spacing="3.5" fill="#6a6f73" text-anchor="middle" ${halo} ${rot ? `transform="rotate(${rot} ${x} ${y})"` : ''}>${t}</text>`);
  district(560, 214, 'CASCO VIEJO', 15);
  district(820, 580, 'ENSANCHE', 19);
  district(230, 278, 'BARRIO ALTO', 14);
  district(846, 318, 'LEVANTE', 19, -8);
  district(268, 452, 'PONIENTE', 14);
  district(990, 690, 'PUERTO', 14);
  district(470, 110, 'SAN ROQUE', 14, -4);
  district(1116, 108, 'LA PUNTA', 12);
  district(930, 790, 'EL ARENAL', 12);
  const small = (x: number, y: number, t: string, anchor = 'start', col = '#3f4750', it = false, s = 10.5): void =>
    P(`<text x="${x}" y="${y}" ${FB} font-size="${s}" ${it ? 'font-style="italic"' : ''} fill="${col}" text-anchor="${anchor}" ${halo}>${t}</text>`);
  small(560, 330, 'Catedral', 'middle');
  small(598, 792, 'Estación Central', 'end', '#2d3743', false, 11);
  small(150, 500, 'Estación de Poniente', 'middle');
  small(982, 240, 'Apeadero del Faro', 'end');
  small(1152, 158, 'Faro de la Punta', 'middle');
  small(330, 544, 'Parque de la Alameda', 'middle', '#4d6b3d', true);
  small(96, 716, 'Cementerio de San Lázaro', 'middle', '#55604c', true);
  small(172, 110, 'Monte Sereno 312', 'middle', '#5c5440', true);
  small(612, 684, 'Pl. de la Constitución', 'middle');
  small(596, 470, 'Isla del Molino', 'middle', '#3f6b52', true, 9.5);
  small(1090, 476, 'Muelle de Levante', 'start', '#3f4750', false, 9.5);
  small(975, 760, 'Playa de las Ánimas', 'end', '#7d6a3a', true, 10);
  small(470, 402, 'Puente Viejo', 'end', '#3f4750', false, 9.5);
  small(758, 424, 'Puente Nuevo', 'start', '#3f4750', false, 9.5);
  small(606, 404, 'Pte. de Hierro', 'start', '#3f4750', false, 9.5);
  // agua
  P(
    `<path id="vdRiverTxtW" d="${smooth(RIVER.slice(1, 5).map(([x, y]): Pt => [x, y + 4]))}" fill="none"/><path id="vdRiverTxtE" d="${smooth(RIVER.slice(6, 9).map(([x, y]): Pt => [x, y + 4]))}" fill="none"/>`,
  );
  P(`<text ${FB} font-style="italic" font-size="13" fill="#2f6c8c" letter-spacing="1.5"><textPath href="#vdRiverTxtW" startOffset="30%">Río Lóbrego</textPath></text>`);
  P(`<text ${FB} font-style="italic" font-size="13" fill="#2f6c8c" letter-spacing="1.5"><textPath href="#vdRiverTxtE" startOffset="20%">Río Lóbrego</textPath></text>`);
  P(`<text x="1128" y="330" ${FB} font-style="italic" font-size="22" fill="#2f6c8c" letter-spacing="6" text-anchor="middle" transform="rotate(90 1128 330)">Mar de Levante</text>`);
  // nombres de calles sobre su trazado
  const onRoad = (id: string, t: string, off: string, s = 9.5): void => P(`<text ${FB} font-size="${s}" fill="#4a4f55" dy="3.2"><textPath href="#${id}" startOffset="${off}">${t}</textPath></text>`);
  onRoad('rdRio', 'Avenida del Río', '64%');
  onRoad('rdNorte', 'Ronda Norte', '52%');
  onRoad('rdDiag', 'Avenida Diagonal', '22%');
  onRoad('rdMar', 'Paseo Marítimo', '70%', 9);
  onRoad('rdAuto', 'Autovía del Sur', '34%');
  onRoad('rdCol', 'Camino de las Colinas', '30%', 9);
  onRoad('rdRib', 'Paseo de la Ribera', '36%', 9);
  P(`<text x="756" y="742" ${FB} font-size="9.5" fill="#4a4f55" transform="rotate(-90 756 742)">Gran Vía</text>`);
  // escudo de la autovía
  P(`<g transform="translate(64,540)"><rect x="-13" y="-8" width="26" height="15" rx="3" fill="#b3452f"/><text y="3.6" ${FD} font-size="11" font-weight="700" fill="#fff" text-anchor="middle">A-7</text></g>`);

  // ---------- rosa de los vientos y escala ----------
  P(
    `<g transform="translate(1122,730)"><circle r="30" fill="none" stroke="#2f6c8c" stroke-width="1"/><circle r="22" fill="none" stroke="#2f6c8c" stroke-width=".6"/><path d="M0,-34 L6,0 L0,34 L-6,0Z" fill="#2f6c8c"/><path d="M-34,0 L0,-5 L34,0 L0,5Z" fill="#7fb0c8"/><path d="M0,-34 L6,0 L-6,0Z" fill="#b3261e"/><text y="-40" ${FD} font-weight="700" font-size="14" fill="#2f6c8c" text-anchor="middle">N</text></g>`,
  );
  P(
    `<g transform="translate(1068,806)"><rect width="30" height="5" fill="#2d3743"/><rect x="30" width="30" height="5" fill="#fff" stroke="#2d3743" stroke-width=".8"/><rect x="60" width="30" height="5" fill="#2d3743"/><text y="18" ${FB} font-size="9.5" fill="#2d3743">0</text><text x="90" y="18" ${FB} font-size="9.5" fill="#2d3743" text-anchor="middle">500 m</text></g>`,
  );

  // ---------- cuadrícula de referencia ----------
  let g = '';
  for (let i = 1; i < 6; i++) g += `<path d="M${i * 200},0V${CITY_VH}"/>`;
  for (let j = 1; j < 4; j++) g += `<path d="M0,${j * 212}H${CITY_VW}"/>`;
  P(`<g stroke="#2d3743" stroke-width=".6" opacity=".22">${g}</g>`);
  let lab = '';
  'ABCDEF'.split('').forEach((c, i) => {
    lab += `<text x="${i * 200 + 100}" y="15">${c}</text><text x="${i * 200 + 100}" y="${CITY_VH - 6}">${c}</text>`;
  });
  [1, 2, 3, 4].forEach((n, j) => {
    lab += `<text x="10" y="${j * 212 + 110}">${n}</text><text x="${CITY_VW - 10}" y="${j * 212 + 110}">${n}</text>`;
  });
  P(`<rect x="1" y="1" width="${CITY_VW - 2}" height="${CITY_VH - 2}" fill="none" stroke="#2d3743" stroke-width="2"/>`);
  P(`<g ${FD} font-weight="700" font-size="13" fill="#2d3743" text-anchor="middle" ${halo}>${lab}</g>`);

  const defs = `<pattern id="vdHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><path d="M0,0V6" stroke="#cfcab0" stroke-width="1"/></pattern>
      <pattern id="vdBlocks" width="30" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(-10)"><rect x="3" y="3" width="24" height="20" fill="#cfcdc3"/></pattern>
      <clipPath id="vdSeaClip"><path d="${SEA}"/></clipPath>
      ${clipDefs.join('')}`;
  return `<defs>${defs}</defs><g id="cmArt"><style>.vd-st path{fill:none;stroke:#fbfaf6;stroke-width:2.6;stroke-linecap:round}.vd-pk{fill:none;stroke:#f3efe0;stroke-width:2.4;stroke-linecap:round}</style>${out.join('')}</g>`;
}

let cached: string | null = null;

/** El plano entero de Valdeniebla, como `<defs>...</defs><g id="cmArt">...`
 * listo para inyectar en un `<svg>` oculto y referenciar con `<use
 * href="#cmArt"/>`. Semilla fija: siempre el mismo plano, no se regenera en
 * cada visita. Se calcula una sola vez (es una cadena grande) y se cachea. */
export function buildCityArt(): string {
  if (cached === null) cached = build();
  return cached;
}

/** "B2", igual que en la referencia: columna A-F cada 200 u., fila 1-4 cada
 * 212 u., recortado a la cuadrícula dibujada en el borde del plano. */
export function gridRef(x: number, y: number): string {
  const col = 'ABCDEF'[Math.max(0, Math.min(5, Math.floor(x / 200)))];
  const row = Math.max(0, Math.min(3, Math.floor(y / 212))) + 1;
  return `${col}${row}`;
}

// =====================================================================
// Colocación de pines (game/casepins.ts): al azar pero coherente, nunca
// sobre el mar/río/monte/cementerio. Cada zona es tierra de verdad, tomada
// de los mismos polígonos que dibuja el plano; cada tipo de escenario solo
// aparece en las zonas que tienen sentido para él (un tren, en una
// estación; un barco, en el puerto...), como ya hacía la propia referencia
// con su puñado de casos fijos.
// =====================================================================

type Zone =
  | { kind: 'poly'; name: string; points: Pt[] }
  | { kind: 'ellipse'; name: string; cx: number; cy: number; rx: number; ry: number }
  | { kind: 'box'; name: string; x0: number; y0: number; x1: number; y1: number };

type ZoneId = 'poniente' | 'sanroque' | 'levante' | 'puerto' | 'arenal' | 'ensanche' | 'cascoviejo' | 'barrioalto';

const ZONES: Record<ZoneId, Zone> = {
  poniente: { kind: 'poly', name: 'Poniente', points: PONIENTE },
  sanroque: { kind: 'poly', name: 'San Roque', points: SAN_ROQUE },
  levante: { kind: 'poly', name: 'Levante', points: LEVANTE },
  puerto: { kind: 'poly', name: 'el Puerto', points: PUERTO },
  arenal: { kind: 'poly', name: 'El Arenal', points: ARENAL },
  ensanche: { kind: 'box', name: 'el Ensanche', x0: 430, y0: 510, x1: 892, y1: 792 },
  // Radio algo más corto que la muralla dibujada (124/106, con hasta ±8/±7 de
  // ondulación) para quedar siempre dentro, no encima de la piedra.
  cascoviejo: { kind: 'ellipse', name: 'el Casco Viejo', cx: 560, cy: 292, rx: 100, ry: 85 },
  barrioalto: { kind: 'box', name: 'el Barrio Alto', x0: 65, y0: 95, x1: 300, y1: 270 },
};

const STATIONS: { pt: Pt; name: string }[] = [
  { pt: [150, 457], name: 'la Estación de Poniente' },
  { pt: [652, 803], name: 'la Estación Central' },
  { pt: [999, 201], name: 'el Apeadero del Faro' },
];

/** Qué zonas puede tocar cada tipo de escenario (§ mejora, ver
 * DECISIONES.md): reparto deliberado, no todo vale para todos: un tren
 * siempre en una estación (`ZONES_BY_MAP.tren` se ignora, ver
 * `randomPlacement`); un barco, en el puerto; museos/hoteles/teatros en los
 * barrios "cultos" o comerciales; las mansiones, dispersas por cualquier
 * barrio residencial. */
const ZONES_BY_MAP: Record<Exclude<MapId, 'tren'>, ZoneId[]> = {
  mansion: ['barrioalto', 'poniente', 'levante', 'arenal', 'ensanche'],
  museo: ['cascoviejo', 'ensanche'],
  barco: ['puerto'],
  hotel: ['ensanche', 'cascoviejo', 'sanroque'],
  teatro: ['cascoviejo', 'ensanche'],
};

function pointInPoly(pt: Pt, points: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    const crosses = yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function randomPointInZone(zone: Zone, random: () => number): Pt {
  if (zone.kind === 'ellipse') {
    const a = random() * Math.PI * 2;
    const r = Math.sqrt(random()) * 0.92;
    return [zone.cx + Math.cos(a) * zone.rx * r, zone.cy + Math.sin(a) * zone.ry * r];
  }
  if (zone.kind === 'box') {
    const pad = 16;
    return [zone.x0 + pad + random() * Math.max(0, zone.x1 - zone.x0 - pad * 2), zone.y0 + pad + random() * Math.max(0, zone.y1 - zone.y0 - pad * 2)];
  }
  const xs = zone.points.map((p) => p[0]);
  const ys = zone.points.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const x1 = Math.max(...xs);
  const y1 = Math.max(...ys);
  for (let i = 0; i < 12; i++) {
    const pt: Pt = [x0 + random() * (x1 - x0), y0 + random() * (y1 - y0)];
    if (pointInPoly(pt, zone.points)) return pt;
  }
  // No se encontró sitio en 12 intentos (polígono cóncavo, mala suerte): el
  // centro del cuadro delimitador es una aproximación razonable y, como el
  // propio polígono ya excluye el mar/río, nunca cae en el agua.
  return [(x0 + x1) / 2, (y0 + y1) / 2];
}

export interface CityPlacement {
  x: number;
  y: number;
  /** Barrio o lugar, para la ficha del caso ("el Puerto", "la Estación Central"...). */
  where: string;
  /** Referencia de cuadrícula ("B2"), igual que en el borde del plano. */
  grid: string;
}

/** Punto al azar, pero coherente, para un caso de este tipo de escenario:
 * nunca en el mar/río/monte, y solo en zonas que tienen sentido para ese
 * tipo (game/casepins.ts la llama una vez por cada pin nuevo). */
export function randomPlacement(mapId: MapId, random: () => number): CityPlacement {
  if (mapId === 'tren') {
    const station = STATIONS[Math.floor(random() * STATIONS.length)];
    const jitter = 10;
    const x = station.pt[0] + (random() - 0.5) * jitter * 2;
    const y = station.pt[1] + (random() - 0.5) * jitter * 2;
    return { x, y, where: station.name, grid: gridRef(x, y) };
  }
  const ids = ZONES_BY_MAP[mapId];
  const zoneId = ids[Math.floor(random() * ids.length)];
  const zone = ZONES[zoneId];
  const [x, y] = randomPointInZone(zone, random);
  return { x, y, where: zone.name, grid: gridRef(x, y) };
}
