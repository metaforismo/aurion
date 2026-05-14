// Shared helpers for the E2E suite. These intentionally use the visible UI
// rather than poking at internal store state so the tests double as a real
// gameplay-loop smoke check.

import { expect, type Page } from '@playwright/test';

export type Locale = 'it' | 'en';

/**
 * Run the new-game wizard end to end and land on the play page. Returns the
 * `saveId` extracted from the URL once the play screen has rendered.
 */
export async function startNewGame(
  page: Page,
  opts: {
    locale: Locale;
    /** Scenario id button to click on step 1. Defaults to ascesa-aurion. */
    scenarioId?: string;
    /** Country id to pick on step 2. Defaults to aurion. */
    countryId?: string;
    /** Victory condition id to pick on step 3. Defaults to economic. */
    victoryId?:
      | 'economic'
      | 'military'
      | 'scientific'
      | 'diplomatic'
      | 'domination';
  },
): Promise<string> {
  const {
    locale,
    scenarioId = 'ascesa-aurion',
    countryId = 'aurion',
    victoryId = 'economic',
  } = opts;

  await page.goto(`/${locale}/new`);

  // Step 1 — scenario. The wizard renders scenario ids verbatim today, so we
  // select the row whose text matches the id.
  const scenarioRow = page.getByRole('button', {
    name: new RegExp(`^${escapeRegex(scenarioId)}$`),
  });
  await expect(scenarioRow).toBeVisible();
  await scenarioRow.click();
  await page
    .getByRole('button', { name: nextLabel(locale), exact: true })
    .first()
    .click();

  // Step 2 — country. The accessible name on each country button is
  // "<nameKey> <id>" (e.g. "country.aurion.name aurion"). We match by the
  // trailing id which is stable across locales / scenario message availability.
  const countryRow = page
    .getByRole('button', {
      name: new RegExp(`\\b${escapeRegex(countryId)}\\b`),
    })
    .first();
  await expect(countryRow).toBeVisible();
  await countryRow.click();
  await page
    .getByRole('button', { name: nextLabel(locale), exact: true })
    .first()
    .click();

  // Step 3 — victory. The button text is the localised victory name, so we
  // need to look up the right label per locale.
  const victoryName = VICTORY_LABEL[locale][victoryId];
  await page
    .getByRole('button', { name: new RegExp(escapeRegex(victoryName), 'i') })
    .first()
    .click();

  await page
    .getByRole('button', { name: startLabel(locale), exact: true })
    .click();

  // Wait for redirect to /<locale>/play/<saveId>
  await page.waitForURL(new RegExp(`/${locale}/play/[^/?#]+`), {
    timeout: 15_000,
  });
  const url = new URL(page.url());
  const match = url.pathname.match(new RegExp(`/${locale}/play/([^/?#]+)$`));
  if (!match) throw new Error(`Could not parse saveId from URL: ${page.url()}`);
  return decodeURIComponent(match[1]!);
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
 *
 * NB: the choice button labels are currently broken — see the test report
 * (event.* i18n keys live in scenario message files but next-intl only loads
 * messages/{locale}.json). The button still works because `resolveCurrentEvent`
 * is wired by index, not by label.
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

const VICTORY_LABEL: Record<
  Locale,
  Record<
    'economic' | 'military' | 'scientific' | 'diplomatic' | 'domination',
    string
  >
> = {
  it: {
    economic: 'Vittoria economica',
    military: 'Vittoria militare',
    scientific: 'Vittoria scientifica',
    diplomatic: 'Vittoria diplomatica',
    domination: 'Dominio totale',
  },
  en: {
    economic: 'Economic victory',
    military: 'Military victory',
    scientific: 'Scientific victory',
    diplomatic: 'Diplomatic victory',
    domination: 'Total domination',
  },
};

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

function nextLabel(locale: Locale): string {
  return locale === 'it' ? 'Avanti' : 'Next';
}

function startLabel(locale: Locale): string {
  return locale === 'it' ? 'Inizia partita' : 'Start game';
}

function mapLabel(locale: Locale): string {
  return locale === 'it'
    ? 'Mappa del mondo di Aurion'
    : 'World map of Aurion';
}

function treasuryLabel(locale: Locale): string {
  return locale === 'it' ? 'Tesoreria' : 'Treasury';
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
