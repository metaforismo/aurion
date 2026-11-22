// Shared helpers for the E2E suite. These intentionally use the visible UI
// rather than poking at internal store state so the tests double as a real
// gameplay-loop smoke check.
//
// The new-game flow is mode-first:
//   mode → world → nation → (victory, Campaign only) → difficulty → launch
// Every step has a recommended default and the "Start game" button is
// available throughout, so helpers only touch the steps they care about.
// Options are radio cards addressed by data-testid:
//   game-mode-option-<mode> · scenario-option-<id> · country-option-<id>
//   victory-option-<id> · difficulty-option-<id> · iron-man-switch
//   wizard-step-<step> (rail) · wizard-next · wizard-back · wizard-start
//   (phone bottom bar: wizard-next-compact · wizard-start-compact)

import { expect, type Page } from '@playwright/test';

export type Locale = 'it' | 'en';

/** All 5 game modes selectable in the wizard. */
export type GameMode = 'classic' | 'eternal' | 'era-paced' | 'dethrone' | 'space-race';

/** All 4 difficulty preset ids that ship with the bundled scenarios. */
export type DifficultyId = 'easy' | 'normal' | 'hard' | 'ironMan';

export type ScenarioId =
  | 'ascesa-aurion'
  | 'quick-start'
  | 'mondo-contemporaneo'
  | 'guerra-fredda';

/**
 * Pre-set the IndexedDB tutorial-dismissed flag so the first-time tutorial
 * overlay does not fire on every test. We attempt a direct IndexedDB write
 * via an init script run before every navigation. The persistence layer
 * stores the flag in `meta` table of the `aurion` database.
 *
 * Falls back to a no-op when IndexedDB is unavailable (very rare in
 * Playwright's Chromium). The tutorial overlay defaults to "dismissed" on
 * persistence errors (see useTutorialState.ts), so a failed init is harmless.
 */
export async function dismissTutorial(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (typeof indexedDB === 'undefined') return;
    try {
      const open = indexedDB.open('aurion');
      open.onupgradeneeded = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      };
      open.onsuccess = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains('meta')) {
          db.close();
          return;
        }
        const tx = db.transaction('meta', 'readwrite');
        tx.objectStore('meta').put({
          key: 'aurion:tutorial-dismissed',
          value: true,
        });
        tx.oncomplete = () => db.close();
        tx.onerror = () => db.close();
      };
    } catch {
      // best-effort
    }
  });
}

/**
 * Run the new-game flow through the UI and land on the play page. Returns
 * the `saveId` extracted from the URL once the play screen has rendered.
 *
 * Defaults pick Ascesa di Aurion + Aurion + economic + normal + classic
 * (Campaign) so existing tests stay representative. `victoryId` only applies
 * to Campaign: the other modes have no victory step. `difficultyId: 'ironMan'`
 * turns on the Iron Man switch instead of picking a preset card.
 */
export async function startNewGame(
  page: Page,
  opts: {
    locale: Locale;
    /** World to pick. Defaults to ascesa-aurion. */
    scenarioId?: ScenarioId;
    /** Nation id to pick. Defaults to aurion. */
    countryId?: string;
    /** Victory path (Campaign only). Defaults to economic. */
    victoryId?:
      | 'economic'
      | 'military'
      | 'scientific'
      | 'diplomatic'
      | 'domination';
    /** Difficulty preset. Defaults to normal. */
    difficultyId?: DifficultyId;
    /** Game mode, chosen first. Defaults to classic (Campaign). */
    gameMode?: GameMode;
    /** Pre-dismiss the first-time tutorial via an init script. Default true. */
    dismissTutorialFirst?: boolean;
  },
): Promise<string> {
  const {
    locale,
    scenarioId = 'ascesa-aurion',
    countryId = 'aurion',
    victoryId = 'economic',
    difficultyId = 'normal',
    gameMode = 'classic',
    dismissTutorialFirst = true,
  } = opts;

  if (dismissTutorialFirst) {
    await dismissTutorial(page);
  }

  await page.goto(`/${locale}/new`);

  // Step 1 — mode.
  await pickOption(page, `game-mode-option-${gameMode}`);
  await clickNext(page);

  // Step 2 — world.
  await pickOption(page, `scenario-option-${scenarioId}`);
  await clickNext(page);

  // Step 3 — nation (cards appear once the world's data has loaded).
  await pickOption(page, `country-option-${countryId}`);
  await clickNext(page);

  // Step 4 — victory path, only in Campaign.
  if (gameMode === 'classic') {
    await pickOption(page, `victory-option-${victoryId}`);
    await clickNext(page);
  }

  // Difficulty. Iron Man is a switch layered over the presets.
  if (difficultyId === 'ironMan') {
    const ironMan = page.getByTestId('iron-man-switch');
    await ironMan.click();
    await expect(ironMan).toHaveAttribute('aria-checked', 'true');
  } else {
    await pickOption(page, `difficulty-option-${difficultyId}`);
  }
  await clickNext(page);

  // Launch summary → start. (Phone layouts use `wizard-start-compact` /
  // `wizard-next-compact` in the bottom bar instead.)
  await page
    .locator('[data-testid="wizard-start"]:visible, [data-testid="wizard-start-compact"]:visible')
    .first()
    .click();

  // Wait for redirect to /<locale>/play/<saveId>
  await page.waitForURL(new RegExp(`/${locale}/play/[^/?#]+`), {
    timeout: 20_000,
  });
  const url = new URL(page.url());
  const match = url.pathname.match(new RegExp(`/${locale}/play/([^/?#]+)$`));
  if (!match) throw new Error(`Could not parse saveId from URL: ${page.url()}`);
  return decodeURIComponent(match[1]!);
}

/** Select a radio card of the new-game flow and wait until it is checked. */
async function pickOption(page: Page, testId: string): Promise<void> {
  const option = page.getByTestId(testId);
  await expect(option).toBeVisible();
  await option.click();
  await expect(option).toHaveAttribute('aria-checked', 'true');
}

/** Click the wizard's "Next" button (desktop layout). */
async function clickNext(page: Page): Promise<void> {
  // Desktop rail button or the phone bottom bar, whichever is on screen.
  await page
    .locator('[data-testid="wizard-next"]:visible, [data-testid="wizard-next-compact"]:visible')
    .first()
    .click();
}

/** Click one of the speed buttons in the HUD. */
export async function clickSpeed(
  page: Page,
  speed: 0 | 1 | 2 | 4,
  locale: Locale = 'it',
): Promise<void> {
  const label = SPEED_LABEL[locale][speed];
  await page.getByRole('button', { name: label, exact: true }).click();
}

/**
 * Read the current tick from the DateBadge in the HUD. Parses the formatted
 * `Week W · Year Y` (or IT equivalent) back into an absolute tick number.
 */
export async function readTick(page: Page): Promise<number> {
  const text = await page.locator('header').first().textContent();
  return parseTickFromHud(text ?? '');
}

const WEEKS_PER_YEAR = 52;

export function parseTickFromHud(text: string): number {
  // Match both IT ("Settimana W · Anno Y") and EN ("Week W · Year Y").
  const re =
    /(?:Settimana|Week)\s+(\d+)\s*[·•|]\s*(?:Anno|Year)\s+(\d+)/i;
  const m = text.match(re);
  if (!m) return Number.NaN;
  const week = Number(m[1]);
  const year = Number(m[2]);
  return (year - 1) * WEEKS_PER_YEAR + (week - 1);
}

/**
 * Wait for the play page to be fully mounted (HUD + map visible). Helpful
 * after a navigation when the store is hydrating from IndexedDB.
 */
export async function waitForPlayReady(page: Page, locale: Locale = 'it') {
  await expect(
    page.getByRole('region', { name: mapLabel(locale) }),
  ).toBeVisible({ timeout: 15_000 });
  // HUD treasury badge — uses the localised "Treasury" string as a marker.
  await expect(page.getByText(treasuryLabel(locale)).first()).toBeVisible();
}

/**
 * Narrative events trigger a non-dismissable modal that auto-pauses the
 * ticker. For most gameplay tests we don't care which choice is picked — we
 * just need the loop to resume. This helper clicks the first available choice
 * inside the open dialog (any choice resolves the event in the store).
 *
 * Returns true if a modal was dismissed, false if none was open.
 */
export async function dismissEventModalIfPresent(page: Page): Promise<boolean> {
  const dialog = page.getByRole('dialog');
  if (await dialog.count() === 0) return false;
  const firstChoice = dialog.first().getByRole('button').first();
  if (await firstChoice.count() === 0) return false;
  await firstChoice.click({ trial: false }).catch(() => {
    /* may have closed itself between count and click */
  });
  // Wait for the dialog to actually go away.
  await dialog.first().waitFor({ state: 'hidden', timeout: 3_000 }).catch(() => {});
  return true;
}

/**
 * Loops dismissing event modals until none appear for `quietMs`. The engine
 * can immediately fire another event on the next tick after we resolve one,
 * which is why a single dismiss is sometimes not enough.
 */
export async function dismissAllEventModals(
  page: Page,
  opts: { quietMs?: number; timeoutMs?: number } = {},
): Promise<number> {
  const quietMs = opts.quietMs ?? 250;
  const timeoutMs = opts.timeoutMs ?? 5_000;
  const start = Date.now();
  let dismissed = 0;
  let lastSeen = Date.now();
  while (Date.now() - start < timeoutMs) {
    const did = await dismissEventModalIfPresent(page);
    if (did) {
      dismissed += 1;
      lastSeen = Date.now();
    }
    if (Date.now() - lastSeen >= quietMs) break;
    await page.waitForTimeout(50);
  }
  return dismissed;
}

// ---------------------------------------------------------------------------
// Internal i18n cheat-sheet — these strings shadow `messages/{it,en}.json` and
// must be kept in sync. We do NOT import them at runtime because the test
// process doesn't load next-intl and the JSON files contain ICU message
// patterns that would need extra parsing. Keeping a hand-curated subset here
// avoids that complexity.
// ---------------------------------------------------------------------------

const SPEED_LABEL: Record<Locale, Record<0 | 1 | 2 | 4, string>> = {
  it: {
    0: 'In pausa',
    1: '1×',
    2: '2×',
    4: '4×',
  },
  en: {
    0: 'Paused',
    1: '1×',
    2: '2×',
    4: '4×',
  },
};

function mapLabel(locale: Locale): string {
  return locale === 'it'
    ? 'Mappa del mondo di Aurion'
    : 'World map of Aurion';
}

function treasuryLabel(locale: Locale): string {
  return locale === 'it' ? 'Tesoreria' : 'Treasury';
}

