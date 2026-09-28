// Humo e2e del hito M7 (§12.5, §18): el caso en curso sobrevive a una recarga
// ("Seguir el caso") y un enlace #caso=<id> abre ese caso concreto.
import { expect, test } from '@playwright/test';

test('el caso en curso sobrevive a una recarga: "Seguir tu caso" retoma las marcas', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Empezar' }).first().click();
  await expect(page.locator('.game')).toBeVisible();

  const caseId = await page.locator('.game').getAttribute('data-case-id');
  expect(caseId).toBeTruthy();

  // Marca algo (primer sospechoso de las herramientas, primera sala del plano).
  await page.locator('.subtools .pal').first().click();
  await page.locator('.hit').first().click();
  await expect(page.locator('.mk').first()).toBeVisible();

  // Al guardado automático le da tiempo (300 ms de retardo).
  await page.waitForTimeout(600);
  await page.reload();

  await expect(page.locator('.resume')).toBeVisible();
  await page.locator('#resumeBtn').click();

  await expect(page.locator('.game')).toBeVisible();
  await expect(page.locator('.game')).toHaveAttribute('data-case-id', caseId ?? '');
  await expect(page.locator('.mk').first()).toBeVisible();
});

test('#caso=<id> abre directamente ese caso del banco', async ({ page, request }) => {
  const res = await request.get('cases/novato.json');
  const bank = (await res.json()) as { cases: { id: string }[] };
  const targetId = bank.cases[0].id;

  await page.goto(`./#caso=${targetId}`);
  await expect(page.locator('.game')).toBeVisible();
  await expect(page.locator('.game')).toHaveAttribute('data-case-id', targetId);
});
