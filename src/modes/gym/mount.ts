// La Academia como una sola vista (#academia): entrada, sesión e informe se suceden
// dentro de ella, y al salir se para lo que haya en pantalla.
import { todayKey } from '../../game/modes';
import { isFirstTime, techOfDay, withAnswer, withReview, withSession, type DayTech, type Level } from './adapt';
import { planSession, summarize, type SessionKind } from './compose';
import type { BankDrill } from './drills';
import { loadDrillBank } from './load';
import { loadGymProgress, saveGymProgress, techProgress, type GymProgress } from './progress';
import type { Tech } from './types';
import { renderGymIntro } from './ui/intro';
import { runSession } from './ui/player';
import { renderGymReport } from './ui/report';

export interface AcademyActions {
  onBack: () => void;
  /** "Ir a jugar un caso": la portada con el plano de casos desplegado. */
  onPlayCase: () => void;
  /** Técnica que se viene a practicar desde el cierre de un caso (MODOS 3.10.2), o
   * 'remates' desde la hoja de acusación (3.10.1), que empieza la sesión corta al momento. */
  focus?: Tech | 'remates';
  /** Volver al caso guardado al entrar desde "Practicar remates". */
  onResumeCase?: () => void;
}

const FOCUS_WHY = 'Es la que te recomendamos por el caso que acabas de cerrar.';

export function mountAcademy(root: HTMLElement, actions: AcademyActions): () => void {
  let stop: () => void = () => undefined;
  const show = (mount: () => () => void): void => {
    stop();
    stop = mount();
  };
  let alive = true;
  // El banco generado se pide al entrar; mientras llega, la entrada ya se ve.
  const bank = loadDrillBank();
  const focus: DayTech | 'remates' | undefined = actions.focus === 'remate' ? 'remates' : actions.focus;

  function dayTech(progress: GymProgress): { tech: DayTech; why: string } {
    if (focus && focus !== 'remates') return { tech: focus, why: FOCUS_WHY };
    return techOfDay(progress, todayKey());
  }

  function intro(): void {
    const progress = loadGymProgress();
    show(() =>
      renderGymIntro(root, progress, dayTech(progress), isFirstTime(progress), {
        onStart: () => start(isFirstTime(loadGymProgress()) ? 'diagnostico' : 'normal'),
        onBack: actions.onBack,
        onResumeCase: actions.onResumeCase,
      }),
    );
  }

  function start(kind: SessionKind): void {
    void bank.then((drills) => {
      if (alive) play(drills, kind);
    });
  }

  function play(drills: BankDrill[], kind: SessionKind): void {
    const before = loadGymProgress();
    const plan = planSession(drills, before, kind, dayTech(before).tech);
    // Lo servido se apunta al empezar: salir a mitad no hace que vuelvan los mismos.
    saveGymProgress(plan.progress);
    show(() =>
      runSession(root, plan, {
        // Cada respuesta se guarda al momento: salir a mitad no pierde lo respondido (MODOS 3.4).
        onAnswer: (item, ok) => {
          const answered = withAnswer(loadGymProgress(), item.bank.drill.tech, ok).progress;
          saveGymProgress(withReview(answered, item.bank.drill.id, ok));
        },
        onQuit: intro,
        onFinish: (results) => {
          const summary = summarize(plan.items, results);
          const after = withSession(loadGymProgress(), {
            date: todayKey(),
            score: summary.ok,
            n: summary.total,
            tech: kind === 'remates' ? 'remate' : plan.tech,
          });
          saveGymProgress(after);
          const levels: Partial<Record<Tech, [Level, Level]>> = {};
          for (const t of Object.keys(summary.techs) as Tech[]) levels[t] = [techProgress(before, t).level, techProgress(after, t).level];
          show(() =>
            renderGymReport(root, summary, levels, after.streak, {
              onPlay: actions.onPlayCase,
              onAgain: () => start(kind === 'remates' ? 'remates' : 'normal'),
              onAcademy: intro,
              onResumeCase: actions.onResumeCase,
            }),
          );
        },
      }),
    );
  }

  if (focus === 'remates') start('remates');
  else intro();
  return () => {
    alive = false;
    stop();
  };
}
