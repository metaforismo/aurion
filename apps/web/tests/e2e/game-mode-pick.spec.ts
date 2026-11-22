// Game mode pick: the new-game flow starts with the mode ("what do I want
// to do?"). Picking Odissea (engine id `eternal`) must end up in the running
// game as `state.gameMode === 'eternal'`; picking Campagna as `classic`.
//
// Two signals per case:
//   1) the HUD: the victory counter chip only exists in the open-ended mode;
//   2) the engine state, read through the `window.__aurion` test hook so the
//      assertion does not depend on how the HUD formats anything.

import { expect, test } from '@playwright/test';

import { dismissAllEventModals, startNewGame, waitForPlayReady } from './fixtures';
import { readStateField, waitForStore } from './helpers/phase3';

test.describe('game mode picker', () => {
  test('picking Odissea in step 1 records gameMode eternal', async ({
    page,
  }) => {
    // The fixture walks the real flow: mode card first, then world, nation
    // and difficulty (Odissea has no victory step).
    const saveId = await startNewGame(page, {
      locale: 'it',
      scenarioId: 'mondo-contemporaneo',
      countryId: 'mc-italy',
      victoryId: 'economic',
      difficultyId: 'normal',
      gameMode: 'eternal',
    });
    await waitForPlayReady(page, 'it');
    await dismissAllEventModals(page);

    // URL contains the new save id — confirms the wizard committed.
    expect(page.url()).toContain(`/play/${saveId}`);

    // HUD: VictoryCounter chip renders the "N/M vittorie" badge only when
    // gameMode === 'eternal' (per VictoryCounter.tsx line 72).
    const header = page.locator('header').first();
    await expect(header.getByText(/vittorie/i)).toBeVisible();

    // Engine state: confirm via the test-only window hook so the assertion
    // is independent of any HUD text formatting.
    await waitForStore(page);
    const gameMode = await readStateField<string>(page, 'gameMode');
    expect(gameMode).toBe('eternal');
  });

  test('picking Campagna records gameMode classic and shows no victory counter', async ({
    page,
  }) => {
    // Negative case: same flow in Campaign mode, no chip.
    await startNewGame(page, {
      locale: 'it',
      scenarioId: 'mondo-contemporaneo',
      countryId: 'mc-italy',
      victoryId: 'economic',
      difficultyId: 'normal',
      gameMode: 'classic',
    });
    await waitForPlayReady(page, 'it');
    await dismissAllEventModals(page);

    const header = page.locator('header').first();
    await expect(header.getByText(/vittorie/i)).toHaveCount(0);

    await waitForStore(page);
    const gameMode = await readStateField<string>(page, 'gameMode');
    expect(gameMode).toBe('classic');
  });
});
