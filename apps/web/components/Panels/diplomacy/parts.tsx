'use client';

// Small building blocks shared by the foreign-affairs panels, so a country,
// an attitude or a priced action looks the same in all four.

import { ArrowRight, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { cn } from '../../../lib/cn';
import { Button, Chip, IconButton, TONE_TEXT, type ButtonProps, type Tone } from '../../ui';

import { STANCE_TONE, attitudeTone, formatAttitude, type Stance } from './world';

export function StanceChip({ stance }: { stance: Stance }) {
  const t = useTranslations('panelDiplomacy.stance');
  return <Chip tone={STANCE_TONE[stance]}>{t(stance)}</Chip>;
}

/** Colour swatch that stands for a country wherever its name appears. */
export function CountryDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white/20', className)}
      style={{ backgroundColor: color }}
    />
  );
}

/**
 * Attitude on its real −100..100 scale: a bar growing from the centre, with
 * optional tick marks for the thresholds that unlock actions.
 */
export function AttitudeBar({
  attitude,
  marks = [],
  className,
}: {
  attitude: number;
  /** Scale positions (−100..100) worth a tick, e.g. the war threshold. */
  marks?: readonly number[];
  className?: string;
}) {
  const clamped = Math.max(-100, Math.min(100, attitude));
  const tone = attitudeTone(clamped);
  const width = Math.abs(clamped) / 2;
  return (
    <div className={cn('relative h-1.5 rounded-full bg-white/10', className)} aria-hidden>
      <span
        className={cn(
          'absolute top-0 h-full rounded-full transition-[width,left] duration-500',
          tone === 'success' ? 'bg-success' : tone === 'danger' ? 'bg-[#ff5d4d]' : 'bg-white/60',
        )}
        style={{ left: clamped >= 0 ? '50%' : `${50 - width}%`, width: `${Math.max(1.5, width)}%` }}
      />
      <span className="absolute left-1/2 top-[-2px] h-[10px] w-px bg-white/40" />
      {marks.map((m) => (
        <span
          key={m}
          className="absolute top-[-1px] h-2 w-px bg-white/25"
          style={{ left: `${50 + m / 2}%` }}
        />
      ))}
    </div>
  );
}

export function AttitudeValue({ attitude, className }: { attitude: number; className?: string }) {
  return (
    <span className={cn('numeric-tabular font-mono', TONE_TEXT[attitudeTone(attitude)], className)}>
      {formatAttitude(attitude)}
    </span>
  );
}

/** Header of a dossier: who the current target is, and a way to let go of it. */
export function TargetHeader({
  name,
  color,
  caption,
  aside,
  onClear,
}: {
  name: string;
  color: string;
  caption?: ReactNode;
  aside?: ReactNode;
  onClear: () => void;
}) {
  const t = useTranslations('panelDiplomacy.picker');
  return (
    <div className="flex items-start gap-3">
      <span aria-hidden className="mt-0.5 h-9 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="truncate text-base font-semibold leading-tight text-fg">{name}</h3>
          {aside}
        </div>
        {caption ? <p className="mt-0.5 text-[11px] leading-snug text-fg-faint">{caption}</p> : null}
      </div>
      <IconButton icon={X} label={t('clear')} onClick={onClear} className="-mr-1.5 -mt-1.5 h-8 w-8" />
    </div>
  );
}

/**
 * One action the player can take, priced before the click: what it does,
 * and — when it cannot be taken — the reason in place of a dead button.
 */
export function ActionCard({
  title,
  effect,
  blocked,
  cta,
  onAct,
  variant = 'secondary',
  icon,
  testId,
  children,
}: {
  title: ReactNode;
  /** The consequences, in the player's words. */
  effect: ReactNode;
  /** Why the action is unavailable right now. */
  blocked?: ReactNode;
  cta: ReactNode;
  onAct: () => void;
  variant?: ButtonProps['variant'];
  icon?: ButtonProps['icon'];
  testId?: string;
  children?: ReactNode;
}) {
  return (
    <li className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="text-[13px] font-semibold leading-tight text-fg">{title}</h4>
          <p className="mt-1 text-[11px] leading-snug text-fg-muted">{effect}</p>
        </div>
        <Button
          size="sm"
          variant={variant}
          icon={icon}
          disabled={Boolean(blocked)}
          onClick={onAct}
          data-testid={testId}
          className="mt-0.5"
        >
          {cta}
        </Button>
      </div>
      {blocked ? <p className="mt-2 text-[11px] leading-snug text-warning">{blocked}</p> : null}
      {children}
    </li>
  );
}

/** Quiet link to another panel ("recruit agents in Economy"). */
export function PanelLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded text-[11px] font-medium text-accent underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {children}
      <ArrowRight aria-hidden className="h-3 w-3" />
    </button>
  );
}

/** A fact stated as "label ........ value" inside a card. */
export function Fact({
  label,
  children,
  tone = 'neutral',
  words,
}: {
  label: ReactNode;
  children: ReactNode;
  tone?: Tone;
  /** The value is prose ("unknown"), not a figure: set it in the text face. */
  words?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[11px]">
      <dt className="text-fg-faint">{label}</dt>
      <dd className={cn('text-right', words ? 'text-fg-muted' : cn('numeric-tabular font-mono', TONE_TEXT[tone]))}>
        {children}
      </dd>
    </div>
  );
}
