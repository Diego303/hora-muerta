// Pistas en el Modo Incendio (docs/MODOS.md 2.2 y 2.6): mecha con cuenta atrás
// cuando a una pista le quedan 30 s o menos, botón de foto para salvarla, "A salvo"
// y "Pista quemada" (su texto deja de estar en el DOM).
import type { ClueDecor } from '../../../ui/clues';
import type { FirePlay } from '../play';
import { clockText } from '../status';
import { photoCheck } from '../timeline';

const ICO_CAM =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.4" fill="none" stroke="currentColor" stroke-width="2"/></svg>';

export function photosText(left: number): string {
  if (left >= 2) return `${left} fotos para salvar pistas`;
  if (left === 1) return '1 foto para salvar una pista';
  return 'Sin fotos: ya no puedes salvar más pistas';
}

export interface FireClueActions {
  notice(message: string): void;
  announce(message: string): void;
  refresh(): void;
}

export function fireClueDecor(play: FirePlay, actions: FireClueActions): ClueDecor {
  const camera = (i: number): string =>
    play.photosLeft > 0 && !play.solved && !play.collapsed
      ? `<button class="fc-photo" type="button" data-clue-act="photo" aria-label="Fotografiar la pista ${i + 1}">${ICO_CAM}</button>`
      : '';
  return {
    header: () => `<p class="fire-photos">${ICO_CAM}<span>${photosText(play.photosLeft)}</span></p>`,
    view(i) {
      const state = play.clueState(i);
      const className = `fire-clue fc-${state}`;
      switch (state) {
        case 'burnt':
          return { burnt: true, className, trailing: '' };
        case 'saved':
          return { burnt: false, className, trailing: '<span class="fc-saved">A salvo</span>' };
        case 'burning':
          return { burnt: false, className, trailing: `<span class="fc-burning">Ardiendo</span>${camera(i)}` };
        case 'heat':
          return {
            burnt: false,
            className,
            trailing: `<span class="fc-fuse"><span class="sr-only">Arde en </span><span data-fuse="${i}">${clockText(play.clueSecondsLeft(i) ?? 0)}</span></span>${camera(i)}`,
          };
        case 'ok':
          return { burnt: false, className, trailing: camera(i) };
      }
    },
    onAction(i, action) {
      if (action !== 'photo') return;
      const check = photoCheck(play.clueState(i), play.photosLeft);
      if (check === 'too-late') {
        actions.notice('Esa pista ya está ardiendo: no se puede salvar.');
        return;
      }
      if (check === 'no-photos') {
        actions.notice('No te quedan fotos.');
        return;
      }
      if (check === 'already-saved') return;
      play.saved.add(i);
      play.photosLeft -= 1;
      actions.announce(`Pista ${i + 1} a salvo.`);
      actions.refresh();
    },
  };
}

/** Actualiza en el sitio las cuentas atrás de las mechas, sin repintar la lista. */
export function refreshFuses(container: ParentNode, play: FirePlay): void {
  container.querySelectorAll<HTMLElement>('[data-fuse]').forEach((node) => {
    const left = play.clueSecondsLeft(Number(node.dataset.fuse));
    const text = clockText(left ?? 0);
    if (node.textContent !== text) node.textContent = text;
  });
}
