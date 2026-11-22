// Smoke check that the title screen renders in both locales: the title, the
// main menu entries, and — on a fresh profile with no saves — the single
// obvious way in (Quick play as the primary action, no "Continue" card).

import { expect, test } from '@playwright/test';

test.describe('home page', () => {
  test('renders Italian home', async ({ page }) => {
    await page.goto('/it');

    await expect(page).toHaveTitle(/Aurion/);
    await expect(page.getByRole('heading', { name: 'Aurion', level: 1 })).toBeVisible();

    const menu = page.getByRole('navigation', { name: 'Menu principale' });
    await expect(menu.getByRole('link', { name: 'Nuova partita' })).toBeVisible();
    await expect(menu.getByRole('button', { name: 'Carica partita' })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Trofei' })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Come si gioca' })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Impostazioni' })).toBeVisible();

    // First visit: Quick play is the hero action and nothing to continue.
    await expect(page.getByRole('button', { name: 'Partita rapida' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Continua/i })).toHaveCount(0);
  });

  test('renders English home', async ({ page }) => {
    await page.goto('/en');

    await expect(page).toHaveTitle(/Aurion/);
    await expect(page.getByRole('heading', { name: 'Aurion', level: 1 })).toBeVisible();

    const menu = page.getByRole('navigation', { name: 'Main menu' });
    await expect(menu.getByRole('link', { name: 'New game' })).toBeVisible();
    await expect(menu.getByRole('button', { name: 'Load game' })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'How to play' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Quick play' })).toBeVisible();
  });

  test('load game opens the save browser with an empty state', async ({ page }) => {
    await page.goto('/it');
    await page.getByTestId('menu-load').click();
    const browser = page.getByTestId('save-browser');
    await expect(browser).toBeVisible();
    await expect(browser.getByText('Nessuna partita salvata')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(browser).toHaveCount(0);
  });
});
