// Humo e2e del hito M6 (§15): pedir una pista resta una estrella y muestra el
// empujón; pedirla de nuevo sin cambiar nada no vuelve a cobrar; "Explícamelo"
// da el texto completo del paso gratis.
import { expect, test } from '@playwright/test';

test('pista del inspector: cuesta una estrella, no cobra dos veces seguidas, y "Explícamelo" es gratis', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Empezar' }).first().click();
  await expect(page.locator('.game')).toBeVisible();

  const starsBefore = await page.locator('#starsDisplay').textContent();
  expect(starsBefore).toBe('★★★');

  await page.locator('#hintBtn').click();
  await expect(page.locator('#hintPanel')).toBeVisible();
  const pushText = await page.locator('#hintText').textContent();
  expect(pushText?.length ?? 0).toBeGreaterThan(0);

  const starsAfterFirst = await page.locator('#starsDisplay').textContent();
  expect(starsAfterFirst).toBe('★★☆');

  // Pedirla otra vez sin haber cambiado nada: mismo aviso, no cobra de nuevo.
  await page.locator('#hintBtn').click();
  const starsAfterSecond = await page.locator('#starsDisplay').textContent();
  expect(starsAfterSecond).toBe('★★☆');

  // "Explícamelo" (fase 2), si el botón está visible, es gratis y cambia el texto.
  const explainBtn = page.locator('#hintExplainBtn');
  if (await explainBtn.isVisible()) {
    await explainBtn.click();
    const explainedText = await page.locator('#hintText').textContent();
    expect(explainedText).not.toBe(pushText);
    const starsAfterExplain = await page.locator('#starsDisplay').textContent();
    expect(starsAfterExplain).toBe('★★☆');
    await expect(explainBtn).toBeHidden();
  }
});
