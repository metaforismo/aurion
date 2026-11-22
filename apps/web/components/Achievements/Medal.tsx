// A trophy's medal: metal colour says the tier, a padlock says "not yet".

import type { AchievementDef } from '@aurion/engine';

import { cn } from '../../lib/cn';

export type Tier = AchievementDef['tier'];

export const TIER_ORDER: readonly Tier[] = ['bronze', 'silver', 'gold'];

/** Metal colours — the one place tier is allowed to be decorative. */
export const TIER_COLOR: Record<Tier, string> = {
  bronze: '#d2925f',
  silver: '#c8d2dc',
  gold: '#e8b45a',
};

export function Medal({
  tier,
  locked = false,
  size = 44,
  className,
}: {
  tier: Tier;
  locked?: boolean;
  size?: number;
  className?: string;
}) {
  const color = locked ? 'rgba(255,255,255,0.28)' : TIER_COLOR[tier];
  return (
    <svg
      aria-hidden
      viewBox="0 0 44 44"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      fill="none"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* ribbon */}
      <path d="M15 4l5 11M29 4l-5 11" opacity={locked ? 0.6 : 0.85} />
      {/* disc */}
      <circle
        cx="22"
        cy="27"
        r="12"
        fill={locked ? 'rgba(255,255,255,0.03)' : `${TIER_COLOR[tier]}22`}
      />
      <circle cx="22" cy="27" r="8.2" opacity="0.45" />
      {locked ? (
        <g>
          <rect x="18" y="26" width="8" height="6.4" rx="1.4" />
          <path d="M19.6 26v-2a2.4 2.4 0 014.8 0v2" />
        </g>
      ) : (
        <path
          d="M22 21.6l1.7 3.5 3.8.5-2.8 2.7.7 3.8-3.4-1.8-3.4 1.8.7-3.8-2.8-2.7 3.8-.5z"
          fill={color}
          stroke="none"
        />
      )}
    </svg>
  );
}
