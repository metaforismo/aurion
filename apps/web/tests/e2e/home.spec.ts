// Smoke check that the home page renders correctly in both locales. We assert
// title, the new-game CTA and the Continue heading. The save list itself is
// not asserted because its contents depend on whatever the user has stored
// locally — but the section heading must appear.

import { expect, test } from '@playwright/test';

test.describe('home page', () => {
  test('renders Italian home', async ({ page }) => {
    await page.goto('/it');

    await expect(page).toHaveTitle(/Aurion/);

    // Title heading.
    const headings = page.getByRole('heading', { name: 'Aurion' });
    await expect(headings.first()).toBeVisible();

    // New game CTA — rendered as a link, not a button.
    const newGame = page.getByRole('link', { name: 'Nuova partita' });
    await expect(newGame).toBeVisible();

    // Continue section heading.
    await expect(
      page.getByRole('heading', { name: /Continua/i }),
    ).toBeVisible();
  });

  test('renders English home', async ({ page }) => {
    await page.goto('/en');

    await expect(page).toHaveTitle(/Aurion/);

    const headings = page.getByRole('heading', { name: 'Aurion' });
    await expect(headings.first()).toBeVisible();

    const newGame = page.getByRole('link', { name: 'New game' });
    await expect(newGame).toBeVisible();

    await expect(
      page.getByRole('heading', { name: /Continue/i }),
    ).toBeVisible();
  });
});
