// Walks the 3-step new-game wizard end to end. We assert the URL transitions
// after the final "Inizia partita" press: a save id should appear in the path
// and the play screen should mount.

import { expect, test } from '@playwright/test';

import { startNewGame, waitForPlayReady } from './fixtures';

test.describe('new game wizard', () => {
  test('walks scenario → country → victory and lands on the play page', async ({
    page,
  }) => {
    const saveId = await startNewGame(page, {
      locale: 'it',
      scenarioId: 'ascesa-aurion',
      countryId: 'aurion',
      victoryId: 'economic',
    });

    expect(saveId.length).toBeGreaterThan(0);
    await waitForPlayReady(page, 'it');
  });

  test('shows step-of indicator on each step', async ({ page }) => {
    await page.goto('/it/new');

    // Step 1: scenario
    await expect(page.getByText('Passo 1 di 3')).toBeVisible();
    await page.getByRole('button', { name: 'ascesa-aurion', exact: true }).click();
    await page
      .getByRole('button', { name: 'Avanti', exact: true })
      .first()
      .click();

    // Step 2: country
    await expect(page.getByText('Passo 2 di 3')).toBeVisible();
    // Click first playable country (Aurion). The accessible name is
    // "country.aurion.name aurion" — we match by the id substring.
    await page
      .getByRole('button', { name: /\baurion\b/ })
      .first()
      .click();
    await page
      .getByRole('button', { name: 'Avanti', exact: true })
      .first()
      .click();

    // Step 3: victory
    await expect(page.getByText('Passo 3 di 3')).toBeVisible();
  });
});
