// Walks the 5-step new-game wizard end to end. We assert the URL transitions
// after the final "Avvia partita" press: a save id should appear in the path
// and the play screen should mount. The wizard now covers:
//   1) scenario   2) country   3) victory   4) difficulty   5) game mode

import { expect, test } from '@playwright/test';

import { dismissTutorial, startNewGame, waitForPlayReady } from './fixtures';

test.describe('new game wizard', () => {
  test('walks scenario → country → victory → difficulty → mode and lands on the play page', async ({
    page,
  }) => {
    const saveId = await startNewGame(page, {
      locale: 'it',
      scenarioId: 'ascesa-aurion',
      countryId: 'aurion',
      victoryId: 'economic',
      difficultyId: 'normal',
      gameMode: 'classic',
    });

    expect(saveId.length).toBeGreaterThan(0);
    await waitForPlayReady(page, 'it');
  });

  test('shows step-of indicator on each step', async ({ page }) => {
    await dismissTutorial(page);
    await page.goto('/it/new');

    // Step 1: scenario
    await expect(page.getByText('Passo 1 di 5')).toBeVisible();
    // Card now uses the localised display name; click "Ascesa di Aurion".
    await page
      .getByRole('button', { name: /^Ascesa di Aurion\b/ })
      .first()
      .click();
    await page
      .getByRole('button', { name: 'Avanti', exact: true })
      .first()
      .click();

    // Step 2: country. The country button name embeds the raw id (the
    // localised name plus the id as a trailing tag — we match by id).
    await expect(page.getByText('Passo 2 di 5')).toBeVisible();
    await page
      .getByRole('button', { name: /\baurion\b/ })
      .first()
      .click();
    await page
      .getByRole('button', { name: 'Avanti', exact: true })
      .first()
      .click();

    // Step 3: victory
    await expect(page.getByText('Passo 3 di 5')).toBeVisible();
    await page
      .getByRole('button', { name: /Vittoria economica/i })
      .first()
      .click();
    await page
      .getByRole('button', { name: 'Avanti', exact: true })
      .first()
      .click();

    // Step 4: difficulty
    await expect(page.getByText('Passo 4 di 5')).toBeVisible();
    await page
      .getByRole('button', { name: /^Normale\b/ })
      .first()
      .click();
    await page
      .getByRole('button', { name: 'Avanti', exact: true })
      .first()
      .click();

    // Step 5: game mode
    await expect(page.getByText('Passo 5 di 5')).toBeVisible();
    await expect(page.getByRole('button', { name: /Classica/ })).toBeVisible();
  });
});
