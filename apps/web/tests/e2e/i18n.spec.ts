// i18n smoke: switching from /it to /en flips both URL and visible strings.

import { expect, test } from '@playwright/test';

test.describe('i18n', () => {
  test('switches locale via the language switcher', async ({ page }) => {
    await page.goto('/it');

    // Italian baseline.
    await expect(page.getByRole('link', { name: 'Nuova partita' })).toBeVisible();

    // Click EN switcher button. It's labelled simply "EN" in the header.
    await page.getByRole('button', { name: 'EN', exact: true }).click();

    // URL should now start with /en.
    await page.waitForURL(/\/en(\/|$)/);

    await expect(page.getByRole('link', { name: 'New game' })).toBeVisible();
    // Italian variant should be gone.
    await expect(page.getByRole('link', { name: 'Nuova partita' })).toHaveCount(
      0,
    );
  });
});
