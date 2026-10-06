// Modo Incendio completo (docs/MODOS.md 2.6, 2.7 y 2.8; fase F2): sala de edificios,
// fotos, pistas que arden, caso resuelto con medallas y récords, y capturas en cada
// tamaño del proyecto (390 × 844 y 1280 × 800, más el horizontal de móvil).
import { expect, test, type Page } from '@playwright/test';

interface FixtureFile {
  cases: { caseData: { id: string; culprit: number; weapon: number }; fire: { burnAt: number[] } }[];
}

async function fixtures(page: Page): Promise<FixtureFile> {
  return (await (await page.request.get('./cases/incendio.json')).json()) as FixtureFile;
}

async function openLobby(page: Page): Promise<void> {
  await page.clock.install();
  await page.goto('./#incendio');
  await expect(page.getByRole('heading', { name: 'Modo Incendio' })).toBeVisible();
}

async function enter(page: Page, index = 0): Promise<void> {
  await page.getByRole('button', { name: 'Entrar en el edificio' }).nth(index).click();
  await expect(page.locator('#fireClock')).toHaveText('5:00');
}

async function accuse(page: Page, culprit: number, weapon: number): Promise<void> {
  await page.locator('#accuseBtn').click();
  await page.locator(`.accuse-overlay [data-sus="${culprit}"]`).click();
  await page.locator(`.accuse-overlay [data-obj="${weapon}"]`).click();
  await page.locator('#accuseSubmit').click();
}

/** En móvil las pistas están en su pestaña; en escritorio se ven siempre. */
async function showClues(page: Page): Promise<void> {
  const tab = page.locator('.sheet-tabs button[data-tab="pistas"]');
  if (await tab.isVisible()) await tab.click();
}

test('la sala del incendio enseña reglas, filtro y una tarjeta por edificio con calor y mejor marca', async ({ page }, info) => {
  await openLobby(page);
  await expect(page.locator('.fire-rules li')).toHaveCount(5);
  await expect(page.locator('.fcard')).toHaveCount(2);
  await expect(page.locator('.fcard .fire-preview').first()).toBeVisible();
  await expect(page.locator('.fcard .best').first()).toHaveText('Todavía sin resolver.');

  await page.getByRole('button', { name: 'Inspector exprés', exact: true }).click();
  await expect(page.locator('.fcard:visible')).toHaveCount(1);
  await expect(page.locator('.fcard:visible h2')).toHaveText('Museo Aldana en llamas');
  await page.getByRole('button', { name: 'Todos', exact: true }).click();
  await expect(page.locator('.fcard:visible')).toHaveCount(2);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: info.outputPath(`incendio-sala-${info.project.name}.png`), fullPage: true });
});

test('fotos: una pista salvada no arde y la de una pista que ya arde se rechaza', async ({ page }) => {
  const data = await fixtures(page);
  const burnAt = data.cases[0].fire.burnAt;
  // Pista que arde antes (con sala) y otra que arde después, para salvarla.
  const early = burnAt.indexOf(Math.min(...burnAt));
  const keep = burnAt.findIndex((at, i) => i !== early && at > burnAt[early]);

  await openLobby(page);
  await enter(page);
  await showClues(page);
  await expect(page.locator('.fire-photos')).toHaveText('2 fotos para salvar pistas');

  await page.locator(`.clue-row[data-i="${keep}"] .fc-photo`).click();
  await expect(page.locator(`.clue-row[data-i="${keep}"] .fc-saved`)).toHaveText('A salvo');
  await expect(page.locator('.fire-photos')).toHaveText('1 foto para salvar una pista');

  // La pista temprana: mecha cuando le quedan 30 s, después ardiendo y la foto se rechaza.
  await page.clock.runFor((burnAt[early] - 20) * 1000);
  await expect(page.locator(`.clue-row[data-i="${early}"] .fc-fuse`)).toBeVisible();
  await page.clock.runFor(21_000);
  await expect(page.locator(`.clue-row[data-i="${early}"] .fc-burning`)).toBeVisible();
  await page.locator(`.clue-row[data-i="${early}"] .fc-photo`).click();
  await expect(page.locator('.toast')).toHaveText('Esa pista ya está ardiendo: no se puede salvar.');

  // Cuatro segundos después queda "Pista quemada" y su texto ya no está en el DOM.
  await page.clock.runFor(5_000);
  const burnt = page.locator(`.clue-row[data-i="${early}"]`);
  await expect(burnt).toHaveClass(/burnt/);
  await expect(burnt).toContainText('Pista quemada');
  await expect(burnt.locator('.clue-text')).toHaveCount(0);

  // La salvada sigue legible pase lo que pase.
  await page.clock.runFor(200_000);
  await expect(page.locator(`.clue-row[data-i="${keep}"] .clue-text`)).toBeVisible();
});

test('caso resuelto: medallas, tiempo sobrante, récord en hm2:fire y mejor marca en la sala', async ({ page }, info) => {
  const data = await fixtures(page);
  const { id, culprit, weapon } = data.cases[0].caseData;
  await openLobby(page);
  await enter(page);

  // Un rato dentro, con la línea de estado y el fuego ya en marcha (captura en partida).
  await page.clock.runFor(70_000);
  await expect(page.locator('#fireStatus')).toContainText('Arden:');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: info.outputPath(`incendio-partida-${info.project.name}.png`) });

  await accuse(page, culprit, weapon);
  await expect(page.getByRole('heading', { name: 'Resuelto entre las llamas' })).toBeVisible();
  await expect(page.locator('.fire-left')).toContainText('Te sobraron 3:50');
  await expect(page.locator('.medal.got')).toHaveCount(3);
  await expect(page.locator('.fire-stars')).toHaveText('+3 estrellas de rango.');
  await page.screenshot({ path: info.outputPath(`incendio-resuelto-${info.project.name}.png`), fullPage: true });

  const record = await page.evaluate((caseId) => JSON.parse(localStorage.getItem('hm2:fire') ?? '{}')[caseId], id);
  expect(record).toMatchObject({ bestLeft: 230, medals: ['sin-fotos', 'a-tiempo', 'sin-errores'], attempts: 1 });

  // Ver la noche abre la reconstrucción.
  await page.getByRole('button', { name: 'Ver la noche' }).click();
  await expect(page.locator('#reconMap')).toBeVisible();
  await page.keyboard.press('Escape');

  // De vuelta en la sala, la tarjeta enseña la mejor marca.
  await page.getByRole('button', { name: 'Volver al Modo Incendio' }).click();
  await expect(page.locator('.fcard .best').first()).toContainText('te sobraron 3:50');
});

test('derrumbe: Ver la solución enseña el veredicto y la noche', async ({ page }) => {
  await openLobby(page);
  await enter(page);
  await page.clock.runFor(301_000);
  const dialog = page.getByRole('alertdialog', { name: 'El edificio se ha derrumbado' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Ver la solución' }).click();
  await expect(dialog.locator('.fire-solution .closing')).toContainText('Llevaba');
  await dialog.getByRole('button', { name: 'Ver la noche en el plano' }).click();
  await expect(page.locator('#reconMap')).toBeVisible();
});
