// Router de vistas (docs/MODOS.md §1.1, F0): volver al menú desde cualquier
// vista no deja ningún temporizador, intervalo ni requestAnimationFrame activo.
// Se mide en la propia página: antes de entrar en las vistas y después de volver
// a la portada tiene que quedar exactamente lo mismo que deja la portada sola.
import { expect, test, type Page } from '@playwright/test';

const LEDGER = `(() => {
  const timeouts = new Set();
  const intervals = new Set();
  const frames = new Set();
  const st = window.setTimeout.bind(window);
  const ct = window.clearTimeout.bind(window);
  const si = window.setInterval.bind(window);
  const ci = window.clearInterval.bind(window);
  const raf = window.requestAnimationFrame.bind(window);
  const caf = window.cancelAnimationFrame.bind(window);
  window.setTimeout = (fn, ms, ...args) => {
    const id = st(() => { timeouts.delete(id); fn(...args); }, ms);
    timeouts.add(id);
    return id;
  };
  window.clearTimeout = (id) => { timeouts.delete(id); ct(id); };
  window.setInterval = (fn, ms, ...args) => {
    const id = si(() => fn(...args), ms);
    intervals.add(id);
    return id;
  };
  window.clearInterval = (id) => { intervals.delete(id); ci(id); };
  window.requestAnimationFrame = (cb) => {
    const id = raf((t) => { frames.delete(id); cb(t); });
    frames.add(id);
    return id;
  };
  window.cancelAnimationFrame = (id) => { frames.delete(id); caf(id); };
  window.__activeTimers = () => ({ timeouts: timeouts.size, intervals: intervals.size, frames: frames.size });
})();`;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(LEDGER);
});

async function activeTimers(page: Page) {
  return page.evaluate(() => (window as unknown as { __activeTimers: () => unknown }).__activeTimers());
}

async function settledBaseline(page: Page) {
  // La portada arranca su demo al montarse y su plano de casos cuando termina de
  // cargar los bancos: se espera a que todo eso se haya asentado.
  await expect(page.locator('#goDaily')).toBeVisible();
  await expect(page.locator('.pf-stage')).toBeVisible();
  let previous = await activeTimers(page);
  await expect
    .poll(async () => {
      const now = await activeTimers(page);
      const stable = JSON.stringify(now) === JSON.stringify(previous);
      previous = now;
      return stable;
    }, { timeout: 8000, intervals: [500] })
    .toBe(true);
  return previous;
}

test('volver al menú desde cada vista no deja temporizadores, intervalos ni fotogramas activos', async ({ page }) => {
  await page.goto('./');
  const baseline = await settledBaseline(page);

  // Modo Incendio (pantalla provisional de F0).
  await page.getByRole('button', { name: 'Modo Incendio' }).click();
  await expect(page.getByRole('heading', { name: 'Modo Incendio' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'fuego');
  await page.getByRole('button', { name: '← Volver al menú' }).click();
  await expect(page.locator('#goDaily')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-mode', '');

  // Calentamiento (la Academia).
  await page.getByRole('button', { name: 'Calentar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Prácticas en la Academia' })).toBeVisible();
  await page.getByRole('button', { name: '← Volver al menú' }).click();
  await expect(page.locator('#goDaily')).toBeVisible();

  // Tutorial: una partida con cronómetro y el coach encima.
  await page.getByRole('button', { name: 'Tutorial', exact: true }).click();
  await expect(page.locator('.game')).toBeVisible();
  await expect(page.locator('.coach')).toBeVisible();
  await page.locator('#coExit').click();
  await expect(page.locator('#goDaily')).toBeVisible();

  // Caso suelto de Novato.
  await page.locator('[data-lv="0"]').first().click();
  await expect(page.locator('.game')).toBeVisible();
  await page.locator('#exit').click();
  await expect(page.locator('#goDaily')).toBeVisible();

  // Ajustes, Perfil y Cómo se juega (pantallas transitorias).
  for (const open of [
    () => page.getByRole('button', { name: 'Ajustes' }).click(),
    () => page.getByRole('button', { name: 'Perfil' }).click(),
    () => page.getByRole('button', { name: 'Cómo se juega' }).click(),
  ]) {
    await open();
    await page.locator('#back').click();
    await expect(page.locator('#goDaily')).toBeVisible();
  }

  await expect.poll(() => activeTimers(page), { timeout: 8000, intervals: [500] }).toEqual(baseline);
});

test('los enlaces #incendio, #academia y #tutorial abren su vista directamente', async ({ page }) => {
  await page.goto('./#incendio');
  await expect(page.getByRole('heading', { name: 'Modo Incendio' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'fuego');

  await page.goto('./#academia');
  await expect(page.getByRole('heading', { name: 'Prácticas en la Academia' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-mode', '');

  await page.goto('./#tutorial');
  await expect(page.locator('.coach')).toBeVisible();
});

test('el menú de la portada tiene en móvil la acción principal a ancho completo', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('./');
  await expect(page.locator('#goDaily')).toBeVisible();
  const daily = await page.locator('#goDaily').boundingBox();
  const fire = await page.locator('[data-go="fire"]').boundingBox();
  expect(daily).not.toBeNull();
  expect(fire).not.toBeNull();
  // Ancho casi completo de la columna (360 px menos el margen de 20 px a cada lado).
  expect(daily?.width ?? 0).toBeGreaterThan(300);
  // Las acciones secundarias van debajo de la principal, no al lado.
  expect(fire?.y ?? 0).toBeGreaterThan((daily?.y ?? 0) + (daily?.height ?? 0) - 1);
  // Sin desplazamiento horizontal del cuerpo.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
