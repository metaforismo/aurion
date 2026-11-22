// Walks the new-game flow end to end:
//   mode → world → nation → victory (Campaign only) → difficulty → launch
// and checks the URL lands on /play/<saveId> with the play screen mounted.

import { expect, test } from '@playwright/test';

import { dismissTutorial, startNewGame, waitForPlayReady } from './fixtures';

test.describe('new game wizard', () => {
  test('walks mode → world → nation → victory → difficulty → launch and lands on the play page', async ({
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

  test('shows the step counter, and Campaign adds the victory step', async ({ page }) => {
    await dismissTutorial(page);
    await page.goto('/it/new');

    // The recommended mode (Odissea) has five steps.
    await expect(page.getByText('Passo 1 di 5')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Che partita vuoi giocare?' })).toBeVisible();
    await expect(page.getByTestId('game-mode-option-eternal')).toHaveAttribute(
      'aria-checked',
      'true',
    );

    // Campaign is the only mode with a victory step: six steps.
    await page.getByTestId('game-mode-option-classic').click();
    await expect(page.getByText('Passo 1 di 6')).toBeVisible();
    await page.getByTestId('wizard-next').click();

    await expect(page.getByText('Passo 2 di 6')).toBeVisible();
    await page.getByTestId('scenario-option-ascesa-aurion').click();
    await page.getByTestId('wizard-next').click();

    await expect(page.getByText('Passo 3 di 6')).toBeVisible();
    await page.getByTestId('country-option-aurion').click();
    await page.getByTestId('wizard-next').click();

    await expect(page.getByText('Passo 4 di 6')).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Vittoria economica' })).toBeVisible();
    await page.getByTestId('wizard-next').click();

    await expect(page.getByText('Passo 5 di 6')).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Normale' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.getByTestId('wizard-next').click();

    await expect(page.getByText('Passo 6 di 6')).toBeVisible();
    await expect(page.getByTestId('wizard-start')).toBeEnabled();
  });

  test('stepping back keeps earlier choices, and Start works from any step', async ({ page }) => {
    await dismissTutorial(page);
    await page.goto('/it/new');

    await page.getByTestId('game-mode-option-space-race').click();
    await page.getByTestId('wizard-next').click();
    await page.getByTestId('scenario-option-quick-start').click();
    await page.getByTestId('wizard-next').click();
    await page.getByTestId('country-option-verm-koros').click();

    // Back to the first step via the rail, then forward again.
    await page.getByTestId('wizard-step-mode').click();
    await expect(page.getByTestId('game-mode-option-space-race')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.getByTestId('wizard-step-nation').click();
    await expect(page.getByTestId('country-option-verm-koros')).toHaveAttribute(
      'aria-checked',
      'true',
    );

    // Start without visiting difficulty: the recommended preset applies.
    await page.getByTestId('wizard-start').click();
    await page.waitForURL(/\/it\/play\/[^/?#]+/, { timeout: 20_000 });
    await waitForPlayReady(page, 'it');
  });

  test('Chronicles is limited to worlds with eras, and says so', async ({ page }) => {
    await dismissTutorial(page);
    await page.goto('/it/new');

    await page.getByTestId('game-mode-option-era-paced').click();
    await page.getByTestId('wizard-next').click();

    // The plan moved to a world that has eras; worlds without them are
    // disabled with the reason spelled out.
    await expect(page.getByTestId('scenario-option-mondo-contemporaneo')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    const quickStart = page.getByTestId('scenario-option-quick-start');
    await expect(quickStart).toHaveAttribute('aria-disabled', 'true');
    await expect(quickStart).toContainText('Cronache si gioca solo nei mondi con ere storiche.');
  });
});
