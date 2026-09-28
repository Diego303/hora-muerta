// PWA (§19.1): el manifest y los iconos están enlazados y se sirven de
// verdad. El registro del service worker se salta a propósito en
// `pnpm dev` (main.ts, import.meta.env.PROD): probarlo de verdad hace
// falta contra una build de producción, no contra este servidor de dev.
import { expect, test } from '@playwright/test';

test('el manifest y los iconos están enlazados y responden', async ({ page, baseURL }) => {
  await page.goto('./');

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  if (!manifestHref) throw new Error('Falta <link rel="manifest"> en el <head>.');
  const manifestRes = await page.request.get(new URL(manifestHref, baseURL).toString());
  expect(manifestRes.ok()).toBe(true);
  const manifest = await manifestRes.json();
  expect(manifest.icons.length).toBeGreaterThan(0);

  const appleIconHref = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  if (!appleIconHref) throw new Error('Falta <link rel="apple-touch-icon"> en el <head>.');
  const iconRes = await page.request.get(new URL(appleIconHref, baseURL).toString());
  expect(iconRes.ok()).toBe(true);
});
