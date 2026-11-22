'use client';

// Shared chrome for every screen outside the play view: the planet turning
// behind the content, the menu music bed, and the top bar. Pages compose
// <MenuFrame> + <MenuTopBar> + their own content.

import { ArrowLeft, Volume2, VolumeX } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { AudioProvider, useAudioOptional, useMusic, useSfx } from '../Audio';
import { IconButton } from '../ui';
import { Link, usePathname, useRouter } from '../../i18n/navigation';
import { routing, type AppLocale } from '../../i18n/routing';
import { cn } from '../../lib/cn';
import type { PlanetBackdropProps } from './PlanetBackdrop';

// Three.js is heavy and needs the DOM: never render it on the server.
const PlanetBackdrop = dynamic(() => import('./PlanetBackdrop'), { ssr: false });

/** `hero` keeps the planet visible beside a narrow column (title screen);
 *  `ambient` dims it evenly behind full-width content. */
type Variant = 'hero' | 'ambient';

const VEIL: Record<Variant, string> = {
  hero: cn(
    'bg-[linear-gradient(180deg,rgba(1,2,6,0.2)_0%,rgba(1,2,6,0.78)_38%,#010206_72%)]',
    'lg:bg-[linear-gradient(90deg,#010206_0%,rgba(1,2,6,0.94)_24%,rgba(1,2,6,0.45)_50%,rgba(1,2,6,0)_72%)]',
  ),
  ambient: cn(
    'bg-[linear-gradient(180deg,rgba(1,2,6,0.78)_0%,rgba(1,2,6,0.9)_100%)]',
    'lg:bg-[linear-gradient(90deg,rgba(1,2,6,0.93)_0%,rgba(1,2,6,0.8)_55%,rgba(1,2,6,0.5)_100%)]',
  ),
};

export function MenuFrame({
  planet,
  variant = 'ambient',
  children,
}: {
  planet: PlanetBackdropProps;
  variant?: Variant;
  children: ReactNode;
}) {
  return (
    <AudioProvider>
      <MenuMusic />
      <div className="relative min-h-dvh w-full bg-[#010206] text-fg">
        <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          <PlanetBackdrop {...planet} />
          <div className={cn('absolute inset-0', VEIL[variant])} />
          {/* Floor fade so footers never sit on bright terrain. */}
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#010206] to-transparent" />
        </div>
        <div className="relative z-10 flex min-h-dvh flex-col">{children}</div>
      </div>
    </AudioProvider>
  );
}

/** Keeps the menu bed playing for as long as a menu page is mounted. */
function MenuMusic() {
  useMusic('music.menu');
  return null;
}

// ---------------------------------------------------------------------------
// Top bar
// ---------------------------------------------------------------------------

export function MenuTopBar({
  backHref = '/',
  children,
}: {
  /** Where the back link goes. Pass null on the title screen. */
  backHref?: string | null;
  /** Optional content between the back link and the controls. */
  children?: ReactNode;
}) {
  const t = useTranslations('menu');
  const tApp = useTranslations('app');
  return (
    <header className="mx-auto flex w-full max-w-[1400px] items-center gap-4 px-4 pt-4 sm:px-8 sm:pt-6">
      {backHref === null ? (
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.34em] text-fg-muted">
          {tApp('name')}
        </span>
      ) : (
        <Link
          href={backHref}
          className={cn(
            'group -ml-2 inline-flex h-9 items-center gap-2 rounded-lg px-2 text-sm text-fg-muted transition-colors',
            'hover:bg-white/[0.07] hover:text-fg',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          )}
        >
          <ArrowLeft
            aria-hidden
            className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 motion-reduce:transform-none"
          />
          {t('backToMenu')}
        </Link>
      )}
      <div className="min-w-0 flex-1">{children}</div>
      <div className="flex shrink-0 items-center gap-1 rounded-2xl bg-black/35 p-1 backdrop-blur-md">
        <SoundToggle />
        <LocaleSwitch />
      </div>
    </header>
  );
}

/** One-tap mute for both music and effects (full mix lives in Settings). */
function SoundToggle() {
  const t = useTranslations('menu');
  const audio = useAudioOptional();
  if (!audio) return null;
  const muted = audio.mutes.music && audio.mutes.sfx;
  return (
    <IconButton
      icon={muted ? VolumeX : Volume2}
      label={muted ? t('soundOn') : t('soundOff')}
      aria-pressed={muted}
      onClick={() => {
        audio.setCategoryMuted('music', !muted);
        audio.setCategoryMuted('sfx', !muted);
      }}
    />
  );
}

/**
 * Language switch. Each locale is a button whose accessible name is the
 * bare code ("it", "en"); the current one is `aria-pressed`.
 */
export function LocaleSwitch({ className }: { className?: string }) {
  const t = useTranslations('menu');
  const router = useRouter();
  const pathname = usePathname();
  const current = useLocale();
  const sfx = useSfx();
  return (
    <div
      role="group"
      aria-label={t('language')}
      className={cn(
        'inline-flex gap-0.5 rounded-xl border border-white/10 bg-black/30 p-0.5',
        className,
      )}
    >
      {routing.locales.map((loc) => {
        const active = loc === current;
        return (
          <button
            key={loc}
            type="button"
            aria-pressed={active}
            title={t(`localeName.${loc}`)}
            onClick={() => {
              if (active) return;
              sfx('sfx.tab');
              router.replace(pathname, { locale: loc as AppLocale });
            }}
            className={cn(
              'rounded-[10px] px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider transition-colors',
              active ? 'bg-white/15 text-fg' : 'text-fg-muted hover:bg-white/[0.07] hover:text-fg',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            )}
          >
            {loc}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page heading shared by the inner pages
// ---------------------------------------------------------------------------

export function PageHeading({
  eyebrow,
  title,
  lead,
  aside,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="min-w-0 max-w-2xl">
        {eyebrow ? (
          <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-balance text-3xl font-bold tracking-tight text-fg sm:text-4xl">
          {title}
        </h1>
        {lead ? (
          <p className="mt-2 text-pretty text-sm leading-relaxed text-fg-muted sm:text-base">
            {lead}
          </p>
        ) : null}
      </div>
      {aside}
    </div>
  );
}
