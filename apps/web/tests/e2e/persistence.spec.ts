// Persistence smoke: save → reload → continue, plus the export-JSON download
// flow. These tests rely on the in-app menu UI and on the browser-driven
// download API.

import { expect, test } from '@playwright/test';

import {
  clickSpeed,
  dismissAllEventModals,
  readTick,
  startNewGame,
  waitForPlayReady,
} from './fixtures';

test.describe.configure({ mode: 'serial' });

test.describe('persistence', () => {
  test('save then reload then continue restores tick', async ({ page }) => {
    const saveId = await startNewGame(page, { locale: 'it' });
    await waitForPlayReady(page, 'it');
    await dismissAllEventModals(page);

    // Run for a few ticks at 4× so we have a non-zero tick to compare against.
    await clickSpeed(page, 4, 'it');
    await expect
      .poll(
        async () => {
          await dismissAllEventModals(page, { timeoutMs: 500 });
          return readTick(page);
        },
        { timeout: 12_000, intervals: [250, 500, 1000] },
      )
      .toBeGreaterThanOrEqual(3);

    // Pause, drain any remaining modals, then save via the HUD menu.
    await clickSpeed(page, 0, 'it');
    await dismissAllEventModals(page);
    const savedTick = await readTick(page);

    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Salva partita' }).click();

    // Reload — should hydrate from IndexedDB without losing state.
    await page.reload();
    await waitForPlayReady(page, 'it');

    const reloadedTick = await readTick(page);
    // Allow ±2 tick tolerance to absorb autosave races.
    expect(Math.abs(reloadedTick - savedTick)).toBeLessThanOrEqual(2);
    expect(page.url()).toContain(`/play/${saveId}`);
  });

  test('export JSON downloads a valid save file', async ({ page }) => {
    await startNewGame(page, { locale: 'it' });
    await waitForPlayReady(page, 'it');
    await dismissAllEventModals(page);

    await page.getByRole('button', { name: 'Menu' }).click();

    const downloadPromise = page.waitForEvent('download', { timeout: 10_000 });
    await page.getByRole('menuitem', { name: 'Esporta JSON' }).click();
    const download = await downloadPromise;

    const path = await download.path();
    expect(path).not.toBeNull();

    const fs = await import('node:fs/promises');
    const text = await fs.readFile(path!, 'utf8');
    const json = JSON.parse(text) as Record<string, unknown>;

    expect(typeof json['engineVersion']).toBe('string');
    expect(json['scenarioId']).toBe('ascesa-aurion');
    expect(json['state']).toBeTruthy();
  });
});
