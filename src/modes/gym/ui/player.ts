// Reproductor de una sesión de calentamiento (docs/MODOS.md 3.3, 3.4, 3.5, 3.9 y 3.11):
// pantalla breve antes de cada bloque, cada ejercicio con su miniplano, la respuesta,
// la corrección (✓ / ✗, la pista del error, la explicación y las marcas en el plano) y
// "Siguiente". Sin reloj ni castigo.
import { carryText, clueText } from '../../../engine/text';
import type { Room } from '../../../engine/types';
import { renderPlanLite, type PlanLiteOptions } from '../../../ui/planlite';
import { BLOCK_NAMES, type BlockIndex, type SessionItem, type SessionPlan } from '../compose';
import { TECHS } from '../content';
import { grade, type Grade } from '../grade';
import { knownTokens } from '../normalize';
import type { Answer, Drill, Reply, Tri } from '../types';

export interface PlayerActions {
  /** Cada respuesta, al momento (cuenta para las estadísticas aunque se salga a mitad). */
  onAnswer: (item: SessionItem, ok: boolean) => void;
  onQuit: () => void;
  onFinish: (results: boolean[]) => void;
}

const TRI_OPTIONS: [Tri, string][] = [
  ['V', 'Verdadero'],
  ['F', 'Falso'],
  ['NS', 'No se puede saber'],
];

const COUNT_WORDS = ['Ningún', 'Un', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete', 'Ocho', 'Nueve', 'Diez'];
const count = (n: number, one: string, many: string): string => `${COUNT_WORDS[n] ?? n} ${n === 1 ? one : many}`;

function interText(block: BlockIndex, plan: SessionPlan, n: number): [string, string] {
  if (block === 0) {
    if (plan.kind === 'diagnostico') return ['Diagnóstico', `${count(n, 'ejercicio', 'ejercicios')} de las cuatro técnicas, los más sencillos. Sirven para saber por dónde empezar.`];
    return ['Activación', `${count(n, 'deducción rápida', 'deducciones rápidas')}. Lee con calma: aquí no hay reloj.`];
  }
  if (block === 1) return [TECHS[plan.tech].name, `${TECHS[plan.tech].desc} ${count(n, 'ejercicio', 'ejercicios seguidos')} de la misma técnica.`];
  return ['Remate', `${count(n, 'final de caso', 'finales de caso')}. Cuando quedan dos, relee las pistas pensando solo en esos dos, o prueba una hipótesis y busca dónde se rompe.`];
}

function question(drill: Drill): string {
  if (drill.type === 'tri') return '¿Verdadero, falso o no se puede saber?';
  if (drill.type === 'pick' && drill.ask) {
    if (drill.ask.who !== null) {
      const o = drill.ctx.objects[drill.ask.who];
      return `¿Quién llevaba ${o.article} ${o.name}?`;
    }
    if (drill.ask.what !== null) return `¿Qué llevaba ${drill.ctx.suspects[drill.ask.what].name}?`;
  }
  return drill.prompt;
}

function statement(drill: Drill): string {
  const s = drill.stmt;
  if (!s) return '';
  return s.k === 'carry' ? carryText(s.c, s.o, drill.ctx) : clueText(s, drill.ctx);
}

/** Tabla de objetos opcional para anotar (no cuenta para la respuesta). */
function gridMarkup(drill: Drill): string {
  const heads = drill.ctx.suspects.map((s) => `<th scope="col"><span class="who" style="--c:${s.color}">${s.name[0]}</span><span class="sr-only">${s.name}</span></th>`).join('');
  const rows = drill.ctx.objects
    .map(
      (o, oi) =>
        `<tr><th scope="row">${o.label}</th>${drill.ctx.suspects.map((s, c) => `<td><button type="button" data-cell="${oi}:${c}" aria-label="${o.label}, ${s.name}: sin marca"></button></td>`).join('')}</tr>`,
    )
    .join('');
  return `<h3>Tu tabla</h3><p class="g-note">Opcional: toca las casillas para anotar ✓ o ✗.</p><table class="g-grid"><tr><th></th>${heads}</tr>${rows}</table>`;
}

export function runSession(root: HTMLElement, plan: SessionPlan, actions: PlayerActions): () => void {
  const { items } = plan;
  const blockOrder = [...new Set(items.map((i) => i.block))];
  const results: boolean[] = [];
  let index = 0;
  let pendingInter = true;

  function header(label: string): string {
    const dots = items
      .map((_, k) => `<i class="${k < index ? (results[k] ? 'ok' : 'ko') : k === index ? 'now' : ''}">${k < index ? (results[k] ? '✓' : '✗') : ''}</i>`)
      .join('');
    return `<header class="gym-bar">
      <button class="icon-btn" id="gymQuit" type="button">← Salir</button>
      <div class="gym-prog"><span>${label}</span><div class="gdots" aria-hidden="true">${dots}</div></div>
    </header>`;
  }

  function wireQuit(): void {
    root.querySelector('#gymQuit')?.addEventListener('click', () => actions.onQuit());
  }

  function render(): void {
    const item = items[index];
    if (!item) {
      actions.onFinish(results);
      return;
    }
    if (pendingInter && (index === 0 || items[index - 1].block !== item.block)) {
      renderInter(item.block);
      return;
    }
    pendingInter = false;
    renderDrill(item);
  }

  function renderInter(block: BlockIndex): void {
    const [title, text] = interText(block, plan, items.filter((i) => i.block === block).length);
    const pos = blockOrder.indexOf(block) + 1;
    const label = blockOrder.length > 1 ? `Bloque ${pos} de ${blockOrder.length}` : 'Sesión de remates';
    root.innerHTML = `<div class="wrap gym gym-play">${header(label)}
      <article class="gcard gym-inter">
        <p class="gk">${label}${block === 1 ? ': técnica del día' : ''}</p>
        <h2 class="big">${title}</h2>
        <p>${text}</p>
        <button class="btn" id="gGo" type="button">${pos === 1 ? 'Empezar' : 'Seguir'}</button>
      </article></div>`;
    wireQuit();
    const go = root.querySelector<HTMLButtonElement>('#gGo');
    go?.addEventListener('click', () => {
      pendingInter = false;
      render();
    });
    go?.focus();
    window.scrollTo(0, 0);
  }

  function renderDrill(item: SessionItem): void {
    const { drill, answer } = item.bank;
    const selected = new Set<Room>();
    let pick: number | null = null;
    let done = false;

    const factItems = drill.given.map((c) => `<li>${clueText(c, drill.ctx)}</li>`).join('');
    const isChoice = drill.type === 'clue' || drill.type === 'contra';
    const clueList = isChoice
      ? `<h3>Pistas</h3><ul class="g-pick" id="gPick">${drill.clues
          .map((c, k) => {
            const used = drill.used[k];
            const text = used ? `<s>${clueText(c, drill.ctx)}</s> <small>(ya usada)</small>` : clueText(c, drill.ctx);
            return `<li><button type="button" data-k="${k}" aria-pressed="false"${used ? ' disabled' : ''}><span class="n">${k + 1}</span><span>${text}</span></button></li>`;
          })
          .join('')}</ul>`
      : '';
    const withGrid = drill.nObjs > 0 && (drill.type === 'pick' || drill.stmt?.k === 'carry');
    let answerZone = '';
    if (drill.type === 'reach' || isChoice) answerZone = '<button class="btn g-check" id="gCheck" type="button" disabled>Comprobar</button>';
    if (drill.type === 'tri') answerZone = `<div class="g-opts">${TRI_OPTIONS.map(([v, l]) => `<button class="btn ghost" type="button" data-v="${v}">${l}</button>`).join('')}</div>`;
    if (drill.type === 'pick' && drill.ask) {
      const opts = drill.ask.who !== null ? drill.ctx.suspects.map((s, k) => [String(k), s.name]) : drill.ctx.objects.map((o, k) => [String(k), o.label]);
      answerZone = `<div class="g-opts">${opts.map(([v, l]) => `<button class="btn ghost" type="button" data-v="${v}">${l}</button>`).join('')}<button class="btn ghost" type="button" data-v="NS">No se puede saber</button></div>`;
    }

    root.innerHTML = `<div class="wrap gym gym-play">${header(`Ejercicio ${index + 1} de ${items.length} · ${BLOCK_NAMES[item.block]}`)}
      <article class="gcard">
        <p class="gk">${TECHS[drill.tech].name}${item.review ? ' <span class="g-review">· repaso</span>' : ''}</p>
        ${drill.context ? `<p class="gctx">${drill.context}</p>` : ''}
        <h2 class="gq" id="gQ">${question(drill)}</h2>
        ${drill.type === 'tri' ? `<p class="gstmt">${statement(drill)}</p>` : ''}
        <div class="g-lay${drill.hasPlan ? ' has-plan' : ''}">
          ${drill.hasPlan ? `<div class="g-plan"><svg id="gPlan" aria-label="Plano: ${drill.plan.name}"></svg></div>` : ''}
          <div class="g-side">
            ${factItems ? `<h3>Lo que sabes</h3><ul class="g-facts">${factItems}</ul>` : ''}
            ${clueList}
            ${withGrid ? gridMarkup(drill) : ''}
          </div>
        </div>
        <div class="g-ans" id="gAns">${answerZone}</div>
        <div class="g-fb" id="gFb" role="status" aria-live="polite"></div>
      </article></div>`;
    wireQuit();

    const check = root.querySelector<HTMLButtonElement>('#gCheck');
    const svg = root.querySelector<SVGSVGElement>('#gPlan');

    function drawPlan(result: Grade | null): void {
      if (!svg) return;
      const options: PlanLiteOptions = {
        doors: true,
        labels: true,
        victimRoom: drill.rv ?? undefined,
        tokens: knownTokens(drill).map((t) => {
          const s = drill.ctx.suspects[t.c];
          return { c: t.c, r: t.r, label: s.name[0], caption: t.caption, dashed: t.hyp, color: s.color };
        }),
      };
      if (drill.type === 'reach' && !result) {
        options.selectable = true;
        options.selected = [...selected];
        options.onToggle = (r) => {
          if (done) return;
          if (selected.has(r)) selected.delete(r);
          else selected.add(r);
          if (check) check.disabled = selected.size === 0;
          drawPlan(null);
          svg.querySelector<SVGGElement>(`[data-room="${r}"]`)?.focus();
        };
      }
      if (result) {
        const marks: NonNullable<PlanLiteOptions['marks']> = { ok: [...drill.show.rooms], miss: [], bad: [] };
        if (answer.type === 'reach') {
          for (let r = 0; r < drill.plan.rooms.length; r++) {
            const right = answer.rooms.includes(r);
            if (right && selected.has(r)) marks.ok?.push(r);
            else if (right) marks.miss?.push(r);
            else if (selected.has(r)) marks.bad?.push(r);
          }
        }
        options.marks = marks;
        options.path = drill.show.path;
      }
      renderPlanLite(svg, drill.plan, options);
    }
    drawPlan(null);

    function finish(reply: Reply): void {
      if (done) return;
      done = true;
      const result = grade(drill, answer, reply);
      results[index] = result.ok;
      actions.onAnswer(item, result.ok);
      markOptions(reply, answer);
      if (check) check.hidden = true;
      drawPlan(result);
      const last = index === items.length - 1;
      const fb = root.querySelector<HTMLDivElement>('#gFb');
      if (!fb) return;
      fb.innerHTML = `<p class="res ${result.ok ? 'ok' : 'ko'}">${result.ok ? '✓ Correcto' : '✗ No del todo'}</p>
        ${result.hint ? `<p class="hint">${result.hint}</p>` : ''}
        <p class="explain">${drill.explain}</p>
        <button class="btn" id="gNext" type="button">${last ? 'Ver el resultado' : 'Siguiente'}</button>`;
      const next = fb.querySelector<HTMLButtonElement>('#gNext');
      next?.addEventListener('click', () => {
        index += 1;
        pendingInter = true;
        render();
      });
      next?.focus({ preventScroll: true });
      fb.scrollIntoView({ block: 'nearest' });
    }

    function markOptions(reply: Reply, right: Answer): void {
      const ans = root.querySelector('#gAns');
      ans?.querySelectorAll<HTMLButtonElement>('[data-v]').forEach((b) => {
        b.disabled = true;
        const v = b.dataset.v ?? '';
        const correct = (right.type === 'tri' || right.type === 'pick') && String(right.value) === v;
        const chosen = (reply.type === 'tri' || reply.type === 'pick') && String(reply.value) === v;
        if (correct) b.classList.add('right');
        else if (chosen) b.classList.add('wrong');
        if (correct || chosen) b.insertAdjacentText('afterbegin', correct ? '✓ ' : '✗ ');
      });
      root.querySelectorAll<HTMLButtonElement>('#gPick button').forEach((b) => {
        b.disabled = true;
        const k = Number(b.dataset.k);
        if (right.type === 'decide' && right.decide.includes(k)) b.classList.add('right');
        else if (reply.type === 'decide' && reply.pick === k) b.classList.add('wrong');
      });
    }

    root.querySelectorAll<HTMLButtonElement>('#gAns [data-v]').forEach((b) => {
      b.addEventListener('click', () => {
        const v = b.dataset.v ?? '';
        if (drill.type === 'tri') finish({ type: 'tri', value: v as Tri });
        else finish({ type: 'pick', value: v === 'NS' ? 'NS' : Number(v) });
      });
    });
    root.querySelectorAll<HTMLButtonElement>('#gPick button:not(:disabled)').forEach((b) => {
      b.addEventListener('click', () => {
        if (done) return;
        pick = Number(b.dataset.k);
        root.querySelectorAll('#gPick button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        if (check) check.disabled = false;
      });
    });
    check?.addEventListener('click', () => {
      if (drill.type === 'reach') finish({ type: 'reach', rooms: [...selected] });
      else if (pick !== null) finish({ type: 'decide', pick });
    });
    root.querySelectorAll<HTMLButtonElement>('.g-grid [data-cell]').forEach((b) => {
      let mark = 0;
      const label = b.getAttribute('aria-label')?.replace(/: .*$/, '') ?? '';
      b.addEventListener('click', () => {
        mark = (mark + 1) % 3;
        b.textContent = ['', '✓', '✗'][mark];
        b.classList.toggle('no', mark === 2);
        b.setAttribute('aria-label', `${label}: ${['sin marca', 'lo llevaba', 'no lo llevaba'][mark]}`);
      });
    });
    // El foco pasa al enunciado: un lector de pantalla lee el ejercicio nuevo al llegar.
    const q = root.querySelector<HTMLHeadingElement>('#gQ');
    q?.setAttribute('tabindex', '-1');
    q?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  render();
  return () => undefined;
}
