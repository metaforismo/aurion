// Playwright configuration for Aurion's E2E smoke suite.
//
// Goals:
//   - One command to run everything: `pnpm --filter @aurion/web test:e2e`.
//   - Auto-start `pnpm dev` via `webServer` when the port is free; reuse a
//     running dev server in local development.
//   - Default to Chromium-only — fastest feedback. Other engines stay defined
//     but disabled via the `PWBROWSERS` env var so CI can opt-in.
//   - HTML reporter for CI artifacts; line reporter on stdout.

import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 3000);
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;
const isCI = !!process.env.CI;
// Comma-separated list of engines to enable. Defaults to chromium only.
const requestedBrowsers = (process.env.PWBROWSERS ?? 'chromium')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const allProjects = [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  },
  {
    name: 'firefox',
    use: { ...devices['Desktop Firefox'] },
  },
  {
    name: 'webkit',
    use: { ...devices['Desktop Safari'] },
  },
];

const projects = allProjects.filter((p) => requestedBrowsers.includes(p.name));

export default defineConfig({
  testDir: './tests/e2e',
  // Each test must be quick — the suite is a smoke pass, not load testing.
  timeout: 45_000,
  expect: {
    // Allow generous expect.poll budgets for tick-based assertions.
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: 1,
  reporter: isCI
    ? [['html', { open: 'never' }], ['line']]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 8_000,
    navigationTimeout: 20_000,
  },
  projects,
  webServer: {
    // Run from this package's directory. We wire pnpm via the workspace
    // filter so the right env (Next 16 + turbopack) is loaded.
    command: 'pnpm --filter @aurion/web dev',
    url: BASE_URL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
