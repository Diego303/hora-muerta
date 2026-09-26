import { getSettings, saveSettings } from '../game/storage';

export function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function systemTheme(): 'light' | 'dark' {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function currentTheme(): 'light' | 'dark' {
  const attr = document.documentElement.getAttribute('data-theme');
  return attr === 'dark' || attr === 'light' ? attr : systemTheme();
}

function applyTheme(theme: 'light' | 'dark'): void {
  document.documentElement.setAttribute('data-theme', theme);
}

/** Aplica el tema guardado (o el del sistema) al arrancar. Ya se hace antes del primer pintado
 * en un script embebido en Layout.astro; esto mantiene main.ts consistente con ese estado. */
export function initTheme(): void {
  const settings = getSettings();
  applyTheme(settings.theme ?? systemTheme());
}

export function toggleTheme(): void {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  saveSettings({ ...getSettings(), theme: next });
}

export function wireThemeToggles(): void {
  document.querySelectorAll<HTMLButtonElement>('.themeT').forEach((button) => {
    button.addEventListener('click', () => toggleTheme());
  });
}
