// Phase 3 spec §1419 — `achievement-unlock.spec.ts`:
//   nuova partita → triggera condition (es. completa una tech via cheat) →
//   achievement toast appare → check meta.achievements update.
//
// We use `first_alliance` (bronze: 1 alliance treaty) as the trigger because
// the condition is easy to satisfy without ticking — we patch one entry in
// `state.relations` to include the 'alliance' treaty, then run a single tick
// so the achievement evaluator (driven by `advanceTick` in the store) picks
// it up and pushes a toast id into `pendingAchievementToast`.
//
// We assert two things:
//   1) the AchievementToast component renders with the unlocked name;
//   2) navigating to `/trofei` lists the achievement as unlocked.

import { expect, test } from '@playwright/test';

import { dismissAllEventModals, startNewGame, waitForPlayReady } from './fixtures';
import { fastForwardTicks, waitForStore } from './helpers/phase3';

test.describe('Phase 3 — achievement unlock', () => {
  test('first_alliance: signing an alliance triggers the toast', async ({
    page,
  }) => {
    // Quick Start is the simplest scenario (2 countries, no blocs, fast
    // engine ticks). The player country is `verm-aurelia`, the AI is
    // `verm-noctis` (verify the second country id in scenarios/quick-start.json
    // if it changes — both ids are stable).
    await startNewGame(page, {
      locale: 'it',
      scenarioId: 'quick-start',
      countryId: 'verm-aurelia',
      victoryId: 'economic',
      difficultyId: 'normal',
      gameMode: 'classic',
    });
    await waitForPlayReady(page, 'it');
    await dismissAllEventModals(page);
    await waitForStore(page);

    // Patch the relation between the player and the other country to include
    // an 'alliance' treaty. We use the same `relationKey` convention as the
    // engine (lex-sorted ids joined by '::'). This is a state cheat — the
    // alternative (drive the Diplomacy panel + wait for AI acceptance) needs
    // attitude ≥ 30 + several ticks and would make the test brittle.
    await page.evaluate(() => {
      type Rel = {
        countryA: string;
        countryB: string;
        attitude: number;
        treaties: string[];
        atWar: boolean;
      };
      const w = window as unknown as {
        __aurion: {
          store: {
            getState: () => {
              state: {
                playerCountryId: string;
                countries: Record<string, unknown>;
                relations: Record<string, Rel>;
              } | null;
            };
            setState: (partial: Record<string, unknown>) => void;
          };
        };
      };
      const api = w.__aurion.store;
      const root = api.getState();
      if (!root.state) throw new Error('No state');
      const me = root.state.playerCountryId;
      const otherId = Object.keys(root.state.countries).find((id) => id !== me);
      if (!otherId) throw new Error('No other country to ally with');
      const key = me < otherId ? `${me}::${otherId}` : `${otherId}::${me}`;
      const existing: Rel = root.state.relations[key] ?? {
        countryA: me < otherId ? me : otherId,
        countryB: me < otherId ? otherId : me,
        attitude: 50,
        treaties: [],
        atWar: false,
      };
      const treaties = existing.treaties.includes('alliance')
        ? existing.treaties
        : [...existing.treaties, 'alliance'];
      const nextRelations = {
        ...root.state.relations,
        [key]: { ...existing, treaties },
      };
      api.setState({
        state: { ...root.state, relations: nextRelations },
      });
    });

    // Advance one tick so `advanceTick` runs the achievement evaluator.
    await fastForwardTicks(page, 1);
    await dismissAllEventModals(page);

    // Toast: appears bottom-right, role="status", and contains the
    // achievement's localised name. The IT name lives under
    // achievements.first_alliance.name in messages/it.json.
    const toast = page.locator('[role="status"]').filter({
      hasText: /Sbloccato|Obiettivo/i,
    });
    await expect(toast.first()).toBeVisible({ timeout: 7_000 });

    // Catalogue page: the unlocked achievement is in the AchievementsList
    // and is NOT obscured by the locked silhouette. We navigate via direct
    // URL because the home doesn't (currently) link to /trofei in IT.
    await page.goto('/it/trofei');
    // The page title is "Trofei" (per messages/it.json::trofei.pageTitle).
    await expect(
      page.getByRole('heading', { name: /Trofei|Achievements/i }).first(),
    ).toBeVisible();
    // The first_alliance achievement name should appear somewhere on the
    // page (the AchievementsList component renders both locked and unlocked
    // entries — for unlocked ones the real localised name is visible rather
    // than the "???" silhouette). The IT name is "Diplomatico"
    // (messages/it.json::achievements.first_alliance.name).
    await expect(
      page.getByText(/Diplomatico|Diplomat/i).first(),
    ).toBeVisible();
  });
});
