// Modo Incendio, núcleo (docs/MODOS.md 2.2, 2.3 y 2.9; fase F1). El tiempo se
// simula con page.clock: los 300 s del edificio pasan en milisegundos.
import { expect, test, type Page } from '@playwright/test';

interface FixtureFile {
  cases: { caseData: { culprit: number; weapon: number; N: number } }[];
}

async function enterFirstBuilding(page: Page): Promise<void> {
  await page.clock.install();
  await page.goto('./#incendio');
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'fuego');
  await page.getByRole('button', { name: 'Entrar en el edificio' }).first().click();
  await expect(page.locator('#fireClock')).toHaveText('5:00');
}

async function accuseWrong(page: Page, culprit: number, weapon: number, n: number): Promise<void> {
  await page.locator('#accuseBtn').click();
  await page.locator(`.accuse-overlay [data-sus="${(culprit + 1) % n}"]`).click();
  await page.locator(`.accuse-overlay [data-obj="${weapon}"]`).click();
  await page.locator('#accuseSubmit').click();
}

test('al llegar a 0:00 el edificio se derrumba y se puede volver a entrar con el reloj entero', async ({ page }) => {
  await enterFirstBuilding(page);

  // Fase de humo: a los 30 s el foco ya avisa, todavía no arde nada.
  await page.clock.runFor(30_000);
  await expect(page.locator('.fl-heat').first()).toBeVisible();
  await expect(page.locator('.fl-char')).toHaveCount(0);

  // A los 45 s prende el foco.
  await page.clock.runFor(16_000);
  await expect(page.locator('.fl-char').first()).toBeAttached();

  // Último minuto: el reloj se marca.
  await page.clock.runFor(200_000);
  await expect(page.locator('#fireClock')).toHaveClass(/hot/);

  // 0:00: derrumbe.
  await page.clock.runFor(60_000);
  await expect(page.getByRole('alertdialog', { name: 'El edificio se ha derrumbado' })).toBeVisible();
  await expect(page.locator('#fireClock')).toHaveText('0:00');

  // Con el edificio derrumbado no se puede acusar.
  // La capa del derrumbe tapa el botón: se dispara el clic directamente para comprobar que el tablero lo rechaza.
  await page.locator('#accuseBtn').dispatchEvent('click');
  await expect(page.locator('.accuse-overlay')).toHaveCount(0);

  // Volver a entrar: el mismo edificio, desde cero.
  await page.getByRole('button', { name: 'Volver a entrar' }).click();
  await expect(page.locator('#fireClock')).toHaveText('5:00');
  await expect(page.locator('.fire-collapse')).toHaveCount(0);
  await expect(page.locator('.fl-char')).toHaveCount(0);
});

test('una acusación errónea resta 30 segundos, y si agota el tiempo el derrumbe es inmediato', async ({ page, request }) => {
  const data = (await (await request.get('./cases/incendio.json')).json()) as FixtureFile;
  const { culprit, weapon, N } = data.cases[0].caseData;
  await enterFirstBuilding(page);

  await page.clock.runFor(10_000);
  await expect(page.locator('#fireClock')).toHaveText('4:50');
  await accuseWrong(page, culprit, weapon, N);
  await expect(page.locator('#fireClock')).toHaveText('4:20');

  // A 20 s del final, otra acusación errónea deja el reloj por debajo de cero.
  await page.clock.runFor(240_000);
  await expect(page.locator('#fireClock')).toHaveText('0:20');
  await accuseWrong(page, culprit, weapon, N);
  await expect(page.getByRole('alertdialog', { name: 'El edificio se ha derrumbado' })).toBeVisible();
});

test('el tiempo se detiene con la pestaña oculta y al volver aparece "En pausa"', async ({ page }) => {
  await enterFirstBuilding(page);
  await page.clock.runFor(5_000);
  await expect(page.locator('#fireClock')).toHaveText('4:55');

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(60_000);
  await expect(page.getByRole('dialog', { name: 'En pausa' })).toBeVisible();
  await expect(page.locator('#fireClock')).toHaveText('4:55');

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.getByRole('button', { name: 'Seguir' }).click();
  await expect(page.locator('.fire-pause')).toBeHidden();
  await page.clock.runFor(5_000);
  await expect(page.locator('#fireClock')).toHaveText('4:50');
});

test('volver al menú desde el incendio recupera la estética normal', async ({ page }) => {
  await enterFirstBuilding(page);
  await page.locator('#exit').click();
  await expect(page.locator('#goDaily')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-mode', '');
});
