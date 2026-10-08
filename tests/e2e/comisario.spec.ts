// Comisario (5 casos publicados): un jugador nuevo puede empezar uno, y al acabar los de
// sus escenarios la pantalla de agotado le dice cuántos quedan en escenarios bloqueados.
import { expect, test } from '@playwright/test';

interface BankCase {
  id: string;
  map: string;
}

const START_MAPS = ['mansion', 'tren', 'museo'];

test('Comisario: un jugador nuevo empieza un caso de un escenario abierto', async ({ page, request }) => {
  const bank = (await (await request.get('cases/comisario.json')).json()) as { cases: BankCase[] };
  await page.goto('./');
  await page.locator('button[data-lv="2"]').click();
  await expect(page.locator('.game')).toBeVisible();
  const id = (await page.locator('.game').getAttribute('data-case-id')) ?? '';
  expect(id).toMatch(/^C-\d{3}$/);
  expect(START_MAPS).toContain(bank.cases.find((c) => c.id === id)?.map);
});

test('Comisario: con los de sus escenarios jugados, dice cuántos quedan bloqueados', async ({ page, request }) => {
  const bank = (await (await request.get('cases/comisario.json')).json()) as { version: string; cases: BankCase[] };
  const open = bank.cases.filter((c) => START_MAPS.includes(c.map)).map((c) => c.id);
  const locked = bank.cases.length - open.length;
  await page.addInitScript(
    ([version, ids]) => localStorage.setItem('hm2:played', JSON.stringify({ [version]: ids })),
    [bank.version, open] as const,
  );
  await page.goto('./');
  await page.locator('button[data-lv="2"]').click();
  await expect(page.locator('.exhausted h1')).toHaveText('Has resuelto los casos de Comisario de tus escenarios.');
  await expect(page.locator('.exhausted p')).toContainText(`Hay ${locked} más en escenarios que aún no has desbloqueado`);
  await expect(page.getByRole('button', { name: 'Volver a empezar' })).toBeVisible();
});
