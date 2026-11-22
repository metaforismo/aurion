'use client';

// Aurion UI kit — the only primitives screens should be built from.
// Visual language ("orbital glass"): dark translucent surfaces over the
// planet, one warm accent (gold) for the player and primary actions, cool
// cyan for space/intel, semantic green/amber/red for state. Numbers are
// always tabular mono. See docs/DESIGN.md.

import { Loader2, type LucideIcon } from 'lucide-react';
import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type ComponentType,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SVGProps,
} from 'react';

import { cn } from '../../lib/cn';

export type Tone = 'neutral' | 'accent' | 'info' | 'success' | 'warning' | 'danger';
type IconType = LucideIcon | ComponentType<SVGProps<SVGSVGElement>>;

const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-fg',
  accent: 'text-accent',
  info: 'text-[#8ad8ff]',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-[#ff8a7d]',
};

const TONE_SOFT: Record<Tone, string> = {
  neutral: 'border-white/10 bg-white/[0.04]',
  accent: 'border-accent/30 bg-accent/[0.08]',
  info: 'border-[#5cc8ff]/30 bg-[#5cc8ff]/[0.07]',
  success: 'border-success/30 bg-success/[0.07]',
  warning: 'border-warning/35 bg-warning/[0.08]',
  danger: 'border-[#ff5d4d]/35 bg-[#ff5d4d]/[0.08]',
};

const TONE_FILL: Record<Tone, string> = {
  neutral: 'bg-white/70',
  accent: 'bg-accent',
  info: 'bg-[#5cc8ff]',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-[#ff5d4d]',
};

const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: IconType;
  iconRight?: IconType;
  loading?: boolean;
  block?: boolean;
};

const BUTTON_VARIANT: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-accent text-black hover:bg-accent-strong shadow-[0_6px_20px_-8px_rgba(232,180,90,0.7)] disabled:bg-white/10 disabled:text-fg-faint disabled:shadow-none',
  secondary:
    'border border-white/15 bg-white/[0.05] text-fg hover:border-white/30 hover:bg-white/10 disabled:text-fg-faint disabled:hover:border-white/15 disabled:hover:bg-white/[0.05]',
  ghost: 'text-fg-muted hover:bg-white/[0.07] hover:text-fg disabled:text-fg-faint disabled:hover:bg-transparent',
  danger:
    'border border-[#ff5d4d]/45 bg-[#ff5d4d]/15 text-[#ffb0a6] hover:bg-[#ff5d4d]/25 hover:text-white disabled:opacity-50',
};

const BUTTON_SIZE: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-8 gap-1.5 rounded-lg px-2.5 text-xs',
  md: 'h-10 gap-2 rounded-xl px-4 text-sm',
  lg: 'h-12 gap-2.5 rounded-xl px-6 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon: Icon, iconRight: IconRight, loading, block, className, children, disabled, type, ...rest },
  ref,
) {
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-semibold transition-colors disabled:cursor-not-allowed',
        FOCUS,
        BUTTON_VARIANT[variant],
        BUTTON_SIZE[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 aria-hidden className={cn(iconSize, 'animate-spin')} />
      ) : Icon ? (
        <Icon aria-hidden className={iconSize} />
      ) : null}
      {children}
      {IconRight ? <IconRight aria-hidden className={iconSize} /> : null}
    </button>
  );
});

export function IconButton({
  icon: Icon,
  label,
  className,
  active,
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  icon: IconType;
  /** Accessible name; also shown as the native tooltip. */
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        active ? 'bg-accent/15 text-accent' : 'text-fg-muted hover:bg-white/10 hover:text-fg',
        FOCUS,
        className,
      )}
      {...rest}
    >
      <Icon aria-hidden className="h-4 w-4" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

/** Free-floating glass surface (dialogs, cards over the planet). */
export function Glass({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('glass-panel rounded-2xl', className)} {...rest} />;
}

/** Inset card used INSIDE a glass surface. */
export function Card({
  tone = 'neutral',
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { tone?: Tone }) {
  return <div className={cn('rounded-xl border p-3', TONE_SOFT[tone], className)} {...rest} />;
}

export function SectionTitle({
  children,
  aside,
  className,
}: {
  children: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3', className)}>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-muted">{children}</h3>
      {aside ? <span className="font-mono text-[11px] text-fg-faint">{aside}</span> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data display
// ---------------------------------------------------------------------------

export function Chip({
  tone = 'neutral',
  icon: Icon,
  className,
  children,
}: {
  tone?: Tone;
  icon?: IconType;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-4',
        TONE_SOFT[tone],
        tone === 'neutral' ? 'text-fg-muted' : TONE_TEXT[tone],
        className,
      )}
    >
      {Icon ? <Icon aria-hidden className="h-3 w-3" /> : null}
      {children}
    </span>
  );
}

/** Label over a big tabular number, with an optional delta line. */
export function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
  size = 'md',
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  /** Secondary line under the value (delta, unit, context). */
  hint?: ReactNode;
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="truncate text-[10px] font-medium uppercase tracking-[0.12em] text-fg-faint">{label}</div>
      <div
        className={cn(
          'numeric-tabular truncate font-mono font-semibold leading-tight',
          TONE_TEXT[tone],
          size === 'lg' ? 'text-3xl' : size === 'md' ? 'text-lg' : 'text-sm',
        )}
      >
        {value}
      </div>
      {hint ? <div className="truncate text-[11px] text-fg-faint">{hint}</div> : null}
    </div>
  );
}

/** Horizontal progress / share bar. `value` is 0..1. */
export function Meter({
  value,
  tone = 'accent',
  label,
  valueLabel,
  className,
  thick,
}: {
  value: number;
  tone?: Tone;
  label?: ReactNode;
  valueLabel?: ReactNode;
  className?: string;
  thick?: boolean;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className={className}>
      {label || valueLabel ? (
        <div className="mb-1 flex items-baseline justify-between gap-2 text-[11px]">
          <span className="truncate text-fg-muted">{label}</span>
          <span className="numeric-tabular font-mono text-fg">{valueLabel}</span>
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        className={cn('overflow-hidden rounded-full bg-white/10', thick ? 'h-2' : 'h-1.5')}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-500', TONE_FILL[tone])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  icon?: IconType;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/15 px-4 py-6 text-center',
        className,
      )}
    >
      {Icon ? <Icon aria-hidden className="h-5 w-5 text-fg-faint" /> : null}
      {title ? <p className="text-sm font-medium text-fg">{title}</p> : null}
      {children ? <p className="text-xs leading-relaxed text-fg-faint">{children}</p> : null}
      {action}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-white/15 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-fg-muted">
      {children}
    </kbd>
  );
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
  icon?: IconType;
  disabled?: boolean;
  title?: string;
};

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = 'md',
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  /** Accessible group name. */
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex gap-0.5 rounded-xl border border-white/10 bg-black/30 p-0.5', className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={o.disabled}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-1.5 rounded-[10px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
              size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
              active ? 'bg-white/15 text-fg' : 'text-fg-muted hover:bg-white/[0.07] hover:text-fg',
              FOCUS,
            )}
          >
            {o.icon ? <o.icon aria-hidden className="h-3.5 w-3.5" /> : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Slider({
  label,
  valueLabel,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: ReactNode;
  valueLabel?: ReactNode;
}) {
  const id = useId();
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
        <label htmlFor={id} className="text-fg-muted">
          {label}
        </label>
        <span className="numeric-tabular font-mono text-fg">{valueLabel}</span>
      </div>
      <input id={id} type="range" className="aurion-range w-full" {...rest} />
    </div>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function TextInput({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'h-10 w-full rounded-xl border border-white/12 bg-black/30 px-3 text-sm text-fg placeholder:text-fg-faint',
          'transition-colors hover:border-white/25 focus:border-accent focus:outline-none',
          className,
        )}
        {...rest}
      />
    );
  },
);

/**
 * A row that reads as "name on the left, state/action on the right" — the
 * workhorse for lists of countries, techs, operations, treaties.
 */
export function Row({
  title,
  subtitle,
  leading,
  trailing,
  onClick,
  selected,
  disabled,
  className,
  testId,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  className?: string;
  testId?: string;
}) {
  const body = (
    <>
      {leading ? <span className="shrink-0">{leading}</span> : null}
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[13px] font-medium text-fg">{title}</span>
        {subtitle ? <span className="block truncate text-[11px] text-fg-faint">{subtitle}</span> : null}
      </span>
      {trailing ? <span className="shrink-0">{trailing}</span> : null}
    </>
  );
  const base = cn(
    'flex w-full items-center gap-3 rounded-xl border px-3 py-2 transition-colors',
    selected ? 'border-accent/50 bg-accent/10' : 'border-white/[0.08] bg-white/[0.03]',
    className,
  );
  if (!onClick) {
    return (
      <div data-testid={testId} className={base}>
        {body}
      </div>
    );
  }
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(base, 'hover:border-white/25 hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-50', FOCUS)}
    >
      {body}
    </button>
  );
}

export { TONE_TEXT, TONE_SOFT, TONE_FILL };
