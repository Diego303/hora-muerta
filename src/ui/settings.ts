// Ajustes (§17.2, pantalla 6): tema, cronómetro, estela, ayuda de movimiento,
// autocompletar tabla y el tema sepia del plano (desbloqueado en el rango Cabo, §16.1).
import { getSettings, saveSettings } from '../game/storage';
import type { Settings } from '../game/storage';
import { applyPlanTheme, currentTheme, toggleTheme } from './a11y';

export interface SettingsOptions {
  onBack: () => void;
  /** Si no se ha llegado al rango Cabo todavía, el tema sepia no se ofrece (§16.1). */
  sepiaUnlocked: boolean;
}

function toggleRow(id: string, label: string, checked: boolean, disabled = false): string {
  return `
    <label class="toggle-row" for="${id}">
      <input type="checkbox" id="${id}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} />
      <span>${label}</span>
    </label>
  `;
}

export function renderSettings(root: HTMLElement, options: SettingsOptions): () => void {
  const settings = getSettings();

  root.innerHTML = `
    <div class="gbar">
      <button class="icon-btn" id="back" aria-label="Volver a la portada">←</button>
      <div class="ttl"><b>Ajustes</b></div>
    </div>
    <div class="wrap settings-view">
      <section class="sec">
        <h2>Tema</h2>
        <div class="pick" role="group" aria-label="Tema">
          <button class="chip" data-theme="light" aria-pressed="${currentTheme() === 'light'}">Claro</button>
          <button class="chip" data-theme="dark" aria-pressed="${currentTheme() === 'dark'}">Oscuro</button>
        </div>
        ${
          options.sepiaUnlocked
            ? toggleRow('planThemeToggle', 'Plano en tinta sepia (rango Cabo)', settings.planTheme === 'sepia')
            : '<p class="intro">El tema sepia del plano se desbloquea en el rango Cabo (10 estrellas).</p>'
        }
      </section>
      <section class="sec">
        <h2>Mesa de trabajo</h2>
        ${toggleRow('showTimerToggle', 'Mostrar el cronómetro', settings.showTimer)}
        ${toggleRow('trailToggle', 'Estela de la hora anterior y siguiente', settings.trail)}
        <p class="lbl">Ayuda de movimiento (salas a las que no se pudo llegar, §11)</p>
        <div class="pick" role="radiogroup" aria-label="Ayuda de movimiento">
          <button class="chip" data-movehelp="auto" aria-pressed="${settings.moveHelp === null}">Automática (Novato sí, el resto no)</button>
          <button class="chip" data-movehelp="on" aria-pressed="${settings.moveHelp === true}">Siempre activada</button>
          <button class="chip" data-movehelp="off" aria-pressed="${settings.moveHelp === false}">Siempre desactivada</button>
        </div>
        ${toggleRow('autoGridToggle', 'Autocompletar la tabla de objetos', settings.autoGrid)}
      </section>
    </div>
  `;

  function update(patch: Partial<Settings>): void {
    saveSettings({ ...getSettings(), ...patch });
  }

  root.querySelector('#back')?.addEventListener('click', () => options.onBack());

  root.querySelectorAll<HTMLButtonElement>('[data-theme]').forEach((button) => {
    button.addEventListener('click', () => {
      const wanted = button.dataset.theme;
      if (wanted !== currentTheme()) toggleTheme();
      root.querySelectorAll<HTMLButtonElement>('[data-theme]').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    });
  });

  root.querySelector<HTMLInputElement>('#planThemeToggle')?.addEventListener('change', (e) => {
    const sepia = (e.target as HTMLInputElement).checked;
    update({ planTheme: sepia ? 'sepia' : 'default' });
    applyPlanTheme(sepia ? 'sepia' : 'default');
  });
  root.querySelector<HTMLInputElement>('#showTimerToggle')?.addEventListener('change', (e) => {
    update({ showTimer: (e.target as HTMLInputElement).checked });
  });
  root.querySelector<HTMLInputElement>('#trailToggle')?.addEventListener('change', (e) => {
    update({ trail: (e.target as HTMLInputElement).checked });
  });
  root.querySelectorAll<HTMLButtonElement>('[data-movehelp]').forEach((button) => {
    button.addEventListener('click', () => {
      const value = button.dataset.movehelp === 'auto' ? null : button.dataset.movehelp === 'on';
      update({ moveHelp: value });
      root.querySelectorAll<HTMLButtonElement>('[data-movehelp]').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    });
  });
  root.querySelector<HTMLInputElement>('#autoGridToggle')?.addEventListener('change', (e) => {
    update({ autoGrid: (e.target as HTMLInputElement).checked });
  });

  return () => {
    /* nada que limpiar: la pantalla se sustituye entera al navegar */
  };
}
