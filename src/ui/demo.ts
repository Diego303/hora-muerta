// Animación de la portada: un caso de ejemplo fijo (el generador llega en M1).
// Los recorridos respetan las puertas de Casa Valdemar (una puerta por hora, §3).
import { CHIP_COLORS } from '../engine/content/cast';
import { MANSION } from '../engine/content/maps';
import { timeLabel } from '../engine/text';
import { prefersReducedMotion } from './a11y';
import { buildPlan, type SuspectView } from './plan';

function roomIndex(id: string): number {
  const i = MANSION.rooms.findIndex((r) => r.id === id);
  if (i < 0) throw new Error(`Sala desconocida en ${MANSION.id}: ${id}`);
  return i;
}

const DEMO_SUSPECTS: SuspectView[] = [
  { name: 'Adela', init: 'A', color: CHIP_COLORS[0] },
  { name: 'Bruno', init: 'B', color: CHIP_COLORS[1] },
  { name: 'Celia', init: 'C', color: CHIP_COLORS[2] },
  { name: 'Darío', init: 'D', color: CHIP_COLORS[3] },
];

// rooms[suspect][hora]; Adela (culpable) se queda a solas con la víctima en la Bodega a las 22:00.
const DEMO_ROOMS: number[][] = [
  [roomIndex('ves'), roomIndex('bod'), roomIndex('bod')],
  [roomIndex('inv'), roomIndex('com'), roomIndex('coc')],
  [roomIndex('bib'), roomIndex('est'), roomIndex('ves')],
  [roomIndex('bib'), roomIndex('est'), roomIndex('inv')],
];

const DEMO_VICTIM = 'Don Aurelio Valdemar';
const DEMO_CRIME_ROOM = roomIndex('bod');
const DEMO_CRIME_HOUR = 1;
const DEMO_HOURS = 3;

export function startDemo(svg: SVGSVGElement, clockEl: HTMLElement, captionEl: HTMLElement): () => void {
  const plan = buildPlan(svg, MANSION, { interactive: false, crimeRoom: DEMO_CRIME_ROOM, victimLabel: DEMO_VICTIM });
  let hour = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  const paint = () => {
    const roomsAt = DEMO_ROOMS.map((path) => path[hour]);
    plan.tokens(roomsAt, DEMO_SUSPECTS, true);
    plan.setCrime(hour === DEMO_CRIME_HOUR);
    clockEl.textContent = timeLabel(hour);
    captionEl.innerHTML = hour === DEMO_CRIME_HOUR ? '<b>Hora de la muerte</b>' : '';
  };

  paint();
  if (!prefersReducedMotion()) {
    timer = setInterval(() => {
      hour = (hour + 1) % DEMO_HOURS;
      paint();
    }, 1700);
  } else {
    hour = DEMO_CRIME_HOUR;
    paint();
  }

  return () => {
    if (timer) clearInterval(timer);
  };
}
