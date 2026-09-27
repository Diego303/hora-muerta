// Reconstrucción (§14.4): el plano muestra las fichas reales moviéndose hora a
// hora, con la sala del crimen resaltada a la hora td. `prefers-reduced-motion`
// deja las fichas fijas en la hora del crimen, sin animación.
import { timeLabel } from '../engine/text';
import type { CaseDef, MapDef } from '../engine/types';
import { prefersReducedMotion } from './a11y';
import { buildPlan } from './plan';
import type { SuspectView } from './plan';

const HOUR_INTERVAL_MS = 1400;

function requireEl<T extends Element>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`Falta "${selector}" en el marcado de la reconstrucción.`);
  return el;
}

export function openReconstruction(map: MapDef, caseData: CaseDef, suspects: SuspectView[]): () => void {
  const overlay = document.createElement('div');
  overlay.className = 'plan-overlay recon-overlay';
  overlay.innerHTML = `
    <button class="icon-btn plan-close" aria-label="Cerrar">✕</button>
    <div class="recon-clock" id="reconClock"></div>
    <div class="plan-wrap"><div class="plan"><svg class="map" id="reconMap"></svg></div></div>
  `;
  document.body.appendChild(overlay);

  const svg = requireEl<SVGSVGElement>(overlay, '#reconMap');
  const clockEl = requireEl<HTMLDivElement>(overlay, '#reconClock');
  const plan = buildPlan(svg, map, { interactive: false, crimeRoom: caseData.rv, victimLabel: '' });

  let hour = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  const reduced = prefersReducedMotion();

  function paint(): void {
    const roomsAt = caseData.truth.rooms.map((path) => path[hour]);
    plan.tokens(roomsAt, suspects, true);
    plan.setCrime(hour === caseData.td);
    clockEl.textContent = timeLabel(hour);
  }

  if (reduced) hour = caseData.td;
  paint();
  if (!reduced) {
    timer = setInterval(() => {
      hour = (hour + 1) % caseData.T;
      paint();
    }, HOUR_INTERVAL_MS);
  }

  function close(): void {
    if (timer) clearInterval(timer);
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') close();
  }
  overlay.querySelector('.plan-close')?.addEventListener('click', close);
  document.addEventListener('keydown', onKey);

  return close;
}
