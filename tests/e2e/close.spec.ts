// Humo e2e del hito M5 (§14.3-14.4): resuelve un caso real del banco usando la
// solución (culpable y arma) leída directamente del JSON, sin adivinar nada,
// y comprueba que el cierre muestra 3 estrellas y la frase de cierre.
import { expect, test } from '@playwright/test';

interface BankCase {
  id: string;
  culprit: number;
  weapon: number;
}
interface BankFile {
  cases: BankCase[];
}

test('resuelve un caso Novato del banco con la solución del JSON: cierre con 3 estrellas', async ({ page, request }) => {
  // './' y no '/': con baseURL = '.../hora-muerta/', un '/' a secas resolvería
  // contra la raíz del origen y perdería el base path (resolución de URL WHATWG).
  await page.goto('./');
  await page.getByRole('button', { name: 'Empezar' }).first().click();
  await expect(page.locator('.game')).toBeVisible();

  const caseId = await page.locator('.game').getAttribute('data-case-id');
  expect(caseId).toBeTruthy();

  const res = await request.get('cases/novato.json');
  const bank = (await res.json()) as BankFile;
  const caseData = bank.cases.find((c) => c.id === caseId);
  expect(caseData).toBeTruthy();
  if (!caseData) return;

  await page.locator('#accuseBtn').click();
  await page.locator(`[data-sus="${caseData.culprit}"]`).click();
  await page.locator(`[data-obj="${caseData.weapon}"]`).click();
  await page.locator('#accuseSubmit').click();

  await expect(page.locator('.closure-sheet h1')).toHaveText('Caso resuelto');
  await expect(page.locator('.closure-sheet .stars')).toHaveText('★★★');
  await expect(page.locator('.closure-sheet .closing')).toContainText('Motivo:');

  await page.locator('.closure-sheet .chain summary').click();
  await expect(page.locator('.closure-sheet .chain li').first()).toBeVisible();
});

test('dos acusaciones erróneas archivan el caso sin estrellas', async ({ page, request }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Empezar' }).first().click();
  await expect(page.locator('.game')).toBeVisible();

  const caseId = await page.locator('.game').getAttribute('data-case-id');
  const res = await request.get('cases/novato.json');
  const bank = (await res.json()) as BankFile;
  const caseData = bank.cases.find((c) => c.id === caseId);
  expect(caseData).toBeTruthy();
  if (!caseData) return;
  const wrongCulprit = (caseData.culprit + 1) % 4;

  for (let i = 0; i < 2; i++) {
    await page.locator('#accuseBtn').click();
    await page.locator(`[data-sus="${wrongCulprit}"]`).click();
    await page.locator(`[data-obj="${caseData.weapon}"]`).click();
    await page.locator('#accuseSubmit').click();
  }

  await expect(page.locator('.closure-sheet h1')).toHaveText('Caso archivado sin resolver');
  await expect(page.locator('.closure-sheet .stars')).toHaveCount(0);
});
