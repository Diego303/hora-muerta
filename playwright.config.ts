import { defineConfig, devices } from '@playwright/test';

const PORT = 4321;
const SIZES: [string, number, number, boolean][] = [
  ['mobile-small', 360, 640, false],
  ['mobile-portrait', 390, 844, false],
  ['mobile-landscape', 844, 390, false],
  ['desktop', 1280, 800, true],
];
const BASE_URL = `http://localhost:${PORT}/hora-muerta/`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: 'html',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm run dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
  },
  // Los cuatro tamaños de MODOS (F7) en tema claro, para todas las pruebas; y en tema
  // oscuro solo las de los modos nuevos (el incendio usa siempre su paleta).
  projects: [
    ...SIZES.map(([name, width, height, desktop]) => ({
      name,
      use: { ...(desktop ? devices['Desktop Chrome'] : devices['Pixel 7']), viewport: { width, height }, colorScheme: 'light' as const },
    })),
    ...SIZES.map(([name, width, height, desktop]) => ({
      name: `${name}-oscuro`,
      testMatch: /(fire|fire-complete|gym|modes-layout)\.spec\.ts$/,
      use: { ...(desktop ? devices['Desktop Chrome'] : devices['Pixel 7']), viewport: { width, height }, colorScheme: 'dark' as const },
    })),
  ],
});
