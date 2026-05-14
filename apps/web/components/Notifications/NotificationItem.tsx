// Single entry in the right-side notifications stream. Looks up the matching
// EventDefinition in the active scenario for its title / description, falls
// back to raw ids if not found.

'use client';

import { useTranslations } from 'next-intl';
import type { EventDefinition, GameEvent } from '@aurion/engine';

import { cn } from '../../lib/cn';

export type NotificationItemProps = {
  event: GameEvent;
  /** The matching EventDefinition (or null when not found in the scenario). */
  definition: EventDefinition | null;
  /** Current game tick — used to compute "N weeks ago". */
  currentTick: number;
  /** Click handler. Only meaningful for unresolved events. */
  onSelect?: () => void;
};

export function NotificationItem({
  event,
  definition,
  currentTick,
  onSelect,
}: NotificationItemProps) {
  const t = useTranslations('notifications');
  const tEv = useTranslations();
  const resolved = event.resolvedChoiceIndex !== null;
  const ago = Math.max(0, currentTick - event.firedAtTick);

  const titleText = definition ? tEv(definition.nameKey) : event.definitionId;
  const descriptionText = definition ? tEv(definition.descriptionKey) : '';
  const chosenLabel =
    resolved &&
    definition &&
    event.resolvedChoiceIndex !== null &&
    definition.choices[event.resolvedChoiceIndex]
      ? tEv(definition.choices[event.resolvedChoiceIndex]!.labelKey)
      : null;

  const Wrapper = onSelect ? 'button' : 'div';

  return (
    <Wrapper
      type={onSelect ? 'button' : undefined}
      onClick={onSelect}
      className={cn(
        'group flex w-full flex-col gap-1 rounded-lg border p-3 text-left text-xs transition',
        resolved
          ? 'border-slate-800 bg-slate-950/30 opacity-70'
          : 'border-amber-500/40 bg-amber-500/5 hover:border-amber-400 hover:bg-amber-500/10',
      )}
      aria-label={titleText}
    >
      <div className="flex items-center gap-2">
        <NotificationIcon resolved={resolved} />
        <span
          className={cn(
            'flex-1 truncate font-semibold',
            resolved ? 'text-slate-300' : 'text-amber-100',
          )}
        >
          {titleText}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
          {ago === 0 ? t('justNow') : t('ticksAgo', { n: ago })}
        </span>
      </div>
      {descriptionText ? (
        <p className="line-clamp-1 text-[11px] leading-snug text-slate-400">
          {descriptionText}
        </p>
      ) : null}
      {chosenLabel ? (
        <p className="text-[10px] uppercase tracking-wider text-emerald-300/80">
          {t('chose', { label: chosenLabel })}
        </p>
      ) : !resolved ? (
        <p className="text-[10px] uppercase tracking-wider text-amber-300">
          {t('actionRequired')}
        </p>
      ) : null}
    </Wrapper>
  );
}

function NotificationIcon({ resolved }: { resolved: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-5 w-5 items-center justify-center rounded-full text-[11px]',
        resolved
          ? 'bg-slate-800 text-slate-500'
          : 'bg-amber-500/20 text-amber-200',
      )}
    >
      {resolved ? '✓' : '!'}
    </span>
  );
}

export default NotificationItem;
