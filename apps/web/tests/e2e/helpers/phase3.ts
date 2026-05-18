// Phase 3 cheat / fast-forward helpers used by bloc-join / un-vote-flow /
// nuclear-launch / achievement-unlock specs.
//
// The web app exposes the zustand store on `window.__aurion.store` (see
// apps/web/lib/store.ts — the test hook is unconditional but namespaced so it
// is safe in production too). These helpers wrap that hook with typed,
// promise-friendly Playwright accessors so individual specs stay readable.
//
// IMPORTANT: most helpers resolve the action through the engine's
// `applyAction` flow — we never bypass reducers / persistence to set raw
// state. That keeps the tests honest about what the engine actually allows.
// The two helpers that DO mutate state directly (`grantNuclearArsenal`,
// `injectUNResolution`) are documented inline and only used by tests that
// would otherwise need real-time research / AI proposals to set up.

import { expect, type Page } from '@playwright/test';

type StoreShape = {
  getState: () => {
    state: Record<string, unknown> | null;
    applyAction: (action: Record<string, unknown>) => Promise<string[]>;
    advanceTick: () => Promise<void>;
  };
  setState: (partial: Record<string, unknown>) => void;
};

type WindowWithAurion = {
  __aurion?: { store?: StoreShape };
};

/**
 * Wait until `window.__aurion.store` is initialised and the store has hydrated
 * a non-null `state`. Times out generously because saves loaded from
 * IndexedDB take a beat on the first call.
 */
export async function waitForStore(page: Page, timeoutMs = 15_000): Promise<void> {
  await page.waitForFunction(
    () => {
      const w = window as unknown as WindowWithAurion;
      return !!w.__aurion?.store?.getState().state;
    },
    undefined,
    { timeout: timeoutMs },
  );
}

/**
 * Dispatch an engine action through the store, returning the engine's i18n
 * error keys (empty array on success) plus the tick after the call so tests
 * can chain "do X, advance N ticks, assert" patterns without round-tripping.
 */
export async function dispatchAction(
  page: Page,
  action: Record<string, unknown>,
): Promise<{ errors: string[]; tick: number }> {
  return page.evaluate(async (a) => {
    const w = window as unknown as WindowWithAurion;
    const store = w.__aurion?.store;
    if (!store) throw new Error('Aurion store not exposed');
    const errors = await store.getState().applyAction(a);
    const tick =
      (store.getState().state?.['tick'] as number | undefined) ?? -1;
    return { errors, tick };
  }, action);
}

/**
 * Advance the in-engine clock by `n` ticks via the store's `advanceTick`. We
 * deliberately use the same path the rAF ticker uses (single tick per call)
 * so engine-side ordering effects (event resolution, achievement evaluation,
 * etc.) match a real run.
 */
export async function fastForwardTicks(page: Page, n: number): Promise<void> {
  await page.evaluate(async (count) => {
    const w = window as unknown as WindowWithAurion;
    const store = w.__aurion?.store;
    if (!store) throw new Error('Aurion store not exposed');
    for (let i = 0; i < count; i++) {
      await store.getState().advanceTick();
    }
  }, n);
}

/**
 * Read a single top-level field off `state`. Restricted to string-keyed
 * lookups so we don't need to ship arbitrary code into the browser. Returns
 * the raw JSON-cloneable value (caller asserts on the shape).
 */
export async function readStateField<T = unknown>(
  page: Page,
  field: string,
): Promise<T | undefined> {
  return page.evaluate((f) => {
    const w = window as unknown as WindowWithAurion;
    const store = w.__aurion?.store;
    if (!store) return undefined;
    const state = store.getState().state;
    if (!state) return undefined;
    return (state as Record<string, unknown>)[f];
  }, field) as Promise<T | undefined>;
}

/**
 * Read a nested path off the player country (e.g. ['blocId'], ['military',
 * 'armySize']). Returns undefined if the country or any intermediate field
 * is missing.
 */
export async function readPlayerField<T = unknown>(
  page: Page,
  path: readonly string[],
): Promise<T | undefined> {
  return page.evaluate((p) => {
    const w = window as unknown as WindowWithAurion;
    const store = w.__aurion?.store;
    if (!store) return undefined;
    const root = store.getState().state;
    if (!root) return undefined;
    const playerId = root['playerCountryId'] as string | undefined;
    if (!playerId) return undefined;
    const countries = root['countries'] as Record<string, unknown> | undefined;
    if (!countries) return undefined;
    let cur: unknown = countries[playerId];
    for (const key of p) {
      if (cur === undefined || cur === null) return undefined;
      cur = (cur as Record<string, unknown>)[key];
    }
    return cur;
  }, path) as Promise<T | undefined>;
}

/**
 * Force-grant the player nuclear arsenal so the Military panel's
 * NuclearArsenalSection renders. We mutate the in-memory state directly here
 * because there is no public engine action that grants warheads outside of
 * the tech tree (which would require ~years of in-game time to research).
 *
 * This is one of the two helpers that bypass the reducer; every other cheat
 * goes through `applyAction`. Used by `nuclear-launch.spec.ts` to set up the
 * arsenal precondition before exercising the real launch flow.
 */
export async function grantNuclearArsenal(
  page: Page,
  opts: { warheadCount?: number; deliveryLevel?: 0 | 1 | 2 } = {},
): Promise<void> {
  const warheadCount = opts.warheadCount ?? 10;
  const deliveryLevel = opts.deliveryLevel ?? 1;
  await page.evaluate(
    ({ wc, dl }) => {
      const w = window as unknown as WindowWithAurion;
      const store = w.__aurion?.store;
      if (!store) throw new Error('Aurion store not exposed');
      const root = store.getState();
      if (!root.state) return;
      const playerId = root.state['playerCountryId'] as string;
      const countries = root.state['countries'] as Record<
        string,
        Record<string, unknown>
      >;
      const country = countries[playerId];
      if (!country) return;
      const nextCountry = {
        ...country,
        nuclear: {
          warheadCount: wc,
          deliverySystemLevel: dl,
          // hasArsenal() requires mad === true to gate launches. Setting
          // mad on the cheat means the launch actions will proceed past
          // their arsenal gate. (mad is the "Mutually Assured Destruction"
          // flag — set when warheadCount >= 1.)
          mad: true,
          firstStrikeUsedAt: null,
          lastStrikeAtTick: null,
        },
      };
      const nextState = {
        ...root.state,
        countries: {
          ...countries,
          [playerId]: nextCountry,
        },
      };
      store.setState({ state: nextState });
    },
    { wc: warheadCount, dl: deliveryLevel },
  );
}

/**
 * Programmatically inject a UN resolution into `state.unResolutions`. The
 * engine has no "spawn arbitrary resolution" public action — the resolution
 * shape is appended either by an AI propose or by an action trigger. For
 * test-only scenarios where we want to force the vote modal open, this
 * shortcut keeps the spec readable. The injected resolution lives only in
 * memory for the duration of the test.
 *
 * Returns the synthetic resolution id so the spec can locate the card.
 */
export async function injectUNResolution(
  page: Page,
  opts: {
    kind: string;
    proposerCountryId: string;
    targetCountryId?: string;
    targetRegionId?: string;
    /** Defaults to current tick + 26 (half a year). */
    votingDurationTicks?: number;
  },
): Promise<string> {
  return page.evaluate((o) => {
    const w = window as unknown as WindowWithAurion;
    const store = w.__aurion?.store;
    if (!store) throw new Error('Aurion store not exposed');
    const root = store.getState();
    if (!root.state) throw new Error('No state to inject into');
    const tick = root.state['tick'] as number;
    const id = `test_${o.kind}_${Date.now()}`;
    const closesAt = tick + (o.votingDurationTicks ?? 26);
    const resolution: Record<string, unknown> = {
      id,
      kind: o.kind,
      proposerCountryId: o.proposerCountryId,
      proposedAtTick: tick,
      votingClosesAtTick: closesAt,
      effects: { onPass: [], onFail: [] },
      votes: {},
      status: 'voting',
      titleKey: `panelUN.kind.${o.kind}`,
      descriptionKey: `panelUN.kindDescription.${o.kind}`,
    };
    if (o.targetCountryId) resolution.targetCountryId = o.targetCountryId;
    if (o.targetRegionId) resolution.targetRegionId = o.targetRegionId;
    const existing = (root.state['unResolutions'] ?? []) as unknown[];
    const nextState = {
      ...root.state,
      unResolutions: [...existing, resolution],
    };
    store.setState({ state: nextState });
    return id;
  }, opts);
}

/** Convenience: re-export expect so specs only import from this helper file. */
export { expect };
