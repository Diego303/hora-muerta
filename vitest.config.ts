import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/engine/**/*.test.ts', 'tests/bank/**/*.test.ts', 'tests/game/**/*.test.ts', 'tests/core/**/*.test.ts', 'tests/ui/**/*.test.ts', 'tests/fire/**/*.test.ts', 'tests/gym/**/*.test.ts'],
  },
});
