'use client';

// Runs an engine action for a panel: plays the right sound and turns the
// engine's error keys into sentences the player can read. Shared by the
// Economy, Research and Politics panels.

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import type { Action } from '@aurion/engine';

import { useGameStore } from '../../../lib/store';
import { useSfx, type SfxId } from '../../Audio';

type PanelNamespace = 'panelEconomy' | 'panelResearch' | 'panelPolitics';

/**
 * Returns `run(action, sound)`, resolving to `true` when the engine accepted
 * the action. Engine errors are i18n keys (`errors.invest.…`); those the
 * global bundle does not know are looked up under the panel's own namespace.
 */
export function useEngineAction(
  namespace: PanelNamespace,
  onErrors: ((errors: string[]) => void) | undefined,
): (action: Action, okSound?: SfxId) => Promise<boolean> {
  const tRoot = useTranslations();
  const applyAction = useGameStore((s) => s.applyAction);
  const sfx = useSfx();

  return useCallback(
    async (action, okSound = 'sfx.confirm') => {
      const errors = await applyAction(action);
      if (errors.length === 0) {
        sfx(okSound);
        return true;
      }
      sfx('sfx.error');
      onErrors?.(
        errors.map((key) => {
          if (tRoot.has(key)) return tRoot(key);
          const local = `${namespace}.${key}`;
          return tRoot.has(local) ? tRoot(local) : key;
        }),
      );
      return false;
    },
    [applyAction, namespace, onErrors, sfx, tRoot],
  );
}
