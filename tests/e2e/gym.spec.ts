// Modo Calentamiento, núcleo (docs/MODOS.md 3.3, 3.4, 3.5, 3.9 y 3.11; fase F4). Se
// ejecuta en los tres tamaños del proyecto (móvil vertical, horizontal y escritorio).
import { expect, test, type Page } from '@playwright/test';

/** Contesta el ejercicio que haya en pantalla con la primera opción posible. */
async function answerAnything(page: Page): Promise<void> {
  const options = page.locator('#gAns [data-v]');
  if ((await options.count()) > 0) {
    await options.first().click();
    return;
  }
  const clues = page.locator('#gPick button:not([disabled])');
  if ((await clues.count()) > 0) {
    await clues.first().click();
  } else {
    await page.locator('#gPlan [data-room]').first().click();
  }
  await expect(page.locator('#gCheck')).toBeEnabled();
  await page.locator('#gCheck').click();
}

async function openAcademy(page: Page): Promise<void> {
  await page.goto('./');
  await page.getByRole('button', { name: 'Calentamiento' }).click();
  await expect(page.getByRole('heading', { name: 'Prácticas en la Academia' })).toBeVisible();
  await expect(page).toHaveURL(/#academia$/);
}

test('sesión completa: 3 bloques, 13 ejercicios con corrección, informe y "Ir a jugar un caso"', async ({ page }) => {
  await openAcademy(page);
  await expect(page.getByText('Academia de Policía de Valdeniebla')).toBeVisible();
  await expect(page.locator('.gym-ficha li')).toHaveCount(4);
  await page.getByRole('button', { name: 'Empezar el calentamiento' }).click();

  for (let i = 0; i < 13; i++) {
    // Pantalla breve antes de cada bloque.
    const inter = page.locator('#gGo');
    if (await inter.isVisible()) {
      await expect(page.locator('.gym-inter .gk')).toContainText('Bloque');
      await inter.click();
    }
    await expect(page.locator('.gym-prog span')).toContainText(`Ejercicio ${i + 1} de 13`);

    if (i === 0) {
      // Primer ejercicio (Bruno en la Cocina a las 21:00): se responde bien tocando salas,
      // una de ellas con el teclado.
      await page.getByRole('button', { name: 'Salón', exact: true }).click();
      await page.getByRole('button', { name: 'Cocina', exact: true }).focus();
      await page.keyboard.press('Enter');
      await page.getByRole('button', { name: 'Invernadero', exact: true }).click();
      await page.locator('#gCheck').click();
      await expect(page.locator('#gFb .res')).toHaveText('✓ Correcto');
    } else {
      await answerAnything(page);
      await expect(page.locator('#gFb .res')).toHaveText(/^(✓ Correcto|✗ No del todo)$/);
    }
    await expect(page.locator('#gFb .explain')).not.toBeEmpty();
    // Tras corregir, "Siguiente" recibe el foco.
    await expect(page.locator('#gNext')).toBeFocused();
    await page.locator('#gNext').click();
  }

  await expect(page.locator('.gym-end .score')).toHaveText(/^\d+ de 13$/);
  await expect(page.locator('.gym-end .g-rows').first().locator('li')).toHaveCount(3);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('hm2:gym') ?? '{}'));
  expect(stored.sessions).toHaveLength(1);
  expect(stored.tech.alcance.n).toBeGreaterThan(0);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  await page.getByRole('button', { name: 'Ir a jugar un caso' }).click();
  await expect(page.locator('#goDaily')).toBeVisible();
  await expect(page.locator('.pf-sheet')).toHaveClass(/open/);
  await expect(page.locator('#plano-casos')).toBeInViewport();
});

test('un fallo explica el error concreto y marca el plano', async ({ page }) => {
  await openAcademy(page);
  await page.getByRole('button', { name: 'Empezar el calentamiento' }).click();
  await page.locator('#gGo').click();
  // Primer ejercicio: falta la Cocina, donde estaba Bruno (regla "quedarse").
  await page.getByRole('button', { name: 'Salón', exact: true }).click();
  await page.getByRole('button', { name: 'Invernadero', exact: true }).click();
  await page.locator('#gCheck').click();
  await expect(page.locator('#gFb .res')).toHaveText('✗ No del todo');
  await expect(page.locator('#gFb .hint')).toHaveText('En una hora también puede quedarse donde estaba: la Cocina también vale.');
  await expect(page.locator('#gPlan .pl-miss')).toHaveCount(1);
});

test('salir a mitad vuelve a la Academia y lo respondido cuenta en la ficha', async ({ page }) => {
  await openAcademy(page);
  await page.getByRole('button', { name: 'Empezar el calentamiento' }).click();
  await page.locator('#gGo').click();
  await answerAnything(page);
  await page.locator('#gNext').click();
  await page.getByRole('button', { name: '← Salir' }).click();
  await expect(page.getByRole('heading', { name: 'Prácticas en la Academia' })).toBeVisible();
  await expect(page.locator('.gym-ficha')).toContainText('de 1 bien');
});

test('el enlace #academia abre la Academia directamente', async ({ page }) => {
  await page.goto('./#academia');
  await expect(page.getByRole('heading', { name: 'Prácticas en la Academia' })).toBeVisible();
});
