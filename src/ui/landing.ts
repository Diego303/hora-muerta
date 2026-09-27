// Portada (§17.2.1), fielmente portada de v1: héroe con plano animado, "Tres reglas,
// nada más" y selector de nivel. "Caso suelto" sirve el siguiente caso del banco del
// nivel elegido (§13); el caso del día real llega en el hito M7.
import { CHIP_COLORS } from '../engine/content/cast';
import { MAPS } from '../engine/content/maps';
import type { CaseDef, MapId } from '../engine/types';
import { loadBank, modeForDiff } from '../game/bank';
import { startDemo } from './demo';
import { toast } from './toast';

export interface LandingOptions {
  onStart: (caseData: CaseDef) => void;
}

export function renderLanding(root: HTMLElement, options: LandingOptions): () => void {
  root.innerHTML = `
    <div class="wrap">
      <header class="top">
        <div class="mark">
          <svg viewBox="0 0 26 26" aria-hidden="true">
            <rect x="2" y="2" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5"/>
            <path d="M13 2v9M2 15h8M16 15h8" stroke="currentColor" stroke-width="2.5"/>
            <circle cx="13" cy="19" r="2.4" fill="var(--pencil)"/>
          </svg>
          Hora Muerta
        </div>
        <nav>
          <a class="icon-btn" href="#como" style="text-decoration:none">Cómo se juega</a>
          <button class="icon-btn themeT" aria-label="Cambiar tema claro u oscuro">◐</button>
        </nav>
      </header>

      <section class="hero">
        <div>
          <h1>Una noche, un plano, un solo culpable.</h1>
          <p class="lead">Puzles de deducción sobre el plano de una casa, un tren o un museo. Sigues a cada sospechoso hora a hora y descubres quién estuvo a solas con la víctima. Cada caso pasa por un verificador lógico antes de servirse: nunca hace falta adivinar.</p>
          <div class="ctas">
            <button class="btn" id="goDaily">Jugar el caso del día</button>
            <a class="btn ghost" href="#niveles">Elegir nivel</a>
          </div>
          <p class="resume" id="resume" hidden></p>
        </div>
        <figure class="demo" aria-label="Animación de un caso resuelto: los sospechosos se mueven por el plano hora a hora">
          <div class="clock" id="demoClock">21:00</div>
          <svg class="map" id="demoMap" role="img" aria-label="Plano de ejemplo"></svg>
          <figcaption class="caption"><span id="demoCap">Así se mueven los sospechosos durante la noche.</span><span id="demoMark"></span></figcaption>
        </figure>
      </section>

      <section class="sec" id="como">
        <h2>Tres reglas, nada más</h2>
        <p class="intro">Todo lo demás son pistas. Cada pista es verdad y, juntas, solo admiten una respuesta.</p>
        <div class="rules">
          <div class="rule">
            <svg viewBox="0 0 220 110" aria-hidden="true"><rect x="6" y="14" width="96" height="84" fill="var(--room)" stroke="var(--wall)" stroke-width="2.5"/><rect x="118" y="14" width="96" height="84" fill="var(--room)" stroke="var(--wall)" stroke-width="2.5"/><rect x="98" y="44" width="24" height="24" fill="var(--room)"/><path d="M100 44v24M120 44v24" stroke="var(--wall)" stroke-width="2"/><circle cx="54" cy="56" r="13" fill="${CHIP_COLORS[0]}"/><path d="M72 56h70" stroke="var(--ink)" stroke-width="2" stroke-dasharray="4 4"/><path d="M136 49l9 7-9 7" fill="none" stroke="var(--ink)" stroke-width="2"/><circle cx="166" cy="56" r="13" fill="${CHIP_COLORS[0]}" opacity=".35"/></svg>
            <h3>Una puerta por hora</h3>
            <p>Entre una hora y la siguiente, cada persona se queda donde está o cruza una sola puerta.</p>
          </div>
          <div class="rule">
            <svg viewBox="0 0 220 110" aria-hidden="true"><rect x="40" y="10" width="140" height="92" fill="var(--room)" stroke="var(--wall)" stroke-width="2.5"/><rect x="46" y="16" width="128" height="80" fill="none" stroke="var(--pencil)" stroke-width="2.5" stroke-dasharray="7 5"/><circle cx="92" cy="56" r="13" fill="${CHIP_COLORS[3]}"/><use href="#ic-victim" x="122" y="42" width="28" height="28" style="color:var(--pencil)"/></svg>
            <h3>A solas con la víctima</h3>
            <p>El culpable fue la única persona que estuvo con la víctima a la hora de la muerte.</p>
          </div>
          <div class="rule">
            <svg viewBox="0 0 220 110" aria-hidden="true"><circle cx="50" cy="40" r="13" fill="${CHIP_COLORS[2]}"/><circle cx="110" cy="40" r="13" fill="${CHIP_COLORS[1]}"/><circle cx="170" cy="40" r="13" fill="${CHIP_COLORS[5]}"/><path d="M50 60v14M110 60v14M170 60v14" stroke="var(--ink-2)" stroke-width="2"/><rect x="34" y="78" width="32" height="20" fill="none" stroke="var(--ink)" stroke-width="2"/><rect x="94" y="78" width="32" height="20" fill="var(--pencil)" stroke="var(--pencil)" stroke-width="2"/><rect x="154" y="78" width="32" height="20" fill="none" stroke="var(--ink)" stroke-width="2"/></svg>
            <h3>Un objeto cada uno</h3>
            <p>Cada sospechoso llevaba un objeto distinto toda la noche. El arma es el objeto del culpable.</p>
          </div>
        </div>
        <p class="answer"><b>Tu respuesta:</b> quién lo hizo y con qué. Para llegar ahí tienes el plano con sus puertas, una pestaña por hora, marcas por sala, una tabla de objetos y tiza para dibujar encima.</p>
      </section>

      <section class="sec" id="niveles">
        <h2>Elige nivel</h2>
        <p class="intro">El nivel no cambia las reglas: cambia cuántas personas y horas hay que seguir, y lo directas que son las pistas. En Comisario no sobra ninguna pista.</p>
        <div class="mapsel" role="group" aria-label="Lugar del caso" id="mapSel"></div>
        <ul class="levels">
          <li><span class="lv">Novato</span><span class="spec"><b>4 sospechosos, 3 horas.</b> Pistas directas y alguna de sobra. Unos 3 a 5 minutos.</span><button class="btn" data-lv="0">Empezar</button></li>
          <li><span class="lv">Inspector</span><span class="spec"><b>5 sospechosos, 3 horas.</b> Pistas cruzadas entre personas, salas y objetos. Unos 6 a 10 minutos.</span><button class="btn" data-lv="1">Empezar</button></li>
          <li><span class="lv">Comisario</span><span class="spec"><b>5 sospechosos, 4 horas.</b> Pistas indirectas y el mínimo imprescindible. Unos 10 a 18 minutos.</span><button class="btn" data-lv="2">Empezar</button></li>
        </ul>
        <p class="stats" id="stats">Aún no has cerrado ningún caso.</p>
      </section>

      <footer>Casos generados y revisados con un solver lógico: cada uno pasa una comprobación de unicidad antes de servirse.</footer>
    </div>
  `;

  let selectedMap: MapId | null = null;
  const mapSel = root.querySelector<HTMLDivElement>('#mapSel');
  if (mapSel) {
    const mapOptions: { id: MapId | null; name: string }[] = [
      { id: null, name: 'Cualquier lugar' },
      ...MAPS.map((m) => ({ id: m.id, name: m.name })),
    ];
    for (const opt of mapOptions) {
      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.textContent = opt.name;
      chip.setAttribute('aria-pressed', String(opt.id === null));
      chip.addEventListener('click', () => {
        selectedMap = opt.id;
        mapSel.querySelectorAll<HTMLButtonElement>('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      });
      mapSel.appendChild(chip);
    }
  }

  root.querySelectorAll<HTMLButtonElement>('[data-lv]').forEach((button) => {
    button.addEventListener('click', () => {
      const diff = Number(button.dataset.lv);
      if (diff !== 0 && diff !== 1 && diff !== 2) return;
      void startCase(diff, button);
    });
  });
  root.querySelector('#goDaily')?.addEventListener('click', () => toast('El caso del día llega en el hito M7.'));

  async function startCase(diff: 0 | 1 | 2, button: HTMLButtonElement): Promise<void> {
    button.disabled = true;
    try {
      const bank = await loadBank(modeForDiff(diff));
      const pool = selectedMap ? bank.cases.filter((c) => c.map === selectedMap) : bank.cases;
      if (pool.length === 0) {
        toast('Todavía no hay casos de ese nivel disponibles.');
        return;
      }
      const caseData = pool[Math.floor(Math.random() * pool.length)];
      options.onStart(caseData);
    } catch {
      toast('No se ha podido cargar el caso. Comprueba tu conexión e inténtalo de nuevo.');
    } finally {
      button.disabled = false;
    }
  }

  const demoMap = root.querySelector<SVGSVGElement>('#demoMap');
  const demoClock = root.querySelector<HTMLElement>('#demoClock');
  const demoMark = root.querySelector<HTMLElement>('#demoMark');
  if (!demoMap || !demoClock || !demoMark) throw new Error('Falta el marcado de la animación de portada.');

  return startDemo(demoMap, demoClock, demoMark);
}
