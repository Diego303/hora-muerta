// Tabla de objetos (§17.7): filas = objetos, columnas = sospechosos. Toque: ✓,
// ✗, vacío. Con "Autocompletar tabla" (por defecto), un ✓ rellena con ✗ el
// resto de la fila y la columna. Desplazamiento horizontal propio si no cabe.
import type { ClueTextContext } from '../engine/text';
import { objGridKey } from '../game/store';
import type { GameStore } from '../game/store';
import { getSettings, saveSettings } from '../game/storage';

const MARK_LABEL: Record<0 | 1 | 2, string> = { 0: 'sin marcar', 1: 'llevaba', 2: 'no llevaba' };
const MARK_SYMBOL: Record<0 | 1 | 2, string> = { 0: '', 1: '✓', 2: '✗' };
const MARK_CLASS: Record<0 | 1 | 2, string> = { 0: '', 1: 'yes', 2: 'no' };

export function renderObjectsTable(container: HTMLElement, ctx: ClueTextContext, store: GameStore): void {
  const state = store.getState();
  const N = state.caseData.N;
  const settings = getSettings();

  const header = ctx.suspects.map((s) => `<th style="color:${s.color}">${s.name[0]}</th>`).join('');
  const rows = ctx.objects
    .map((o, oi) => {
      const cells = Array.from({ length: N }, (_, ci) => {
        const v = (state.objGrid.get(objGridKey(oi, ci)) ?? 0) as 0 | 1 | 2;
        return `<button class="cell ${MARK_CLASS[v]}" data-o="${oi}" data-c="${ci}" aria-label="${o.label}, ${ctx.suspects[ci].name}: ${MARK_LABEL[v]}">${MARK_SYMBOL[v]}</button>`;
      }).join('');
      return `<tr><th>${o.label}</th>${cells}</tr>`;
    })
    .join('');

  container.innerHTML = `
    <label class="autogrid"><input type="checkbox" id="autoGridToggle" ${settings.autoGrid ? 'checked' : ''} /> Autocompletar tabla</label>
    <div class="objtable-scroll">
      <table class="objtable"><thead><tr><th></th>${header}</tr></thead><tbody>${rows}</tbody></table>
    </div>
  `;

  container.querySelectorAll<HTMLButtonElement>('.cell').forEach((button) => {
    button.addEventListener('click', () => store.cycleObjGrid(Number(button.dataset.o), Number(button.dataset.c)));
  });
  container.querySelector<HTMLInputElement>('#autoGridToggle')?.addEventListener('change', (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    saveSettings({ ...getSettings(), autoGrid: checked });
  });
}
