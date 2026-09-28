// Atajos de teclado (§17.9): 1-6 elige sospechoso, [ y ] cambian de hora, z
// deshace, las flechas mueven el foco entre salas.
import { expect, test } from '@playwright/test';

test('atajos de teclado: hora, sospechoso y deshacer', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Empezar' }).first().click();
  await expect(page.locator('.game')).toBeVisible();

  // [ y ] cambian de hora (el botón activo cambia de "aria-pressed").
  const timeButtons = page.locator('.times button');
  await expect(timeButtons.nth(0)).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press(']');
  await expect(timeButtons.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('[');
  await expect(timeButtons.nth(0)).toHaveAttribute('aria-pressed', 'true');

  // 1 elige al primer sospechoso del reparto (queda con aria-pressed=true).
  await page.keyboard.press('1');
  await expect(page.locator('.subtools .pal').first()).toHaveAttribute('aria-pressed', 'true');

  // Con el sospechoso elegido, marcar una sala con Enter y deshacer con z.
  const firstRoom = page.locator('.hit').first();
  await firstRoom.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.mk').first()).toBeVisible();
  await page.keyboard.press('z');
  await expect(page.locator('.mk')).toHaveCount(0);

  // Una flecha mueve el foco a otra sala (sigue habiendo una .hit enfocada).
  await firstRoom.focus();
  await page.keyboard.press('ArrowRight');
  const focused = await page.evaluate(() => document.activeElement?.classList.contains('hit'));
  expect(focused).toBe(true);
});
