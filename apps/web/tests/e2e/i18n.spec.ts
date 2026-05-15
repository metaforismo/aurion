// i18n smoke: switching from /it to /en flips both URL and visible strings.
//
// The language switcher renders one button per locale (`it`, `en` — lower-
// case glyphs). Pressing the inactive locale flips the URL and the visible
// home strings. The current locale's button is `aria-pressed="true"`.

import { expect, test } from '@playwright/test';

test.describe('i18n', () => {
  test('switches locale via the language switcher', async ({ page }) => {
    await page.goto('/it');

    // Italian baseline.
    await expect(page.getByRole('link', { name: 'Nuova partita' })).toBeVisible();

    // The switcher renders the locale codes lowercased ("it" / "en").
    await page.getByRole('button', { name: 'en', exact: true }).click();

    // URL should now start with /en.
    await page.waitForURL(/\/en(\/|$)/);

    await expect(page.getByRole('link', { name: 'New game' })).toBeVisible();
    // Italian variant should be gone.
    await expect(page.getByRole('link', { name: 'Nuova partita' })).toHaveCount(
      0,
    );
  });
});
