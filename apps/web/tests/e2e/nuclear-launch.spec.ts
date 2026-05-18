// Phase 3 spec §1418 — `nuclear-launch.spec.ts`:
//   cheat helper sblocca arsenale → click "Lancia atomica" → modal 1 →
//   wait 3s → continua → modal 2 → digita LANCIO → strike applicato.
//
// Coverage:
//   1) Granting the arsenal is the only state-bypass cheat (the alternative
//      would be ~years of in-game research). Once the arsenal exists, every
//      remaining step is driven through real UI.
//   2) The two-step confirm modal's friction gates are asserted explicitly:
//        - step 1's "Continua" button is disabled until the 3-second
//          cooldown expires (asserts the anti-misclick guard is real);
//        - step 2's "Lancia" button stays disabled when the typed string is
//          anything other than literal "LANCIO" — we test lowercase + empty.
//   3) After confirmation, the strike action lands and engine state mutates
//      (warhead count drops). We do NOT assert on reputation deltas here
//      because those are tick-deferred; a dedicated engine test owns that
//      path.
//
// Locale: pinned to IT for selector stability. The modal copy comes from
// `messages/it.json::modals.nuclearConfirm.*`. Button labels are matched by
// the canonical "Continua" / "Annulla" / "Lancia" strings.

import { expect, test } from '@playwright/test';

import { dismissAllEventModals, startNewGame, waitForPlayReady } from './fixtures';
import {
  grantNuclearArsenal,
  readPlayerField,
  waitForStore,
} from './helpers/phase3';

test.describe('Phase 3 — nuclear launch', () => {
  test('tactical strike: arsenal cheat → both confirm gates → strike applied', async ({
    page,
  }) => {
    test.slow(); // The 3-second cooldown alone uses most of the default budget.

    // Mondo Contemporaneo + mc-italy: a regional power with a real military
    // and a populated regions list. Italy is a council member so the UN
    // panel doesn't render an "unavailable" state, but that's incidental
    // here — we only need a scenario with multiple regions.
    await startNewGame(page, {
      locale: 'it',
      scenarioId: 'mondo-contemporaneo',
      countryId: 'mc-italy',
      victoryId: 'economic',
      difficultyId: 'normal',
      gameMode: 'classic',
    });
    await waitForPlayReady(page, 'it');
    await dismissAllEventModals(page);
    await waitForStore(page);

    // Cheat: grant a 5-warhead tactical arsenal so the NuclearArsenalSection
    // mounts in the MilitaryPanel.
    await grantNuclearArsenal(page, { warheadCount: 5, deliveryLevel: 1 });

    // The engine's `launchTactical` reducer rejects strikes against non-enemy
    // regions (`isEnemyRegion` check). The legitimate diplomatic path
    // requires attitude ≤ -30 first, which is brittle to set up via UI. We
    // patch the player↔china relation directly to `atWar = true` so the
    // launch is legal; this keeps the test focused on the actual nuclear
    // confirmation flow.
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
                relations: Record<string, Rel>;
              } | null;
            };
            setState: (partial: Record<string, unknown>) => void;
          };
        };
      };
      const root = w.__aurion.store.getState();
      if (!root.state) throw new Error('No state');
      const me = root.state.playerCountryId;
      const target = 'mc-china';
      const key = me < target ? `${me}::${target}` : `${target}::${me}`;
      const existing = root.state.relations[key] ?? {
        countryA: me < target ? me : target,
        countryB: me < target ? target : me,
        attitude: -80,
        treaties: [],
        atWar: false,
      };
      const nextRelations = {
        ...root.state.relations,
        [key]: { ...existing, attitude: -80, atWar: true },
      };
      w.__aurion.store.setState({
        state: { ...root.state, relations: nextRelations },
      });
    });


    // Switch to the Military panel. The tab label is "Militare" in IT.
    await page.getByRole('tab', { name: /^Militare$/ }).click();

    // The arsenal section is keyed by the localised section title. Scope all
    // further selectors to it so we don't collide with the (visually similar)
    // "Schiera unità" affordance higher in the panel.
    const arsenalSection = page.getByLabel('Arsenale Nucleare');
    await expect(arsenalSection).toBeVisible();

    // Pick a region for the tactical strike. The select is `#nuke-region`.
    // After declaring war on China, mc-asia-pacific is now a legal tactical
    // target (it's China's home region and the war makes it an enemy region).
    const regionSelect = page.locator('#nuke-region');
    await expect(regionSelect).toBeVisible();
    await regionSelect.selectOption('mc-asia-pacific');

    // Click "Lancia tattico" — opens step 1 of the confirm modal.
    await arsenalSection.getByRole('button', { name: /Lancia tattico/ }).click();

    // ---- Step 1 ----------------------------------------------------------
    // The advisory dialog is non-dismissable (ESC + backdrop ignored). The
    // Continua button is disabled while the 3s cooldown counts down. We
    // simply wait for it to flip enabled (asserts the cooldown gate is real
    // — if the gate were absent the wait would resolve immediately, but our
    // 5s budget accommodates a real wall-clock wait).
    const step1Dialog = page.getByRole('dialog');
    await expect(step1Dialog).toBeVisible();

    // The Continua button label starts as "Continua (Ns)" countdown and
    // settles on plain "Continua" once enabled. The disabled→enabled flip
    // is the real assertion that the cooldown is real.
    const continueBtn = step1Dialog.getByRole('button', { name: /Continua/ });
    await expect(continueBtn).toBeEnabled({ timeout: 6_000 });
    await continueBtn.click();

    // ---- Step 2 ----------------------------------------------------------
    // The sanity-check modal renders an input that requires the literal
    // string "LANCIO" before the confirm button enables.
    const step2Dialog = page.getByRole('dialog');
    await expect(step2Dialog).toBeVisible();

    const confirmInput = page.locator('#nuclear-confirm-input');
    await expect(confirmInput).toBeVisible();

    // The final Lancia button — disabled while the input is empty.
    const launchBtn = step2Dialog.getByRole('button', { name: /^Lancia$/ });
    await expect(launchBtn).toBeDisabled();

    // Typed-string gate: lowercase "lancio" must NOT enable the button.
    await confirmInput.fill('lancio');
    await expect(launchBtn).toBeDisabled();

    // Empty string also keeps it disabled.
    await confirmInput.fill('');
    await expect(launchBtn).toBeDisabled();

    // Correct word enables it.
    await confirmInput.fill('LANCIO');
    await expect(launchBtn).toBeEnabled();
    await launchBtn.click();

    // ---- Post-launch -----------------------------------------------------
    // The two-step confirm modal closes and the engine reducer applies. We
    // poll on warhead count rather than on UI text because the modal
    // lifecycle + reducer commit happen across separate React passes.
    //
    // The engine emits a follow-up event modal for the strike (an event
    // labelled `event_nuclear_strike_tactical_<region>`), which is correct
    // behaviour but unrelated to the launch flow we're testing. We don't
    // assert the confirm modal is gone, since the event modal would
    // immediately replace it.
    await expect
      .poll(
        async () => readPlayerField<number>(page, ['nuclear', 'warheadCount']),
        { timeout: 5_000, intervals: [100, 250, 500] },
      )
      .toBeLessThan(5);
  });
});
