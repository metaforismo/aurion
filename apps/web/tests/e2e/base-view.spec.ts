// The colony seen from the surface: a staged lunar colony, down to the 3D
// base view and back to orbit.

import { expect, test } from '@playwright/test';

import { dismissAllEventModals, startNewGame, waitForPlayReady } from './fixtures';
import { waitForStore } from './helpers/phase3';

test('a colony can be visited on the surface and left again', async ({ page }) => {
  test.slow(); // Two 3D scenes on a software renderer.
  await startNewGame(page, { locale: 'it', scenarioId: 'quick-start', countryId: 'verm-aurelia' });
  await waitForPlayReady(page, 'it');
  await dismissAllEventModals(page);
  await waitForStore(page);

  // Stage a settled Moon: a base, a city, people, and some land with structures.
  await page.evaluate(() => {
    type Root = { state: Record<string, unknown> & { playerCountryId: string; cosmos: Record<string, unknown> & { completed: string[] } } };
    const store = (window as unknown as { __aurion: { store: { getState: () => Root; setState: (p: unknown) => void } } }).__aurion.store;
    const s = store.getState().state;
    store.setState({
      state: {
        ...s,
        cosmos: {
          ...s.cosmos,
          completed: [...s.cosmos.completed, 'moon_base', 'moon_city'],
          colonies: { moon: { focus: 'balanced', focusChangedAtTick: 0, population: 20_000 } },
          sectors: { moon: { moon_e3: { owner: s.playerCountryId, structures: ['lab', 'mine'] } } },
        },
      },
    });
  });

  // Reaching a new world raises a milestone screen a moment later, and its
  // backdrop swallows clicks: acknowledge whatever is up, then try again.
  const moon = page.getByTestId('view-moon');
  await expect(async () => {
    await dismissAllEventModals(page, { timeoutMs: 1_500 });
    await moon.click({ timeout: 2_000 });
    await expect(moon).toHaveAttribute('aria-checked', 'true', { timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  const colony = page.getByTestId('colony-moon');
  await expect(colony).toBeVisible({ timeout: 20_000 });

  await page.getByTestId('colony-moon-visit').click();
  const base = page.getByTestId('base-moon');
  await expect(base).toBeVisible();
  // The caption counts what stands on the ground.
  const counts = page.getByTestId('base-counts');
  await expect(counts).toContainText('laboratorio');
  await expect(counts).toContainText('miniera');
  await expect(counts).toContainText('cupole');
  // The scene itself came up: a canvas with a drawing buffer.
  await expect
    .poll(async () => base.locator('canvas').evaluate((c) => (c as HTMLCanvasElement).width), { timeout: 30_000 })
    .toBeGreaterThan(0);

  // Single buildings must stand on their own plots, not all on the hub's:
  // the renderer once drew every one-off building at the same spot.
  const spots = await page.evaluate(() => {
    type Pickable = { kind: string; mesh: { position: { x: number; z: number }; isInstancedMesh?: boolean } };
    const base = (window as unknown as { __aurion: { base: { pickables: Pickable[] } } }).__aurion.base;
    return base.pickables
      .filter((p) => !p.mesh.isInstancedMesh)
      .map((p) => `${p.kind}:${Math.round(p.mesh.position.x)}:${Math.round(p.mesh.position.z)}`);
  });
  expect(spots.length).toBeGreaterThanOrEqual(4);
  expect(new Set(spots.map((s) => s.split(':').slice(1).join(':'))).size).toBe(spots.length);

  await page.getByTestId('base-leave').click();
  await expect(base).toBeHidden();
  await expect(colony).toBeVisible();
});
