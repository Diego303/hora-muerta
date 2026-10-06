// Monta un caso de incendio en el tablero: crea el intento (reloj y tiempos del
// fuego), lo conecta con el tablero y lo desmonta al salir.
import { MAPS } from '../../engine/content/maps';
import { renderBoard } from '../../ui/board';
import { toast } from '../../ui/toast';
import { FIRE_PENALTY_S } from './config';
import { createFireRun } from './session';
import type { FireCase } from './types';
import { attachFire, type FireAttachment } from './ui/attach';

export interface FireMountActions {
  /** Volver al menú. */
  onExit: () => void;
  /** Volver a entrar en este mismo edificio. */
  onRestart: () => void;
  /** Volver a la lista de edificios. */
  onLobby: () => void;
}

export function mountFireCase(root: HTMLElement, fire: FireCase, actions: FireMountActions): () => void {
  const run = createFireRun(fire.fire.ign, () => performance.now());
  const roomCount = MAPS.find((m) => m.id === fire.caseData.map)?.rooms.length ?? 0;
  let attachment: FireAttachment | null = null;
  // Congelado cuando el derrumbe se ha procesado, no cuando el reloj llega a cero:
  // una acusación correcta que llega justo antes del derrumbe cuenta (MODOS 2.9).
  let collapsed = false;
  const leaveBoard = renderBoard(root, fire.caseData, {
    onExit: actions.onExit,
    onNextCase: actions.onLobby,
    bankVersion: null,
    fire: {
      roomBurning: (room) => run.roomBurning(room),
      frozen: () => collapsed,
      notice: (message) => toast(message),
      onWrongAccusation: () => {
        if (collapsed) return;
        run.penalize();
        // Si la penalización agota el tiempo, el derrumbe es inmediato (MODOS 2.9).
        attachment?.refresh();
        if (!collapsed) toast(`No encaja con los hechos. Se suman ${FIRE_PENALTY_S} segundos.`);
      },
    },
    onReady: (_store, plan) => {
      attachment = attachFire(root, plan, roomCount, run, fire.fire.ign, {
        onRestart: actions.onRestart,
        onExit: actions.onExit,
        onCollapse: () => {
          collapsed = true;
        },
      });
    },
  });
  return () => {
    attachment?.stop();
    leaveBoard();
  };
}
