// Lista completa de casos (§ nueva mejora, ver DECISIONES.md): para quien
// prefiere elegir con calma en vez de esperar a que aparezca un pin en el
// plano. Filtra por nivel y por escenario; con cientos de casos, se pinta en
// tandas ("cargar más") en vez de todos de golpe.
import { VICTIMS } from '../engine/content/cast';
import { MAPS } from '../engine/content/maps';
import type { DiffIndex } from '../engine/clues';
import type { CaseDef, MapId } from '../engine/types';
import { loadBank } from '../game/bank';
import { isMapUnlocked } from '../game/progression';
import { getProfile } from '../game/storage';

export interface CaseListOptions {
  onBack: () => void;
  onPlay: (caseData: CaseDef, bankVersion: string) => void;
}

const LEVEL_NAME: Record<DiffIndex, string> = { 0: 'Novato', 1: 'Inspector', 2: 'Comisario' };
const PAGE_SIZE = 30;

function requireEl<T extends Element>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`Falta "${selector}" en el marcado de la lista de casos.`);
  return el;
}

export function renderCaseList(root: HTMLElement, options: CaseListOptions): () => void {
  root.innerHTML = `
    <div class="gbar">
      <button class="icon-btn" id="clBack" aria-label="Volver a la portada">←</button>
      <div class="ttl"><b>Todos los casos</b></div>
    </div>
    <div class="wrap caselist-view">
      <section class="sec">
        <p class="lbl">Nivel</p>
        <div class="pick" id="clLevel" role="group" aria-label="Nivel">
          <button class="chip" data-lv="all" aria-pressed="true">Todos</button>
          <button class="chip" data-lv="0" aria-pressed="false">Novato</button>
          <button class="chip" data-lv="1" aria-pressed="false">Inspector</button>
          <button class="chip" data-lv="2" aria-pressed="false">Comisario</button>
        </div>
        <p class="lbl">Escenario</p>
        <div class="pick" id="clMap" role="group" aria-label="Escenario">
          <button class="chip" data-map="all" aria-pressed="true">Cualquiera</button>
          ${MAPS.map((m) => `<button class="chip" data-map="${m.id}" aria-pressed="false">${m.name}</button>`).join('')}
        </div>
        <p class="intro" id="clCount"></p>
        <ul class="case-rows" id="clRows"></ul>
        <button class="btn ghost" id="clMore" hidden>Cargar más</button>
      </section>
    </div>
  `;

  const rowsEl = requireEl<HTMLUListElement>(root, '#clRows');
  const moreBtn = requireEl<HTMLButtonElement>(root, '#clMore');
  const countEl = requireEl<HTMLParagraphElement>(root, '#clCount');

  let level: 'all' | DiffIndex = 'all';
  let mapFilter: MapId | 'all' = 'all';
  let shown = PAGE_SIZE;
  let allCases: { caseData: CaseDef; bankVersion: string }[] = [];
  let loaded = false;

  function filtered(): { caseData: CaseDef; bankVersion: string }[] {
    return allCases.filter((entry) => (level === 'all' || entry.caseData.diff === level) && (mapFilter === 'all' || entry.caseData.map === mapFilter));
  }

  function renderRows(): void {
    const list = filtered();
    countEl.textContent = loaded ? `${list.length} caso${list.length === 1 ? '' : 's'}.` : 'Cargando…';
    const page = list.slice(0, shown);
    rowsEl.innerHTML = page
      .map(({ caseData }) => {
        const map = MAPS.find((m) => m.id === caseData.map);
        const victim = VICTIMS[caseData.victim];
        return `<li class="case-row">
          <span class="case-row-lv">${LEVEL_NAME[caseData.diff as DiffIndex]}</span>
          <span class="case-row-info"><b>${map?.name ?? ''}</b><span>${victim}</span></span>
          <button class="btn ghost" type="button" data-id="${caseData.id}">Jugar</button>
        </li>`;
      })
      .join('');
    rowsEl.querySelectorAll<HTMLButtonElement>('button[data-id]').forEach((b) => {
      b.addEventListener('click', () => {
        const entry = page.find((e) => e.caseData.id === b.dataset.id);
        if (entry) options.onPlay(entry.caseData, entry.bankVersion);
      });
    });
    moreBtn.hidden = shown >= list.length;
  }

  root.querySelector('#clBack')?.addEventListener('click', () => options.onBack());
  root.querySelectorAll<HTMLButtonElement>('#clLevel .chip').forEach((b) => {
    b.addEventListener('click', () => {
      level = b.dataset.lv === 'all' ? 'all' : (Number(b.dataset.lv) as DiffIndex);
      shown = PAGE_SIZE;
      root.querySelectorAll<HTMLButtonElement>('#clLevel .chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
      renderRows();
    });
  });
  root.querySelectorAll<HTMLButtonElement>('#clMap .chip').forEach((b) => {
    b.addEventListener('click', () => {
      mapFilter = (b.dataset.map as MapId | 'all') ?? 'all';
      shown = PAGE_SIZE;
      root.querySelectorAll<HTMLButtonElement>('#clMap .chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
      renderRows();
    });
  });
  moreBtn.addEventListener('click', () => {
    shown += PAGE_SIZE;
    renderRows();
  });

  renderRows();
  void (async () => {
    const stars = getProfile().stars;
    const unlocked = new Set(MAPS.filter((m) => isMapUnlocked(m.unlock, stars)).map((m) => m.id));
    for (const mode of ['novato', 'inspector', 'comisario'] as const) {
      try {
        const bank = await loadBank(mode);
        for (const c of bank.cases) if (unlocked.has(c.map)) allCases.push({ caseData: c, bankVersion: bank.version });
      } catch {
        // sin conexión: se enseña lo que se haya podido cargar
      }
    }
    loaded = true;
    renderRows();
  })();

  return () => {
    allCases = [];
  };
}
