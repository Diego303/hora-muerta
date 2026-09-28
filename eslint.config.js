// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    // Los .astro no se lintan aquí (harían falta astro-eslint-parser/eslint-plugin-astro):
    // su corrección la cubre "astro check" en el script typecheck.
    ignores: ['dist/**', '.astro/**', 'node_modules/**', 'public/cases/**', 'reports/**', '**/*.astro'],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  {
    // TypeScript ya detecta los identificadores no definidos (con más precisión que
    // ESLint, que no conoce los tipos globales de cada tsconfig); se desactiva aquí
    // siguiendo la recomendación de typescript-eslint.
    rules: {
      'no-undef': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
    },
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ['src/workers/**/*.ts'],
    languageOptions: { globals: { ...globals.worker } },
  },
  {
    files: ['scripts/**/*.ts', 'tests/**/*.ts', '*.config.ts', '*.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
);
