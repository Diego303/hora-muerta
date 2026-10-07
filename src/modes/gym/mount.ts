// La Academia como una sola vista (#academia): entrada, sesión e informe se suceden
// dentro de ella, y al salir se para lo que haya en pantalla.
import { todayKey } from '../../game/modes';
import { composeSession, summarize } from './compose';
import { loadGymProgress, saveGymProgress, techOfDay, withAnswer, withSession } from './progress';
import { renderGymIntro } from './ui/intro';
import { runSession } from './ui/player';
import { renderGymReport } from './ui/report';

export interface AcademyActions {
  onBack: () => void;
  /** "Ir a jugar un caso": la portada con el plano de casos desplegado. */
  onPlayCase: () => void;
}

export function mountAcademy(root: HTMLElement, actions: AcademyActions): () => void {
  let stop: () => void = () => undefined;
  const show = (mount: () => () => void): void => {
    stop();
    stop = mount();
  };

  function intro(): void {
    const progress = loadGymProgress();
    show(() => renderGymIntro(root, progress, techOfDay(progress), { onStart: start, onBack: actions.onBack }));
  }

  function start(): void {
    const today = techOfDay(loadGymProgress());
    const items = composeSession(today.tech);
    show(() =>
      runSession(root, items, today.tech, {
        // Cada respuesta se guarda al momento: salir a mitad no pierde lo respondido (MODOS 3.4).
        onAnswer: (item, ok) => saveGymProgress(withAnswer(loadGymProgress(), item.bank.drill.tech, ok)),
        onQuit: intro,
        onFinish: (results) => {
          const summary = summarize(items, results);
          saveGymProgress(withSession(loadGymProgress(), { date: todayKey(), score: summary.ok, n: summary.total, tech: today.tech }));
          show(() => renderGymReport(root, summary, { onPlay: actions.onPlayCase, onAgain: start, onAcademy: intro }));
        },
      }),
    );
  }

  intro();
  return () => stop();
}
