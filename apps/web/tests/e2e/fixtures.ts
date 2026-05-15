// Shared helpers for the E2E suite. These intentionally use the visible UI
// rather than poking at internal store state so the tests double as a real
// gameplay-loop smoke check.
//
// IMPORTANT: the new-game wizard has 5 steps as of Wave 9 / Phase 3:
//   1) scenario   2) country   3) victory   4) difficulty   5) game mode
// Existing helpers default to a Phase 1-equivalent run (Ascesa di Aurion,
// player Aurion, economic victory, normal difficulty, classic mode). Phase 3
// tests opt into the other modes via the `gameMode` / `scenarioId` params.

import { expect, type Page } from '@playwright/test';

export type Locale = 'it' | 'en';

/** All 5 game modes selectable in the wizard. */
export type GameMode = 'classic' | 'eternal' | 'era-paced' | 'dethrone';

/** All 4 difficulty preset ids that ship with the bundled scenarios. */
export type DifficultyId = 'easy' | 'normal' | 'hard' | 'ironMan';

export type ScenarioId =
  | 'ascesa-aurion'
  | 'quick-start'
  | 'mondo-contemporaneo'
  | 'guerra-fredda';

/**
 * Localised display names for the four scenarios. The wizard cards now render
 * the translated `nameKey` rather than the raw id, so we have to match by the
 * visible string. Keep in sync with messages/{it,en}.json::scenario.*.name.
 */
const SCENARIO_LABEL: Record<Locale, Record<ScenarioId, string>> = {
  it: {
    'ascesa-aurion': 'Ascesa di Aurion',
    'quick-start': 'Quick Start',
    'mondo-contemporaneo': 'Mondo Contemporaneo',
    'guerra-fredda': 'Guerra Fredda',
  },
  en: {
    'ascesa-aurion': 'Ascesa di Aurion',
    'quick-start': 'Quick Start',
    'mondo-contemporaneo': 'Mondo Contemporaneo',
    'guerra-fredda': 'Guerra Fredda',
  },
};

/**
 * Localised display names for the four difficulty presets. Same situation as
 * scenarios — wizard cards render the translated name.
 */
const DIFFICULTY_LABEL: Record<Locale, Record<DifficultyId, string>> = {
  it: {
    easy: 'Facile',
    normal: 'Normale',
    hard: 'Difficile',
    ironMan: 'Iron Man',
  },
  en: {
    easy: 'Easy',
    normal: 'Normal',
    hard: 'Hard',
    ironMan: 'Iron Man',
  },
};

/** Localised display names for the four selectable game-mode cards. */
const GAME_MODE_LABEL: Record<Locale, Record<GameMode, string>> = {
  it: {
    classic: 'Classica',
    eternal: 'Eterna',
    'era-paced': 'A capitoli',
    dethrone: 'Detronizzazione',
  },
  en: {
    classic: 'Classic',
    eternal: 'Eternal',
    'era-paced': 'Era-paced',
    dethrone: 'Dethrone',
  },
};

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
 * Run the new-game wizard end to end and land on the play page. Returns the
 * `saveId` extracted from the URL once the play screen has rendered.
 *
 * Phase 3 update: the wizard is now 5 steps. Defaults pick Ascesa di Aurion
 * + Aurion + economic + normal + classic so existing tests stay representative.
 */
export async function startNewGame(
  page: Page,
  opts: {
    locale: Locale;
    /** Scenario id button to click on step 1. Defaults to ascesa-aurion. */
    scenarioId?: ScenarioId;
    /** Country id to pick on step 2. Defaults to aurion. */
    countryId?: string;
    /** Victory condition id to pick on step 3. Defaults to economic. */
    victoryId?:
      | 'economic'
      | 'military'
      | 'scientific'
      | 'diplomatic'
      | 'domination';
    /** Difficulty id to pick on step 4. Defaults to normal. */
    difficultyId?: DifficultyId;
    /** Game mode to pick on step 5. Defaults to classic. */
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

  // Step 1 — scenario. The card's accessible name is the translated scenario
  // display string. Match the start of the button (the card composes name +
  // status badge + description into one button).
  const scenarioLabel = SCENARIO_LABEL[locale][scenarioId];
  const scenarioRow = page
    .getByRole('button', {
      name: new RegExp(`^${escapeRegex(scenarioLabel)}\\b`),
    })
    .first();
  await expect(scenarioRow).toBeVisible();
  await scenarioRow.click();
  await clickNext(page, locale);

  // Step 2 — country. The accessible name on each country button is
  // "<localized name> <id>" (e.g. "country.aurion.name aurion"). We match by
  // the trailing id which is stable across locales / scenario message
  // availability.
  const countryRow = page
    .getByRole('button', {
      name: new RegExp(`\\b${escapeRegex(countryId)}\\b`),
    })
    .first();
  await expect(countryRow).toBeVisible();
  await countryRow.click();
  await clickNext(page, locale);

  // Step 3 — victory. The button text is the localised victory name.
  const victoryName = VICTORY_LABEL[locale][victoryId];
  await page
    .getByRole('button', { name: new RegExp(escapeRegex(victoryName), 'i') })
    .first()
    .click();
  await clickNext(page, locale);

  // Step 4 — difficulty.
  const difficultyName = DIFFICULTY_LABEL[locale][difficultyId];
  await page
    .getByRole('button', { name: new RegExp(`^${escapeRegex(difficultyName)}\\b`) })
    .first()
    .click();
  await clickNext(page, locale);

  // Step 5 — game mode.
  const gameModeName = GAME_MODE_LABEL[locale][gameMode];
  await page
    .getByRole('button', { name: new RegExp(`\\b${escapeRegex(gameModeName)}\\b`) })
    .first()
    .click();

  await page
    .getByRole('button', { name: startLabel(locale), exact: true })
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

/** Click the wizard's "Next" button at any step. */
async function clickNext(page: Page, locale: Locale): Promise<void> {
  await page
    .getByRole('button', { name: nextLabel(locale), exact: true })
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
  return locale === 'it' ? 'Avvia partita' : 'Start game';
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
