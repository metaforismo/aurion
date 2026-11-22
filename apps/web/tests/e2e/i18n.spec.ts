// i18n smoke: switching from /it to /en flips both URL and visible strings.
//
// The language switch (top right on every menu page) renders one button per
// locale whose accessible name is the bare code ("it", "en"). The current
// locale's button is `aria-pressed="true"`.

import { expect, test } from '@playwright/test';

test.describe('i18n', () => {
  test('switches locale via the language switcher', async ({ page }) => {
    await page.goto('/it');

    // Italian baseline.
    await expect(page.getByRole('link', { name: 'Nuova partita' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'it', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await page.getByRole('button', { name: 'en', exact: true }).click();

    // URL should now start with /en.
    await page.waitForURL(/\/en(\/|$)/);

    await expect(page.getByRole('link', { name: 'New game' })).toBeVisible();
    // Italian variant should be gone.
    await expect(page.getByRole('link', { name: 'Nuova partita' })).toHaveCount(0);
  });

  test('the new-game flow and the codex are translated', async ({ page }) => {
    await page.goto('/en/new');
    await expect(page.getByText('Step 1 of 5')).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Odyssey' })).toBeVisible();

    await page.goto('/en/guida');
    await expect(page.getByRole('heading', { name: 'How to play', level: 1 })).toBeVisible();
  });
});
