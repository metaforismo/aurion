import { defineConfig } from 'vitest/config';

// Vitest config for @aurion/web. Mirrors the engine package pattern so the
// monorepo's `pnpm test` story stays consistent. Tests under `tests/e2e/**`
// are Playwright suites — explicitly excluded so vitest does not try to
// execute them. Tests live under `tests/**/*.test.ts(x)?` (excluding e2e).
//
// `environment: 'jsdom'` so persistence tests can import the Dexie-based
// module: it uses `typeof indexedDB`. We pair this with `fake-indexeddb/auto`
// inside the test files that actually exercise the DB.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['tests/e2e/**', 'node_modules/**', '.next/**'],
  },
});
