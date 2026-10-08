// Modo Incendio completo (docs/MODOS.md 2.6, 2.7 y 2.8; fase F2): sala de edificios,
// fotos, pistas que arden, caso resuelto con medallas y récords, y capturas en cada
// tamaño del proyecto (390 × 844 y 1280 × 800, más el horizontal de móvil).
import { expect, test, type Page } from '@playwright/test';

interface FireBankCase {
  caseData: { id: string; culprit: number; weapon: number };
  fire: { burnAt: number[]; level: string };
}

async function bankCase(page: Page, id: string): Promise<FireBankCase> {
  const data = (await (await page.request.get('./cases/incendio.json')).json()) as { cases: FireBankCase[] };
  const found = data.cases.find((c) => c.caseData.id === id);
  if (!found) throw new Error(`Edificio ${id} no está en el banco`);
  return found;
}

async function openLobby(page: Page): Promise<void> {
  await page.clock.install();
  await page.goto('./#incendio');
  await expect(page.getByRole('heading', { name: 'Modo Incendio' })).toBeVisible();
}

/** Entra en el edificio ofrecido en la posición dada y devuelve su id. */
async function enter(page: Page, index = 0): Promise<string> {
  const button = page.getByRole('button', { name: 'Entrar en el edificio' }).nth(index);
  const id = (await button.getAttribute('data-case-id')) ?? '';
  await button.click();
  await expect(page.locator('#fireClock')).toHaveText('5:00');
  return id;
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

test('la sala del incendio ofrece un edificio por nivel, con reglas, filtro, calor y progreso', async ({ page }, info) => {
  await openLobby(page);
  await expect(page.locator('.fire-rules li')).toHaveCount(5);
  await expect(page.locator('.fcard')).toHaveCount(2);
  await expect(page.locator('.fcard .fire-preview').first()).toBeVisible();
  await expect(page.locator('.fcard .best').first()).toHaveText('Todavía sin resolver.');
  await expect(page.locator('.fire-level-h').first()).toContainText('Resueltos: 0 de');

  await page.getByRole('button', { name: 'Inspector exprés', exact: true }).click();
  await expect(page.locator('.fcard:visible')).toHaveCount(1);
  await expect(page.locator('.fcard:visible .lv')).toHaveText('Inspector exprés');
  await expect(page.locator('.fcard:visible h4')).toHaveText(/ en llamas$/);
  await page.getByRole('button', { name: 'Todos', exact: true }).click();
  await expect(page.locator('.fcard:visible')).toHaveCount(2);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: info.outputPath(`incendio-sala-${info.project.name}.png`), fullPage: true });
});

test('fotos: una pista salvada no arde y la de una pista que ya arde se rechaza', async ({ page }) => {
  await openLobby(page);
  const { fire } = await bankCase(page, await enter(page));
  const burnAt = fire.burnAt;
  // Pista que arde antes (con sala) y otra que arde después, para salvarla.
  const early = burnAt.indexOf(Math.min(...burnAt));
  const keep = burnAt.findIndex((at, i) => i !== early && at > burnAt[early]);
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

test('caso resuelto: medallas, récord en hm2:fire, mejor marca y el siguiente edificio sin repetir', async ({ page }, info) => {
  await openLobby(page);
  const id = await enter(page);
  const { culprit, weapon } = (await bankCase(page, id)).caseData;

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

  // De vuelta en la sala: ese edificio ya no se ofrece (sin repetir); aparece en
  // "Edificios resueltos" con su mejor marca, y el nivel ofrece otro distinto.
  await page.getByRole('button', { name: 'Volver al Modo Incendio' }).click();
  const level = page.locator('.fire-level').first();
  await expect(level.locator('.fire-level-h')).toContainText('Resueltos: 1 de');
  const next = await level.locator('> .fcard [data-case-id]').getAttribute('data-case-id');
  expect(next).not.toBe(id);
  await level.locator('.fire-solved summary').click();
  const solvedCard = level.locator(`.fire-solved [data-case-id="${id}"]`);
  await expect(solvedCard).toBeVisible();
  await expect(level.locator('.fire-solved .best').first()).toContainText('te sobraron 3:50');
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
