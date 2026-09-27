// Humo e2e del hito M4 (§17.3): un caso real del banco se juega sin scroll
// horizontal del body y con objetivos táctiles de 44 px, en los 3 tamaños de
// playwright.config.ts (móvil vertical, móvil horizontal, escritorio).
import { expect, test } from '@playwright/test';

test('juega un caso Novato del banco: mesa de trabajo sin scroll horizontal ni objetivos táctiles pequeños', async ({ page }) => {
  // './' y no '/': con baseURL = '.../hora-muerta/', un '/' a secas resolvería
  // contra la raíz del origen y perdería el base path (resolución de URL WHATWG).
  await page.goto('./');
  await page.getByRole('button', { name: 'Empezar' }).first().click();

  const game = page.locator('.game');
  await expect(game).toBeVisible();
  await expect(page.locator('.plan svg.map')).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  const targets = await page.locator('.seg button, .times button, .actionbar .btn, .icon-btn').all();
  for (const target of targets) {
    const box = await target.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  }

  await page.locator('.seg button[data-mode="chalk"]').click();
  await expect(page.locator('.sw').first()).toBeVisible();

  await page.locator('.seg button[data-mode="mark"]').click();
  await page.locator('.hit').first().click();
  await expect(page.locator('.mk').first()).toBeVisible();
});
