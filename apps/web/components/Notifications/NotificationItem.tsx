// Single entry in the right-side notifications stream. Looks up the matching
// EventDefinition in the active scenario for its title / description, falls
// back to raw ids if not found.

'use client';

import { useTranslations } from 'next-intl';
import type { EventDefinition, GameEvent } from '@aurion/engine';

import { cn } from '../../lib/cn';
import type { ScenarioId } from '../../lib/scenarios';
import { useScenarioMessages } from '../Panels/shared/useScenarioMessages';

export type NotificationItemProps = {
  event: GameEvent;
  /** The matching EventDefinition (or null when not found in the scenario). */
  definition: EventDefinition | null;
  /** Active scenario id — used to resolve `event.*` strings from the
   * scenario side-car bundle. `null` when no scenario is loaded (we then
   * fall back to raw ids). */
  scenarioId: ScenarioId | null;
  /** Current game tick — used to compute "N weeks ago". */
  currentTick: number;
  /** Click handler. Only meaningful for unresolved events. */
  onSelect?: () => void;
};

export function NotificationItem({
  event,
  definition,
  scenarioId,
  currentTick,
  onSelect,
}: NotificationItemProps) {
  const t = useTranslations('notifications');
  // Event nameKey/descriptionKey/labelKey live in the scenario side-car
  // bundle, not in the global messages file — resolve them via the
  // scenario messages hook (same pattern as EventModal / WorldMap).
  const { t: tScenario } = useScenarioMessages(scenarioId);
  const resolved = event.resolvedChoiceIndex !== null;
  const ago = Math.max(0, currentTick - event.firedAtTick);

  const titleText = definition
    ? tScenario(definition.nameKey)
    : event.definitionId;
  const descriptionText = definition ? tScenario(definition.descriptionKey) : '';
  const chosenLabel =
    resolved &&
    definition &&
    event.resolvedChoiceIndex !== null &&
    definition.choices[event.resolvedChoiceIndex]
      ? tScenario(definition.choices[event.resolvedChoiceIndex]!.labelKey)
      : null;

  const Wrapper = onSelect ? 'button' : 'div';

  return (
    <Wrapper
      type={onSelect ? 'button' : undefined}
      onClick={onSelect}
      className={cn(
        'group flex w-full flex-col gap-1 bg-transparent py-2 text-left text-xs transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent',
        resolved ? 'opacity-70' : null,
        onSelect ? 'hover:text-fg' : null,
      )}
      aria-label={titleText}
    >
      <div className="flex items-center gap-2">
        <NotificationIcon resolved={resolved} />
        <span
          className={cn(
            'flex-1 truncate font-semibold',
            resolved ? 'text-fg-muted' : 'text-fg',
          )}
        >
          {titleText}
        </span>
        <span className="numeric-tabular font-mono text-[10px] uppercase tracking-wider text-fg-faint">
          {ago === 0 ? t('justNow') : t('ticksAgo', { n: ago })}
        </span>
      </div>
      {descriptionText ? (
        <p className="line-clamp-1 text-[11px] leading-snug text-fg-muted">
          {descriptionText}
        </p>
      ) : null}
      {chosenLabel ? (
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-success">
          {t('chose', { label: chosenLabel })}
        </p>
      ) : !resolved ? (
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-warning">
          {t('actionRequired')}
        </p>
      ) : null}
    </Wrapper>
  );
}

function NotificationIcon({ resolved }: { resolved: boolean }) {
  // Single ink accent — no chip background, just a typographic glyph in the
  // semantic colour for the state.
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex h-4 w-4 items-center justify-center font-mono text-[11px]',
        resolved ? 'text-fg-faint' : 'text-warning',
      )}
    >
      {resolved ? '✓' : '!'}
    </span>
  );
}

export default NotificationItem;
