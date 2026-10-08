// Revisión de móvil de F7 (docs/MODOS.md 2.10.4 y 3.9): lo que se corrigió al recorrer
// ambos modos queda fijado aquí. Se ejecuta en los cuatro tamaños y en tema claro y
// oscuro (playwright.config.ts).
import { expect, test, type Page } from '@playwright/test';

/** Botones, enlaces y resúmenes visibles de `scope` que miden menos de 44 × 44 px. */
async function smallTargets(page: Page, scope: string): Promise<string[]> {
  return page.evaluate((sel) => {
    const out: string[] = [];
    for (const root of Array.from(document.querySelectorAll(sel))) {
      for (const el of Array.from(root.querySelectorAll<HTMLElement>('button, a[href], summary, [role="button"]'))) {
        if (el.closest('svg') || el.closest('.sr-only') || el.closest('[hidden]')) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === 'hidden') continue;
        if (r.width < 44 || r.height < 44) out.push(`${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
      }
    }
    return out;
  }, scope);
}

async function noHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

async function enterBuilding(page: Page): Promise<void> {
  await page.clock.install();
  await page.goto('./#incendio');
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'fuego');
  await noHorizontalScroll(page);
  expect(await smallTargets(page, '.fire-lobby')).toEqual([]);
  await page.getByRole('button', { name: 'Entrar en el edificio' }).first().click();
  await expect(page.locator('#fireClock')).toHaveText('5:00');
}

test('incendio: el plano, las horas y la línea de estado se ven a la vez (MODOS 2.10.4)', async ({ page }) => {
  await enterBuilding(page);
  await page.clock.runFor(50_000);
  await expect(page.locator('#mapSvg')).toBeInViewport();
  await expect(page.locator('#times')).toBeInViewport();
  await expect(page.locator('#fireStatus')).toBeInViewport();
  await expect(page.locator('#fireClock')).toBeInViewport();
  // Las estrellas del tablero no se usan en el incendio.
  await expect(page.locator('#starsDisplay')).toBeHidden();
  await noHorizontalScroll(page);
  expect(await smallTargets(page, '.gbar, .times, .tools, .sheet-tabs, .actionbar')).toEqual([]);
});

test('incendio: siempre con su paleta, también con el tema oscuro del sistema', async ({ page }) => {
  await enterBuilding(page);
  const bg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--paper').trim());
  expect(bg).toBe('#160e0b');
});

test('incendio: tras el derrumbe, la tarjeta con la solución se puede recorrer entera', async ({ page }) => {
  await enterBuilding(page);
  await page.clock.runFor(301_000);
  await expect(page.getByRole('alertdialog', { name: 'El edificio se ha derrumbado' })).toBeVisible();
  expect(await smallTargets(page, '.fire-collapse')).toEqual([]);
  await page.getByRole('button', { name: 'Ver la solución' }).click();
  const restart = page.getByRole('button', { name: 'Volver a entrar' });
  await restart.scrollIntoViewIfNeeded();
  await expect(restart).toBeInViewport();
});

test('incendio: la hoja de acusación es un diálogo con foco, Escape la cierra y el foco vuelve', async ({ page }) => {
  await enterBuilding(page);
  await page.locator('#accuseBtn').click();
  await expect(page.getByRole('dialog', { name: 'Acusación' })).toBeVisible();
  await expect(page.locator('.accuse-overlay [data-sus]').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('.accuse-overlay')).toHaveCount(0);
  await expect(page.locator('#accuseBtn')).toBeFocused();
});

test('calentamiento: salas de 44 px, "Comprobar" al alcance del pulgar y sin scroll horizontal', async ({ page }) => {
  await page.goto('./#academia');
  await noHorizontalScroll(page);
  expect(await smallTargets(page, '.gym')).toEqual([]);
  await page.getByRole('button', { name: 'Empezar el calentamiento' }).click();
  await page.locator('#gGo').click();

  const rooms = await page.locator('#gPlan [data-room]').evaluateAll((els) => els.map((el) => el.getBoundingClientRect()).map((r) => Math.min(r.width, r.height)));
  expect(Math.min(...rooms)).toBeGreaterThanOrEqual(44);

  await page.getByRole('button', { name: 'Salón', exact: true }).click();
  await expect(page.locator('#gCheck')).toBeInViewport();
  await page.locator('#gCheck').click();
  await expect(page.locator('#gNext')).toBeInViewport();
  await noHorizontalScroll(page);
  expect(await smallTargets(page, '.gym')).toEqual([]);
  // El número de ejercicio va primero: si la etiqueta no cabe, se corta el nombre del bloque.
  await expect(page.locator('.gym-prog span')).toHaveText(/^Ejercicio 1 de \d+ · /);
});
