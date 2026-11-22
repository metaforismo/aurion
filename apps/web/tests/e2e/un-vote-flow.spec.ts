// Phase 3 spec §1417 — `un-vote-flow.spec.ts`:
//   nuova partita → wait risoluzione (cheat helper triggers one) → click
//   "Vota" → modal aperto → "Yes" → tick avanza → risultato applicato.
//
// The engine doesn't auto-spawn a resolution on tick 0, and a real
// `proposeUNResolution` action from the player would still need ~half a year
// to close. Both make a smoke test brittle. Instead we:
//   1) start MC as Italy (council member — verified by phase3.spec.ts);
//   2) inject a synthetic 'sanctions' resolution into `state.unResolutions`
//      via the `injectUNResolution` cheat helper;
//   3) vote "Sì" — once from the new-resolution dialog, once from the
//      resolution card in the UN panel (`un-resolution-{id}` → `un-vote-yes`);
//   4) assert the vote is recorded on the resolution (`votes[player] === 'yes'`)
//      and, in the panel, that the ballot gives way to the "Hai votato" line
//      (`un-voted`).
//
// Step 4 confirms the engine reducer (`voteUN`) ran and updated state. We
// stop short of asserting `passed` / `failed` because that requires AI council
// votes which the engine schedules asynchronously — a separate engine test
// owns that path.

import { expect, test } from '@playwright/test';

import { dismissAllEventModals, startNewGame, waitForPlayReady } from './fixtures';
import {
  injectUNResolution,
  readStateField,
  waitForStore,
} from './helpers/phase3';

test.describe('Phase 3 — UN vote flow', () => {
  test('player votes Yes on an injected sanctions resolution', async ({
    page,
  }) => {
    // Mondo Contemporaneo + mc-italy → player is on the UN council
    // (verified by phase3.spec.ts "Mondo Contemporaneo grants the player UN
    // council status when picking Italy"). Council members can vote.
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

    // Inject a synthetic sanctions resolution proposed by mc-usa targeting
    // mc-china. As soon as the resolution lands in `state.unResolutions`,
    // the app auto-opens the "Nuova risoluzione ONU" notification modal
    // with the Vote buttons rendered inline — perfect for an E2E flow.
    const resolutionId = await injectUNResolution(page, {
      kind: 'sanctions',
      proposerCountryId: 'mc-usa',
      targetCountryId: 'mc-china',
      votingDurationTicks: 52,
    });
    expect(resolutionId).toMatch(/^test_sanctions_/);

    // The new-resolution modal should pop up automatically. Match by the IT
    // dialog title.
    const newResolutionDialog = page.getByRole('dialog', {
      name: /Nuova risoluzione ONU/i,
    });
    await expect(newResolutionDialog).toBeVisible({ timeout: 5_000 });

    // Click "Sì" inside the dialog (same labels as the panel's ballot).
    await newResolutionDialog.getByRole('button', { name: /^Sì$/ }).click();

    // Engine assertion: the vote was recorded against the player on the
    // synthetic resolution. We poll because the store update is async (the
    // ActionButton awaits applyAction before the dialog re-renders).
    await expect
      .poll(
        async () => {
          const resolutions = await readStateField<
            { id: string; votes: Record<string, string> }[]
          >(page, 'unResolutions');
          const ours = resolutions?.find((r) => r.id === resolutionId);
          return ours?.votes['mc-italy'] ?? null;
        },
        { timeout: 5_000, intervals: [100, 250, 500] },
      )
      .toBe('yes');
  });

  test('player votes Yes from the resolution card in the UN panel', async ({ page }) => {
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

    const resolutionId = await injectUNResolution(page, {
      kind: 'sanctions',
      proposerCountryId: 'mc-usa',
      targetCountryId: 'mc-china',
      votingDurationTicks: 52,
    });

    // Put the dialog aside and vote from the panel instead.
    const newResolutionDialog = page.getByRole('dialog', {
      name: /Nuova risoluzione ONU/i,
    });
    await expect(newResolutionDialog).toBeVisible({ timeout: 5_000 });
    await newResolutionDialog.getByRole('button', { name: /Per ora salta/ }).click();
    await expect(newResolutionDialog).toBeHidden();

    // Open the UN panel through the store so the test does not depend on
    // the dock's markup.
    await page.evaluate(() => {
      const w = window as unknown as {
        __aurion: { store: { getState: () => { setSelectedPanel: (id: string) => void } } };
      };
      w.__aurion.store.getState().setSelectedPanel('un');
    });

    const card = page.getByTestId(`un-resolution-${resolutionId}`);
    await expect(card).toBeVisible();
    // Italy sits on the council: the veto is offered next to the ballot.
    await expect(card.getByTestId('un-vote-veto')).toBeVisible();
    await card.getByTestId('un-vote-yes').click();

    await expect(card.getByTestId('un-voted')).toContainText('Sì');
    const resolutions = await readStateField<
      { id: string; votes: Record<string, string> }[]
    >(page, 'unResolutions');
    expect(resolutions?.find((r) => r.id === resolutionId)?.votes['mc-italy']).toBe('yes');
  });
});
