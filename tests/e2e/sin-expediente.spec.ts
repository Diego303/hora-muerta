// El modo Expediente se eliminó (docs/DECISIONES.md, "Expediente eliminado"): no
// aparece en ninguna pantalla y lo que guardaba en el navegador se limpia al entrar.
import { expect, test } from '@playwright/test';

test('quien jugó un expediente no ve rastro de él: portada, ayuda, perfil y almacenamiento', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('sembrado')) return;
    sessionStorage.setItem('sembrado', '1');
    localStorage.setItem('hm2:series', JSON.stringify({ id: 'E-01', index: 1, errorsLeft: 2 }));
    localStorage.setItem('hm2:game', JSON.stringify({ caseId: 'E-01-2', mode: 'expediente' }));
    localStorage.setItem('hm2:played', JSON.stringify({ 'expediente:2026.09-a': ['E-01'] }));
    localStorage.setItem('hm2:profile', JSON.stringify({ stars: 4, series: 2 }));
  });
  await page.goto('./');
  await expect(page.locator('#goDaily')).toBeVisible();

  await expect(page.getByRole('button', { name: 'Expediente' })).toHaveCount(0);
  await expect(page.locator('#resume')).toBeHidden();
  // Las estrellas ganadas se conservan.
  await expect(page.locator('#goProfile2')).toContainText('4 ★');
  const stored = await page.evaluate(() => ({
    series: localStorage.getItem('hm2:series'),
    game: localStorage.getItem('hm2:game'),
    played: localStorage.getItem('hm2:played'),
  }));
  expect(stored).toEqual({ series: null, game: 'null', played: '{}' });

  await page.locator('#goHelp').click();
  await expect(page.locator('body')).not.toContainText('Expediente');

  await page.goto('./');
  await page.locator('#goProfile').click();
  await expect(page.locator('body')).not.toContainText('Expedientes');
});
