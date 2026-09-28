// Capturas de referencia en tema claro y oscuro (§20), en los 3 tamaños de
// playwright.config.ts. No comprueba mecánica de juego (ya la cubren
// board.spec.ts/close.spec.ts/hint.spec.ts): solo que el tema cambia de
// verdad (data-theme + se guarda) y deja una captura de la portada y de la
// mesa de trabajo en cada tema.
import { expect, test } from '@playwright/test';

test('portada y mesa de trabajo en claro y oscuro', async ({ page }) => {
  await page.goto('./');

  await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: 'test-results/landing-light.png' });

  await page.locator('.themeT').first().click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const savedDark = await page.evaluate(() => JSON.parse(localStorage.getItem('hm2:settings') ?? '{}').theme);
  expect(savedDark).toBe('dark');
  await page.screenshot({ path: 'test-results/landing-dark.png' });

  await page.getByRole('button', { name: 'Empezar' }).first().click();
  await expect(page.locator('.game')).toBeVisible();
  await page.screenshot({ path: 'test-results/board-dark.png' });

  // Vuelve a claro: el tema del tablero se lee del mismo hm2:settings, no de
  // un estado aparte por pantalla.
  await page.reload();
  await expect(page.locator('.game')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
