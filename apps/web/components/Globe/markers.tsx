'use client';

// Marker primitives drawn over the globe: capital dots with a name tag and
// "live map" news pills. Each marker is anchored at its top-left origin by
// PlanetView, so every component offsets itself around that point.

import type { ComponentType, ReactNode, SVGProps } from 'react';

import { cn } from '../../lib/cn';

export type MarkerTone = 'accent' | 'danger' | 'info' | 'success' | 'warning' | 'neutral';

const TONE_DOT: Record<MarkerTone, string> = {
  accent: 'bg-accent shadow-[0_0_10px_2px_rgba(232,180,90,0.75)]',
  danger: 'bg-[#ff5d4d] shadow-[0_0_10px_2px_rgba(255,93,77,0.75)]',
  info: 'bg-[#5cc8ff] shadow-[0_0_10px_2px_rgba(92,200,255,0.7)]',
  success: 'bg-[#5fe0a0] shadow-[0_0_10px_2px_rgba(95,224,160,0.7)]',
  warning: 'bg-[#ffab40] shadow-[0_0_10px_2px_rgba(255,171,64,0.75)]',
  neutral: 'bg-white/80 shadow-[0_0_6px_1px_rgba(255,255,255,0.45)]',
};

const TONE_ICON: Record<MarkerTone, string> = {
  accent: 'bg-accent/20 text-accent ring-accent/50',
  danger: 'bg-[#ff5d4d]/20 text-[#ff8a7d] ring-[#ff5d4d]/50',
  info: 'bg-[#5cc8ff]/20 text-[#8ad8ff] ring-[#5cc8ff]/50',
  success: 'bg-[#5fe0a0]/20 text-[#8ff0bf] ring-[#5fe0a0]/50',
  warning: 'bg-[#ffab40]/20 text-[#ffc477] ring-[#ffab40]/50',
  neutral: 'bg-white/10 text-white/80 ring-white/30',
};

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

/** Glowing capital dot + name tag. The dot is centred on the anchor. */
export function CapitalMarker({
  name,
  tone,
  badge,
  selected,
  testId,
  ariaLabel,
  onClick,
  onHover,
}: {
  name: string;
  tone: MarkerTone;
  /** Short chip after the name (e.g. "TU"). */
  badge?: string;
  selected?: boolean;
  testId?: string;
  ariaLabel?: string;
  onClick?: () => void;
  onHover?: (hovering: boolean) => void;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      data-player-capital={tone === 'accent' ? 'true' : undefined}
      aria-label={ariaLabel ?? name}
      aria-pressed={selected}
      onClick={onClick}
      onPointerEnter={() => onHover?.(true)}
      onPointerLeave={() => onHover?.(false)}
      onFocus={() => onHover?.(true)}
      onBlur={() => onHover?.(false)}
      className={cn(
        'group pointer-events-auto absolute -left-[5px] -top-[13px] flex h-[26px] items-center gap-2 rounded-full pr-2.5 text-left',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
      )}
    >
      <span className="relative grid h-[10px] w-[10px] shrink-0 place-items-center">
        {selected ? (
          <span className="absolute h-5 w-5 rounded-full border border-white/80 motion-safe:animate-ping" />
        ) : null}
        <span className={cn('h-[10px] w-[10px] rounded-full ring-1 ring-black/60', TONE_DOT[tone])} />
      </span>
      <span
        className={cn(
          'flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-[3px] text-[11px] font-semibold leading-none tracking-wide backdrop-blur-md transition-colors',
          selected
            ? 'border-white/60 bg-white/15 text-white'
            : 'border-white/10 bg-black/55 text-white/85 group-hover:border-white/40 group-hover:text-white',
        )}
      >
        {name}
        {badge ? (
          <span className="rounded-sm bg-accent px-1 py-px font-mono text-[9px] font-bold text-black">
            {badge}
          </span>
        ) : null}
      </span>
    </button>
  );
}

/** "Live map" pill: icon chip, headline, age. Anchored by a pulsing dot. */
export function NewsPill({
  icon: IconCmp,
  tone,
  title,
  age,
  onClick,
}: {
  icon: Icon;
  tone: MarkerTone;
  title: ReactNode;
  age?: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cn(
        'pointer-events-auto absolute -left-[6px] -top-[40px] flex h-[30px] items-center gap-2 whitespace-nowrap rounded-full border border-white/10 bg-[#0b0e14]/80 pl-1 pr-3 text-[12px] font-medium text-white/90 shadow-[0_6px_24px_rgba(0,0,0,0.55)] backdrop-blur-md',
        onClick &&
          'transition-colors hover:border-white/35 hover:bg-[#141922]/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
      )}
    >
      <span
        className={cn('grid h-[22px] w-[22px] place-items-center rounded-full ring-1', TONE_ICON[tone])}
      >
        <IconCmp aria-hidden className="h-3 w-3" />
      </span>
      <span>{title}</span>
      {age ? <span className="font-mono text-[10px] text-white/45">{age}</span> : null}
      {/* Tether from the pill down to the surface point. */}
      <span
        aria-hidden
        className={cn('absolute left-[2px] top-[36px] h-2 w-2 rounded-full', TONE_DOT[tone])}
      />
    </Tag>
  );
}

/** Small unlabeled glow dot (minor countries, off-world sites). */
export function GlowDot({ tone }: { tone: MarkerTone }) {
  return (
    <span
      aria-hidden
      className={cn('absolute -left-[4px] -top-[4px] block h-2 w-2 rounded-full', TONE_DOT[tone])}
    />
  );
}
