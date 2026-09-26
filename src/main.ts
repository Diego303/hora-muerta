import { initTheme, wireThemeToggles } from './ui/a11y';
import { renderLanding } from './ui/landing';

const app = document.getElementById('app');
if (!app) throw new Error('Falta el contenedor #app en index.astro.');

initTheme();
renderLanding(app);
wireThemeToggles();
