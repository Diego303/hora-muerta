// Portada (§17.2.1), fielmente portada de v1: héroe con plano animado, "Tres reglas,
// nada más" y selector de nivel. "Caso suelto" sirve el siguiente caso no jugado del
// banco del nivel elegido, en un orden personal (§12.5); servir el caso en sí (y
// detectar el agotamiento del grupo) es cosa de quien llama, no de esta pantalla.
import { CHIP_COLORS } from '../engine/content/cast';
import { MAPS } from '../engine/content/maps';
import type { CaseDef, CaseMode, MapId } from '../engine/types';
import { getDailyResultDates, todayKey } from '../game/modes';
import { RANKS, computeDailyStreak, isMapUnlocked, rankProgress } from '../game/progression';
import { loadSavedGame } from '../game/session';
import { getProfile, hasTutorialDone } from '../game/storage';
import { renderCaseMap } from './casemap';
import { startDemo } from './demo';

const MODE_LABEL: Record<CaseMode, string> = {
  novato: 'Novato',
  inspector: 'Inspector',
  comisario: 'Comisario',
  diario: 'Diario',
  expediente: 'Expediente',
};

export interface LandingOptions {
  onStart: (diff: 0 | 1 | 2, mapFilter: MapId | null) => void;
  onDaily: () => void;
  onResume: () => void;
  onExpediente: () => void;
  onSettings: () => void;
  onProfile: () => void;
  onHelp: () => void;
  onTutorial: () => void;
  onPlayCase: (caseData: CaseDef, bankVersion: string | null) => void;
  onShowCaseList: () => void;
}

export function renderLanding(root: HTMLElement, options: LandingOptions): () => void {
  const profile = getProfile();
  const { rank, next, starsToNext } = rankProgress(profile.stars);
  const rankPct = next ? Math.round(((profile.stars - rank.stars) / (next.stars - rank.stars)) * 100) : 100;

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
          <button class="icon-btn" id="goTutorial">Tutorial</button>
          <button class="icon-btn" id="goHelp">Cómo se juega</button>
          <button class="icon-btn" id="goProfile" aria-label="Perfil">☰</button>
          <button class="icon-btn" id="goSettings" aria-label="Ajustes">⚙</button>
          <button class="icon-btn themeT" aria-label="Cambiar tema claro u oscuro">◐</button>
        </nav>
      </header>

      <aside class="tutband" id="tutBand" aria-labelledby="tbT">
        <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="3" y="3" width="42" height="42" style="fill:var(--room);stroke:var(--wall)" stroke-width="2.5"/><path d="M24 3v15M3 26h13M32 26h13" style="stroke:var(--wall)" stroke-width="2.5"/><path d="M11 38C17 31 24 34 25 24S33 13 37 11" fill="none" style="stroke:var(--amber)" stroke-width="2.8" stroke-dasharray="4 3.5" stroke-linecap="round"/><circle cx="37" cy="11" r="3.8" style="fill:var(--pencil)"/></svg>
        <div><b id="tbT">${hasTutorialDone() ? 'Tutorial completado' : 'Primera vez: resuelve un caso guiado'}</b><span id="tbS">${hasTutorialDone() ? 'Repasa cuando quieras cómo leer el plano, anotar, dibujar y razonar hasta acusar.' : 'Un caso pequeño pero completo. Aprenderás a leer el plano, anotar y dibujar en la pizarra, y razonar paso a paso hasta acusar. Unos 7 minutos.'}</span></div>
        <button class="btn${hasTutorialDone() ? ' ghost' : ''}" id="tutGo">${hasTutorialDone() ? 'Repetir el tutorial' : 'Empezar el tutorial'}</button>
      </aside>

      <section class="hero">
        <div>
          <h1>Una noche, un plano, un solo culpable.</h1>
          <p class="lead">Puzles de deducción sobre el plano de una casa, un tren o un museo. Sigues a cada sospechoso hora a hora y descubres quién estuvo a solas con la víctima. Cada caso pasa por un verificador lógico antes de servirse: nunca hace falta adivinar.</p>
          <div class="ctas">
            <button class="btn" id="goDaily">Jugar el caso del día</button>
            <a class="btn ghost" href="#niveles">Elegir nivel</a>
            <button class="btn ghost" id="goExpediente">Expediente</button>
          </div>
          <p class="resume" id="resume" hidden><button class="link" id="resumeBtn"></button></p>
          <button class="rank-chip" id="goProfile2" aria-label="Ver el perfil completo">
            <b>${rank.name}</b><span>${profile.stars} ★${next ? ` · ${starsToNext} para ${next.name}` : ''}</span>
            <span class="rank-bar"><i style="width:${rankPct}%"></i></span>
          </button>
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

      <section class="sec" id="plano-casos">
        <h2>Elige un caso</h2>
        <p class="intro">Cada pin del plano de Valdeniebla es un caso real, listo para jugarse. Van cambiando: si no ves uno que te guste, espera un momento o mira la lista completa.</p>
        <div id="caseMapHost"></div>
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
        <p class="stats" id="stats"></p>
      </section>

      <footer>Casos generados y revisados con un solver lógico: cada uno pasa una comprobación de unicidad antes de servirse.</footer>
    </div>
  `;

  let selectedMap: MapId | null = null;
  const mapSel = root.querySelector<HTMLDivElement>('#mapSel');
  if (mapSel) {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.textContent = 'Cualquier lugar';
    chip.setAttribute('aria-pressed', 'true');
    chip.addEventListener('click', () => {
      selectedMap = null;
      mapSel.querySelectorAll<HTMLButtonElement>('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
    });
    mapSel.appendChild(chip);

    // Escenarios bloqueados (§16.1): se ven, atenuados, con el rango que
    // hace falta; no se pueden elegir. "Cualquier lugar" ya los excluye solo
    // (nextUnplayed() filtra por escenario desbloqueado), así que no hace
    // falta un mensaje aparte para eso.
    for (const m of MAPS) {
      const unlocked = isMapUnlocked(m.unlock, profile.stars);
      const mapChip = document.createElement('button');
      mapChip.className = unlocked ? 'chip' : 'chip locked';
      if (unlocked) {
        mapChip.textContent = m.name;
        mapChip.setAttribute('aria-pressed', 'false');
        mapChip.addEventListener('click', () => {
          selectedMap = m.id;
          mapSel.querySelectorAll<HTMLButtonElement>('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === mapChip)));
        });
      } else {
        const rankName = RANKS.find((r) => r.id === m.unlock)?.name ?? m.unlock;
        mapChip.textContent = `🔒 ${m.name} · rango ${rankName}`;
        mapChip.disabled = true;
      }
      mapSel.appendChild(mapChip);
    }
  }

  root.querySelectorAll<HTMLButtonElement>('[data-lv]').forEach((button) => {
    button.addEventListener('click', () => {
      const diff = Number(button.dataset.lv);
      if (diff !== 0 && diff !== 1 && diff !== 2) return;
      options.onStart(diff, selectedMap);
    });
  });
  root.querySelector('#goDaily')?.addEventListener('click', () => options.onDaily());
  root.querySelector('#goExpediente')?.addEventListener('click', () => options.onExpediente());
  root.querySelector('#goSettings')?.addEventListener('click', () => options.onSettings());
  root.querySelector('#goHelp')?.addEventListener('click', () => options.onHelp());
  root.querySelector('#goProfile')?.addEventListener('click', () => options.onProfile());
  root.querySelector('#goProfile2')?.addEventListener('click', () => options.onProfile());
  root.querySelector('#goTutorial')?.addEventListener('click', () => options.onTutorial());
  root.querySelector('#tutGo')?.addEventListener('click', () => options.onTutorial());

  const statsEl = root.querySelector<HTMLParagraphElement>('#stats');
  if (statsEl) {
    const totalSolved = profile.solved.n + profile.solved.i + profile.solved.c;
    if (totalSolved === 0) {
      statsEl.textContent = 'Aún no has cerrado ningún caso.';
    } else {
      const streak = computeDailyStreak(getDailyResultDates(), todayKey());
      const streakPhrase = streak.current > 0 ? ` Racha diaria: ${streak.current}.` : '';
      statsEl.textContent = `${totalSolved} caso${totalSolved === 1 ? '' : 's'} resuelto${totalSolved === 1 ? '' : 's'}.${streakPhrase}`;
    }
  }

  const resumeEl = root.querySelector<HTMLParagraphElement>('#resume');
  const resumeBtn = root.querySelector<HTMLButtonElement>('#resumeBtn');
  const saved = loadSavedGame();
  if (resumeEl && resumeBtn && saved) {
    resumeEl.hidden = false;
    resumeBtn.textContent = `Seguir tu caso de ${MODE_LABEL[saved.mode]} sin terminar →`;
    resumeBtn.addEventListener('click', () => options.onResume());
  }

  const demoMap = root.querySelector<SVGSVGElement>('#demoMap');
  const demoClock = root.querySelector<HTMLElement>('#demoClock');
  const demoMark = root.querySelector<HTMLElement>('#demoMark');
  if (!demoMap || !demoClock || !demoMark) throw new Error('Falta el marcado de la animación de portada.');
  const stopDemo = startDemo(demoMap, demoClock, demoMark);

  const caseMapHost = root.querySelector<HTMLDivElement>('#caseMapHost');
  const stopCaseMap = caseMapHost
    ? renderCaseMap(caseMapHost, { onPlay: options.onPlayCase, onShowFullList: options.onShowCaseList })
    : () => undefined;

  return () => {
    stopDemo();
    stopCaseMap();
  };
}
