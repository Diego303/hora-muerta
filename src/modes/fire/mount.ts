// Monta un intento de incendio sobre el tablero: el estado del intento, los
// bloqueos, las pistas que arden, la interfaz del modo, los récords (hm2:fire) y
// el cierre con medallas. Todo se desmonta al salir.
import { MAPS } from '../../engine/content/maps';
import { rankForStars } from '../../game/progression';
import { getProfile, saveProfile } from '../../game/storage';
import { renderBoard, type BoardHandle } from '../../ui/board';
import { openConfirm } from '../../ui/confirm';
import { toast } from '../../ui/toast';
import { FIRE_PENALTY_S, FIRE_PHOTOS } from './config';
import { createFirePlay } from './play';
import { fireMedals, loadFireRecords, saveFireRecords, withAttempt, withSolve } from './records';
import type { FireCase } from './types';
import { fireClueDecor } from './ui/clues';
import { renderFireSolved } from './ui/end';
import { attachFireHud, type FireHud } from './ui/hud';
import { mountFireLayer, type FireLayer } from './ui/layer';

export interface FireMountActions {
  /** Volver al menú. */
  onExit: () => void;
  /** Volver a entrar en este mismo edificio. */
  onRestart: () => void;
  /** Volver a la lista de edificios. */
  onLobby: () => void;
}

export function mountFireCase(root: HTMLElement, fire: FireCase, actions: FireMountActions): () => void {
  const map = MAPS.find((m) => m.id === fire.caseData.map);
  if (!map) throw new Error(`Mapa desconocido: ${fire.caseData.map}`);
  const caseId = fire.caseData.id;
  const play = createFirePlay(fire, map, () => performance.now());
  saveFireRecords(withAttempt(loadFireRecords(), caseId));

  const layers = new Set<FireLayer>();
  let hud: FireHud | null = null;
  let board: BoardHandle | null = null;
  let closeConfirm: (() => void) | null = null;
  let closeEnd: (() => void) | null = null;

  const clueDecor = fireClueDecor(play, {
    notice: toast,
    announce: (message) => hud?.announce(message),
    refresh: () => board?.refreshSheet(),
  });

  function finishSolved(): void {
    const secondsLeft = play.run.remaining();
    play.solved = true;
    play.run.pause();
    hud?.stop();
    hud = null;
    const medals = fireMedals({ photosUsed: FIRE_PHOTOS - play.photosLeft, wrongAccusations: play.wrongAccusations, secondsLeft });
    const result = withSolve(loadFireRecords(), caseId, secondsLeft, medals, new Date());
    saveFireRecords(result.records);
    // Estrellas de rango (MODOS 2.8): solo lo que mejora la mejor marca del caso.
    if (result.starsGained > 0) {
      const profile = getProfile();
      const stars = profile.stars + result.starsGained;
      saveProfile({ ...profile, stars, rank: rankForStars(stars).id });
    }
    closeEnd = renderFireSolved(
      root,
      play,
      { secondsLeft, medals, starsGained: result.starsGained, newBest: result.newBest },
      { onRetry: actions.onRestart, onLobby: actions.onLobby },
    );
  }

  const leaveBoard = renderBoard(root, fire.caseData, {
    onExit: actions.onExit,
    onNextCase: actions.onLobby,
    bankVersion: null,
    fire: {
      roomBurning: (room) => play.run.roomBurning(room),
      frozen: () => play.collapsed || play.solved,
      notice: toast,
      onWrongAccusation: () => {
        if (play.collapsed) return;
        play.wrongAccusations += 1;
        play.run.penalize();
        // Si la penalización agota el tiempo, el derrumbe es inmediato (MODOS 2.9).
        hud?.refresh();
        if (!play.collapsed) toast(`No encaja con los hechos. Se suman ${FIRE_PENALTY_S} segundos.`);
      },
      decoratePlan: (svg, plan) => {
        const layer = mountFireLayer(svg, plan, fire.fire.ign);
        layer.update(play.run.consumed());
        layers.add(layer);
        return () => {
          layers.delete(layer);
          layer.destroy();
        };
      },
      clueDecor,
      onSolved: finishSolved,
      confirmExit: (proceed) => {
        if (play.collapsed || play.solved) {
          proceed();
          return;
        }
        closeConfirm?.();
        closeConfirm = openConfirm({
          title: 'Salir del edificio',
          text: 'Si sales, el incendio se pierde. ¿Salir?',
          confirmLabel: 'Salir',
          cancelLabel: 'Seguir dentro',
          onConfirm: proceed,
        });
      },
    },
    onReady: (store, plan, handle) => {
      board = handle;
      hud = attachFireHud(root, play, store, plan, handle, layers, {
        onRestart: actions.onRestart,
        onLobby: actions.onLobby,
      });
    },
  });

  return () => {
    closeConfirm?.();
    hud?.stop();
    hud = null;
    closeEnd?.();
    leaveBoard();
  };
}
