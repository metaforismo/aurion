// Era pill — small caps tag sitting between the brand wordmark and the
// DateBadge. Only rendered when the active scenario declares an `eras[]`
// schedule (and the engine has populated `state.eraState`). Phase 1/2
// scenarios that don't opt into the era system see nothing — the pill
// hides itself.
//
// Visual: 1px hairline pill (`border-border`), `rounded-sm`, small-caps
// `text-fg-muted` body, `px-2 py-0.5`. Read-only — no popover, no hover
// chrome beyond a faint border tint when hovered. The era's localised
// name comes from the scenario side-car bundle (the same one
// EraTransitionModal consults), resolved via `useScenarioMessages`.
//
// Implementation notes:
//   - We deliberately do NOT read `eraState.currentEraIndex` blindly: an
//     out-of-range index (corrupted save, scenario rev mismatch) is
//     clamped to the last valid era so the pill never renders an empty
//     string. The engine should keep these in sync, but the HUD is a
//     "render-anything-non-crashy" surface.
//   - When the side-car bundle hasn't loaded yet, `tScenario` returns
//     the raw key (e.g. `era.mc.info-age.name`). We accept that as a
//     readable-enough fallback during the loading window — it disappears
//     within ~one tick of the scenario being loaded.

'use client';

import { useTranslations } from 'next-intl';
import type { Era } from '@aurion/engine';

import type { ScenarioId } from '../../lib/scenarios';
import { useGameStore } from '../../lib/store';
import { useScenarioMessages } from '../Panels/shared/useScenarioMessages';

export function EraBadge() {
  const eras = useGameStore((s) => s.scenario?.eras);
  const currentEraIndex = useGameStore(
    (s) => s.state?.eraState?.currentEraIndex,
  );
  const scenarioId = useGameStore(
    (s) => (s.scenario?.id ?? null) as ScenarioId | null,
  );
  const t = useTranslations('hud.era');
  // Era name keys live in the scenario side-car bundle (same as the
  // EraTransitionModal). The hook returns the raw key on miss so we never
  // render an empty pill.
  const { t: tScenario } = useScenarioMessages(scenarioId);

  // No eras declared by the scenario → hide entirely. Mondo contemporaneo
  // and Guerra fredda are the two Phase 3 scenarios that opt in.
  if (!eras || eras.length === 0) return null;
  // `eraState` is absent for older saves loaded into an era-aware scenario.
  // We treat that as "still in era 0" rather than hiding — the player should
  // see the active era as soon as they enter the world.
  const safeIndex = clampIndex(currentEraIndex ?? 0, eras.length);
  const era: Era = eras[safeIndex] as Era;
  const name = tScenario(era.nameKey) || era.id;

  return (
    <span
      role="status"
      aria-label={t('tooltip', { name })}
      title={t('tooltip', { name })}
      data-testid="era-badge"
      className="rounded-sm border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-fg-muted"
    >
      {name}
    </span>
  );
}

/** Clamp `i` into `[0, len - 1]`. Returns 0 when `len` is 0 (caller guarded). */
function clampIndex(i: number, len: number): number {
  if (!Number.isFinite(i) || i < 0) return 0;
  if (i >= len) return len - 1;
  return Math.floor(i);
}

export default EraBadge;
