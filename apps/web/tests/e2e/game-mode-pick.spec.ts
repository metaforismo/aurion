// Phase 3 spec §1420 — `game-mode-pick.spec.ts`:
//   wizard → step 5 → seleziona Eternal → conferma → state.gameMode === 'eternal'
//
// The existing phase3 suite (`phase3.spec.ts`) verifies HUD visibility for the
// VictoryCounter chip when Eternal is selected. This spec layers two more
// signals on top:
//   1) the game-mode picker (step 5) is actually reachable + selectable;
//   2) `state.gameMode === 'eternal'` is persisted in the running engine
//      state — surfaced via the `window.__aurion` test hook so the assertion
//      is unambiguous and does not depend on UI rendering quirks.

import { expect, test } from '@playwright/test';

import { dismissAllEventModals, startNewGame, waitForPlayReady } from './fixtures';
import { readStateField, waitForStore } from './helpers/phase3';

test.describe('Phase 3 — game mode picker', () => {
  test('step 5 lets the player pick Eternal and the engine records it', async ({
    page,
  }) => {
    // Drive the wizard the same way as the existing helpers: scenario,
    // country, victory, difficulty, then game mode. The fixture clicks the
    // localised card label ("Eterna" in IT) so we hit the actual user path.
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

  test('picking Classic does NOT mount the VictoryCounter chip', async ({
    page,
  }) => {
    // Negative case: same wizard, Classic mode, no chip.
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
