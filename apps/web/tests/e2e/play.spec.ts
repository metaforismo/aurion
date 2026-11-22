// Golden-path play test. Starts a new game, exercises the HUD, the speed
// controls, the panels, the map and the spacebar shortcut.
//
// Several tests dismiss any narrative-event modal that appears between actions
// because those modals auto-pause the ticker and would block progress. The
// modal labels themselves are currently broken (see project test report —
// event.* i18n keys are not in messages/{locale}.json), but the buttons still
// resolve the event when clicked.

import { expect, test } from '@playwright/test';

import {
  clickSpeed,
  dismissAllEventModals,
  parseTickFromHud,
  readTick,
  startNewGame,
  waitForPlayReady,
} from './fixtures';

test.describe.configure({ mode: 'serial' });

test.describe('play page — golden path', () => {
  test('HUD shows date / treasury / popularity and starts paused', async ({
    page,
  }) => {
    await startNewGame(page, { locale: 'it' });
    await waitForPlayReady(page, 'it');

    const header = page.locator('header').first();

    // Date label (Settimana W · Anno Y).
    await expect(header).toContainText(/Settimana\s+\d+\s*[·•|]\s*Anno\s+\d+/);

    // Treasury label.
    await expect(header.getByText('Tesoreria').first()).toBeVisible();

    // Popularity label.
    await expect(header.getByText('Popolarità').first()).toBeVisible();

    // Speed defaults to paused (the pause button is aria-pressed).
    const pauseBtn = header.getByRole('button', { name: 'In pausa' });
    await expect(pauseBtn).toHaveAttribute('aria-pressed', 'true');
  });

  test('4× speed advances the tick counter within a few seconds', async ({
    page,
  }) => {
    await startNewGame(page, { locale: 'it' });
    await waitForPlayReady(page, 'it');

    const startTick = await readTick(page);
    expect(Number.isFinite(startTick)).toBe(true);

    await clickSpeed(page, 4, 'it');

    // Wait until at least one tick has been processed. We dismiss any event
    // modals that appear so they don't auto-pause us indefinitely.
    await expect
      .poll(
        async () => {
          await dismissAllEventModals(page, { timeoutMs: 500 });
          const t = await readTick(page);
          return Number.isFinite(t) ? t : startTick;
        },
        { timeout: 12_000, intervals: [250, 500, 1000] },
      )
      .toBeGreaterThan(startTick);

    // Pause again so we don't leak background work into the next test.
    await dismissAllEventModals(page);
    await clickSpeed(page, 0, 'it');
  });

  test('opening the Economy panel and changing tax rate updates the slider', async ({
    page,
  }) => {
    await startNewGame(page, { locale: 'it' });
    await waitForPlayReady(page, 'it');
    await dismissAllEventModals(page);

    // Economy is the default panel, but click anyway to be explicit.
    await page.getByRole('tab', { name: 'Economia' }).click();
    await expect(page.getByText('Politica fiscale')).toBeVisible();

    const slider = page.getByLabel(/Aliquota fiscale/i).first();
    await expect(slider).toBeVisible();

    // Set the slider via the JS setter so React's synthetic input event still
    // fires (typing 35 keystrokes through the keyboard is brittle).
    await slider.evaluate((el, value) => {
      const input = el as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      setter?.call(input, String(value));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, 35);

    await expect(slider).toHaveValue('35');
  });

  test('clicking a non-player country selects it on the map', async ({
    page,
  }) => {
    await startNewGame(page, { locale: 'it' });
    await waitForPlayReady(page, 'it');
    await dismissAllEventModals(page);

    // Every scenario nation has a capital marker on the globe. Markers can be
    // culled when labels collide or sit on the far side, so drive the button
    // directly rather than through a pointer click.
    const velmara = page.getByTestId('map-country-velmara');
    await expect(velmara).toBeAttached();
    await velmara.evaluate((el) => (el as HTMLButtonElement).click());

    await expect(velmara).toHaveAttribute('aria-pressed', 'true');
    // Selecting a nation opens its card with routes into the systems.
    const card = page.getByTestId('country-card');
    await expect(card).toBeVisible({ timeout: 5_000 });
    await expect(card.getByRole('button', { name: 'Diplomazia' })).toBeVisible();
  });

  test('Space toggles pause / resume', async ({ page }) => {
    await startNewGame(page, { locale: 'it' });
    await waitForPlayReady(page, 'it');
    await dismissAllEventModals(page);

    // Start at 1×.
    await clickSpeed(page, 1, 'it');
    const oneSpeed = page
      .locator('header')
      .first()
      .getByRole('button', { name: '1×', exact: true });
    await expect(oneSpeed).toHaveAttribute('aria-pressed', 'true');

    // Press Space. Focus must NOT be on a typing element — clicking the body
    // ensures that.
    await page.locator('body').click();
    await page.keyboard.press('Space');

    const paused = page
      .locator('header')
      .first()
      .getByRole('button', { name: 'In pausa', exact: true });
    await expect(paused).toHaveAttribute('aria-pressed', 'true');

    // Press Space again — should resume to last non-zero speed (1×).
    await page.keyboard.press('Space');
    await expect(oneSpeed).toHaveAttribute('aria-pressed', 'true');

    // Cleanup.
    await clickSpeed(page, 0, 'it');
  });
});

test('parseTickFromHud parses both locales', () => {
  expect(parseTickFromHud('Settimana 5 · Anno 2')).toBe(52 + 4);
  expect(parseTickFromHud('Week 1 · Year 1')).toBe(0);
  expect(parseTickFromHud('foo bar')).toBe(Number.NaN);
});
