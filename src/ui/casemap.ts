// Plano de casos plegable (§ nueva mejora, ver DECISIONES.md): un panfleto
// de 3 hojas con bisagra en 3D (igual que el prototipo de referencia) que se
// despliega para mostrar el plano de Valdeniebla, con "pines" de casos del
// banco que aparecen, cuentan atrás y desaparecen solos — con cientos de
// casos en el banco, no caben todos a la vez, así que se enseñan unos pocos
// por turnos. La gracia del plano es elegir tocando un pin; quien quiera ver
// el banco entero tiene el botón "Ver todos los casos" (ui/caselist.ts).
import { PIN_LIFETIME_MS, PinEngine } from '../game/casepins';
import { buildCityArt, CITY_VH, CITY_VW } from '../game/citymap';
import { VICTIMS } from '../engine/content/cast';
import { MAPS } from '../engine/content/maps';
import type { DiffIndex } from '../engine/clues';
import type { CaseDef, MapId } from '../engine/types';
import { loadBank } from '../game/bank';
import { getProfile } from '../game/storage';
import { isMapUnlocked } from '../game/progression';

export interface CaseMapOptions {
  onPlay: (caseData: CaseDef, bankVersion: string | null) => void;
  onShowFullList: () => void;
}

function requireEl<T extends Element>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`Falta "${selector}" en el marcado del plano de casos.`);
  return el;
}

const LEVEL_NAME: Record<DiffIndex, string> = { 0: 'Novato', 1: 'Inspector', 2: 'Comisario' };
const LEVEL_SPEC: Record<DiffIndex, string> = { 0: '4 sospechosos, 3 horas', 1: '5 sospechosos, 3 horas', 2: '5 sospechosos, 4 horas' };
const LEVEL_COLOR: Record<DiffIndex, string> = { 0: '#1f8a7a', 1: '#a8700a', 2: '#b3261e' };
const PLACE_NOUN: Record<MapId, string> = { mansion: 'una casa', tren: 'un tren', museo: 'un museo', hotel: 'un hotel', barco: 'un barco', teatro: 'un teatro' };

function shapePath(diff: DiffIndex, r: number): string {
  if (diff === 0) return `<circle r="${r}"/>`;
  if (diff === 1) {
    const k = r * 1.25;
    return `<path d="M0,${-k}L${k},0L0,${k}L${-k},0Z"/>`;
  }
  const pts: string[] = [];
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + (i * Math.PI) / 4;
    pts.push(`${(Math.cos(a) * r * 1.06).toFixed(2)},${(Math.sin(a) * r * 1.06).toFixed(2)}`);
  }
  return `<path d="M${pts.join('L')}Z"/>`;
}
const shapeIcon = (diff: DiffIndex): string => `<svg viewBox="-12 -12 24 24" aria-hidden="true"><g fill="${LEVEL_COLOR[diff]}" stroke="#fff" stroke-width="1.6">${shapePath(diff, 8.5)}</g></svg>`;

export function renderCaseMap(root: HTMLElement, options: CaseMapOptions): () => void {
  root.innerHTML = `
    <svg id="cmDefs" width="0" height="0" style="position:absolute;overflow:hidden" aria-hidden="true" focusable="false">${buildCityArt()}</svg>
    <div class="city">
      <div class="c-level">
        <h3 id="cmLvT">Nivel</h3>
        <div class="lvopts" role="radiogroup" aria-labelledby="cmLvT" id="cmLvOpts"></div>
      </div>
      <div class="c-stagewrap">
        <div class="pf-stage" id="cmStage">
          <div class="pf-sheet closed" id="cmSheet">
            <div class="pf-panel pf-b"><div class="pf-face"><svg class="pf-slice" viewBox="${CITY_VW / 3} 0 ${CITY_VW / 3} ${CITY_VH}" preserveAspectRatio="none" aria-hidden="true"><use href="#cmArt"/></svg></div></div>
            <div class="pf-panel pf-c">
              <div class="pf-face"><svg class="pf-slice" viewBox="${(CITY_VW / 3) * 2} 0 ${CITY_VW / 3} ${CITY_VH}" preserveAspectRatio="none" aria-hidden="true"><use href="#cmArt"/></svg></div>
              <div class="pf-face back"><div class="flap" id="cmFlap"></div></div>
            </div>
            <div class="pf-panel pf-a">
              <div class="pf-face"><svg class="pf-slice" viewBox="0 0 ${CITY_VW / 3} ${CITY_VH}" preserveAspectRatio="none" aria-hidden="true"><use href="#cmArt"/></svg></div>
              <div class="pf-face back"><div class="cover" id="cmCover" role="button" tabindex="0" aria-label="Desplegar el plano de casos"></div></div>
            </div>
            <div class="pf-creases"></div>
            <svg class="pf-pins" id="cmPins" viewBox="0 0 ${CITY_VW} ${CITY_VH}" aria-label="Casos abiertos en el plano"></svg>
          </div>
        </div>
        <div class="pf-actions">
          <button class="btn" id="cmToggle" aria-controls="cmSheet" aria-expanded="false">Desplegar el plano</button>
          <span class="note" id="cmNote" hidden>Desliza el plano para recorrer todo Valdeniebla.</span>
        </div>
      </div>
      <div class="c-side">
        <div class="c-card" id="cmCard" aria-live="polite"></div>
        <button class="btn ghost" id="cmFullList">Ver todos los casos</button>
      </div>
    </div>
  `;

  let level: 'all' | DiffIndex = 'all';
  let selectedKey: string | null = null;
  let state: 'closed' | 'opening' | 'open' | 'closing' = 'closed';
  let afterOpen: (() => void) | null = null;
  let engine: PinEngine | null = null;
  let reduceMotion = false;
  try {
    reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    reduceMotion = false;
  }

  const stage = requireEl<HTMLDivElement>(root, '#cmStage');
  const sheet = requireEl<HTMLDivElement>(root, '#cmSheet');
  const toggleBtn = requireEl<HTMLButtonElement>(root, '#cmToggle');
  const note = requireEl<HTMLSpanElement>(root, '#cmNote');
  const cover = requireEl<HTMLDivElement>(root, '#cmCover');
  const flap = requireEl<HTMLDivElement>(root, '#cmFlap');
  const pinsSvg = requireEl<SVGSVGElement>(root, '#cmPins');
  const cardEl = requireEl<HTMLDivElement>(root, '#cmCard');
  const lvOpts = requireEl<HTMLDivElement>(root, '#cmLvOpts');

  cover.innerHTML = `<div class="cv-top"><span class="cv-pub">Hora Muerta</span><strong class="cv-title">Valdeniebla</strong><span class="cv-sub">Plano de casos abiertos</span></div>
    <div class="cv-bottom"><p>Cada pin es un caso de verdad, listo para jugarse.</p><p class="cv-cta">Despliega el plano y elige uno.</p>
      <div class="cv-legend">${([0, 1, 2] as DiffIndex[]).map((d) => `<span>${shapeIcon(d)}${LEVEL_NAME[d]}</span>`).join('')}</div></div>`;
  flap.innerHTML = `<h4>Cómo leer este plano</h4><p>Cada pin marca un caso abierto ahora mismo. La forma y el color indican el nivel:</p>
    <ul>${([0, 1, 2] as DiffIndex[]).map((d) => `<li>${shapeIcon(d)}<span><b>${LEVEL_NAME[d]}</b>, ${LEVEL_SPEC[d]}</span></li>`).join('')}</ul>
    <p>Los casos no se quedan quietos: cada uno se enseña un rato y luego le toca a otro. La barrita sobre cada pin es lo que le queda.</p>`;

  const levelOptions: { id: 'all' | DiffIndex; name: string; spec: string }[] = [
    { id: 'all', name: 'Todos', spec: 'Los tres niveles' },
    { id: 0, name: LEVEL_NAME[0], spec: LEVEL_SPEC[0] },
    { id: 1, name: LEVEL_NAME[1], spec: LEVEL_SPEC[1] },
    { id: 2, name: LEVEL_NAME[2], spec: LEVEL_SPEC[2] },
  ];
  lvOpts.innerHTML = levelOptions
    .map(
      (o) =>
        `<button class="lvopt" type="button" role="radio" data-lvf="${o.id}" aria-checked="${String(level === o.id)}">${o.id === 'all' ? '<svg viewBox="-12 -12 24 24" aria-hidden="true"><g stroke="#fff" stroke-width="1.4"><g fill="' + LEVEL_COLOR[0] + '" transform="translate(-5,-4)">' + shapePath(0, 5) + '</g><g fill="' + LEVEL_COLOR[1] + '" transform="translate(5,-4)">' + shapePath(1, 4.6) + '</g><g fill="' + LEVEL_COLOR[2] + '" transform="translate(0,5)">' + shapePath(2, 5) + '</g></g></svg>' : shapeIcon(o.id as DiffIndex)}<b>${o.name}</b><small>${o.spec}</small></button>`,
    )
    .join('');

  function setLevel(next: 'all' | DiffIndex): void {
    level = next;
    lvOpts?.querySelectorAll<HTMLButtonElement>('.lvopt').forEach((b) => b.setAttribute('aria-checked', String((b.dataset.lvf === 'all' ? 'all' : Number(b.dataset.lvf)) === level)));
    renderAll();
  }
  lvOpts.querySelectorAll<HTMLButtonElement>('.lvopt').forEach((b) => {
    b.addEventListener('click', () => setLevel(b.dataset.lvf === 'all' ? 'all' : (Number(b.dataset.lvf) as DiffIndex)));
  });

  function layout(): void {
    const w = stage.clientWidth;
    const W = w >= 640 ? Math.min(w, 980) : 3 * Math.min(Math.round(w * 0.74), 300);
    const P = W / 3;
    const H = Math.round((W * CITY_VH) / CITY_VW);
    sheet.style.setProperty('--W', `${W}px`);
    sheet.style.setProperty('--P', `${P}px`);
    sheet.style.setProperty('--H', `${H}px`);
    const overflow = W > w + 1;
    stage.classList.toggle('scroll', overflow && state === 'open');
    note.hidden = !(overflow && state === 'open');
    if (state !== 'open') stage.scrollLeft = Math.max(0, (W - w) / 2);
  }

  function unfold(then?: () => void): void {
    if (state === 'open' || state === 'opening') {
      then?.();
      return;
    }
    afterOpen = then ?? null;
    layout();
    if (reduceMotion) {
      sheet.className = 'pf-sheet open';
      state = 'opening';
      finishOpen();
      return;
    }
    state = 'opening';
    sheet.className = 'pf-sheet opening';
    toggleBtn.disabled = true;
  }
  function finishOpen(): void {
    state = 'open';
    sheet.className = 'pf-sheet open';
    toggleBtn.disabled = false;
    toggleBtn.textContent = 'Plegar el plano';
    toggleBtn.setAttribute('aria-expanded', 'true');
    renderPins(true);
    layout();
    const cb = afterOpen;
    afterOpen = null;
    cb?.();
  }
  function fold(): void {
    if (state !== 'open') return;
    stage.classList.remove('scroll');
    note.hidden = true;
    layout();
    if (reduceMotion) {
      state = 'closing';
      finishClose();
      return;
    }
    state = 'closing';
    sheet.className = 'pf-sheet closing';
    toggleBtn.disabled = true;
  }
  function finishClose(): void {
    state = 'closed';
    sheet.className = 'pf-sheet closed';
    toggleBtn.disabled = false;
    toggleBtn.textContent = 'Desplegar el plano';
    toggleBtn.setAttribute('aria-expanded', 'false');
    layout();
    renderCard();
  }
  toggleBtn.addEventListener('click', () => (state === 'open' ? fold() : unfold()));
  cover.addEventListener('click', () => unfold());
  cover.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      unfold();
    }
  });
  sheet.addEventListener('animationend', (e) => {
    const target = e.target as HTMLElement;
    if (state === 'opening' && target.classList.contains('pf-c') && e.animationName === 'pfC') finishOpen();
    if (state === 'closing' && target.classList.contains('pf-a') && e.animationName === 'pfA') finishClose();
  });
  const onResize = (): void => layout();
  window.addEventListener('resize', onResize);

  function selectPin(key: string): void {
    const pin = engine?.getLive().find((p) => p.key === key);
    if (!pin) return;
    if (level !== 'all' && pin.caseData.diff !== level) setLevel(pin.caseData.diff as DiffIndex);
    selectedKey = key;
    engine?.select(key);
    const go = (): void => {
      renderPins(false);
      renderCard();
      if (stage.classList.contains('scroll')) {
        const W = stage.scrollWidth;
        stage.scrollTo({ left: Math.max(0, (pin.x / CITY_VW) * W - stage.clientWidth / 2), behavior: reduceMotion ? 'auto' : 'smooth' });
      }
    };
    if (state !== 'open') unfold(go);
    else go();
  }

  function renderPins(drop: boolean): void {
    const live = engine?.getLive() ?? [];
    let html = '';
    let i = 0;
    for (const pin of live) {
      if (level !== 'all' && pin.caseData.diff !== level) continue;
      const isSel = pin.key === selectedKey;
      const elapsed = Date.now() - pin.bornAt;
      const remainMs = Math.max(0, PIN_LIFETIME_MS - elapsed);
      const diff = pin.caseData.diff as DiffIndex;
      html += `<g class="pin${isSel ? ' sel' : ''}" data-key="${pin.key}" style="--i:${i}" transform="translate(${pin.x.toFixed(1)},${pin.y.toFixed(1)})" tabindex="0" role="button" aria-label="${LEVEL_NAME[diff]}, ${MAPS.find((m) => m.id === pin.caseData.map)?.name ?? ''}, quedan ${Math.ceil(remainMs / 1000)} segundos">
        <g class="pin-in">
          <circle r="30" fill="transparent"/>
          <circle class="pin-ring" r="20"/>
          <rect class="pin-bar-track" x="-14" y="-30" width="28" height="4" rx="2"/>
          <rect class="pin-bar" x="-14" y="-30" width="28" height="4" rx="2" style="animation-duration:${PIN_LIFETIME_MS}ms;animation-delay:${-elapsed}ms"/>
          <g fill="${LEVEL_COLOR[diff]}" stroke="#fff" stroke-width="2.6">${shapePath(diff, 15)}</g>
        </g>
      </g>`;
      i++;
    }
    pinsSvg.innerHTML = html;
    if (!drop) pinsSvg.querySelectorAll<SVGGElement>('.pin-in').forEach((n) => (n.style.animation = 'none'));
    pinsSvg.querySelectorAll<SVGGElement>('.pin').forEach((p) => {
      const key = p.dataset.key;
      if (!key) return;
      p.addEventListener('click', () => selectPin(key));
      p.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectPin(key);
        }
      });
    });
  }

  function renderCard(): void {
    const pin = selectedKey ? engine?.getLive().find((p) => p.key === selectedKey) : null;
    if (!pin) {
      cardEl.innerHTML = `<p class="cc-empty">${state === 'open' ? 'Toca un pin del plano para ver el caso.' : 'Despliega el plano y toca un pin para ver el caso.'}</p>`;
      return;
    }
    const c = pin.caseData;
    const diff = c.diff as DiffIndex;
    const map = MAPS.find((m) => m.id === c.map);
    const victim = VICTIMS[c.victim];
    cardEl.innerHTML = `<div class="cc-head">${shapeIcon(diff)}<span>${LEVEL_NAME[diff]}</span></div>
      <h3>${map?.name ?? ''}</h3>
      <p class="cc-where">${pin.where}, cuadrícula ${pin.grid}</p>
      <p class="cc-teaser">${victim} apareció sin vida. ${map ? map.intro : ''}</p>
      <p class="cc-spec"><b>${LEVEL_SPEC[diff]}.</b> ${map ? `Escenario: ${PLACE_NOUN[map.id]}.` : ''}</p>
      <button class="btn" id="cmTry" type="button">Intentar resolverlo</button>`;
    cardEl.querySelector<HTMLButtonElement>('#cmTry')?.addEventListener('click', () => {
      options.onPlay(c, bankVersions[c.diff as DiffIndex] ?? null);
    });
  }

  function renderAll(): void {
    renderPins(false);
    renderCard();
  }

  root.querySelector('#cmFullList')?.addEventListener('click', () => options.onShowFullList());

  // Carga del banco en segundo plano (§19.4: no bloquea la primera pintura de
  // la portada) y arranque del motor de pines en cuanto haya algo que enseñar.
  const bankVersions: Partial<Record<DiffIndex, string>> = {};
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  // La carga es asíncrona: si la portada se desmonta antes de que termine, no debe
  // arrancar el intervalo de los pines después de haberse ido.
  let disposed = false;
  void (async () => {
    const stars = getProfile().stars;
    const unlocked = new Set(MAPS.filter((m) => isMapUnlocked(m.unlock, stars)).map((m) => m.id));
    const pool: CaseDef[] = [];
    const modes: { mode: 'novato' | 'inspector' | 'comisario'; diff: DiffIndex }[] = [
      { mode: 'novato', diff: 0 },
      { mode: 'inspector', diff: 1 },
      { mode: 'comisario', diff: 2 },
    ];
    for (const { mode, diff } of modes) {
      try {
        const bank = await loadBank(mode);
        if (disposed) return;
        bankVersions[diff] = bank.version;
        for (const c of bank.cases) if (unlocked.has(c.map)) pool.push(c);
      } catch {
        // sin conexión o banco no disponible: el plano se queda con lo que haya podido cargar
      }
    }
    if (disposed || pool.length === 0) return;
    engine = new PinEngine(pool);
    tickTimer = setInterval(() => {
      if (engine?.tick()) renderAll();
    }, 400);
    renderAll();
  })();

  layout();
  renderAll();

  return () => {
    disposed = true;
    window.removeEventListener('resize', onResize);
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = null;
  };
}
