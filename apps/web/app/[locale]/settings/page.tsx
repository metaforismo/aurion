// Settings page. Home for the cross-game preferences that previously had no
// surface outside a running game (audio defaults, replay recording, tutorial
// reset) plus the language switch. Everything persists to the IndexedDB meta
// table via lib/persistence so the values survive across saves and sessions.

'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';

import { Link, usePathname, useRouter } from '../../../i18n/navigation';
import { routing, type AppLocale } from '../../../i18n/routing';
import { cn } from '../../../lib/cn';
import {
  DEFAULT_AUDIO_VOLUMES,
  DEFAULT_REPLAY_RECORDING,
  getAudioVolumes,
  getReplayRecordingPref,
  isPersistenceAvailable,
  setAudioVolumes,
  setReplayRecordingPref,
  setTutorialDismissed,
  type AudioVolumePrefs,
} from '../../../lib/persistence';

/** Debounce window for slider-driven writes so a drag doesn't spam the DB. */
const PERSIST_DEBOUNCE_MS = 250;

export default function SettingsPage() {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');

  const persistenceOk = isPersistenceAvailable();

  return (
    <main
      className={cn(
        'relative min-h-screen w-full bg-bg',
        'bg-gradient-to-b from-bg via-bg to-surface-1/40',
      )}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-tight text-fg sm:text-4xl">
            {t('pageTitle')}
          </h1>
          <Link href="/" className="text-sm text-fg-muted hover:text-fg">
            ← {tCommon('back')}
          </Link>
        </header>

        {persistenceOk ? (
          <>
            <AudioSection />
            <GameplaySection />
          </>
        ) : (
          <p className="rounded-md border border-warning/50 bg-warning/15 px-3 py-2 text-sm text-warning">
            {t('unavailable')}
          </p>
        )}

        <LanguageSection />
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Shared section chrome — mirrors the AchievementsList card.
// ---------------------------------------------------------------------------

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="flex flex-col gap-4 border border-border bg-bg p-4"
    >
      <header className="border-b border-border pb-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
          {title}
        </h2>
      </header>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Audio defaults
// ---------------------------------------------------------------------------

function AudioSection() {
  const t = useTranslations('settings');
  const tAudio = useTranslations('hud.audio');

  // null until hydrated from IndexedDB — sliders render disabled meanwhile so
  // the first interactive state always reflects the persisted values.
  const [prefs, setPrefs] = useState<AudioVolumePrefs | null>(null);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAudioVolumes()
      .then((p) => {
        if (!cancelled) setPrefs(p);
      })
      .catch(() => {
        if (!cancelled) setPrefs({ ...DEFAULT_AUDIO_VOLUMES });
      });
    return () => {
      cancelled = true;
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, []);

  const update = (patch: Partial<AudioVolumePrefs>) => {
    setPrefs((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      if (persistTimer.current) clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(() => {
        void setAudioVolumes(next).catch(() => {
          // Best-effort: a failed write leaves the previous value, which the
          // page re-reads on next mount.
        });
      }, PERSIST_DEBOUNCE_MS);
      return next;
    });
  };

  return (
    <SettingsSection title={t('audioTitle')}>
      <VolumeRow
        label={tAudio('musicLabel')}
        muteOnLabel={tAudio('mute')}
        muteOffLabel={tAudio('unmute')}
        value={prefs?.music ?? DEFAULT_AUDIO_VOLUMES.music}
        muted={prefs?.mutedMusic === true}
        disabled={prefs === null}
        onVolume={(v) => update({ music: v })}
        onMute={(m) => update({ mutedMusic: m })}
      />
      <VolumeRow
        label={tAudio('sfxLabel')}
        muteOnLabel={tAudio('mute')}
        muteOffLabel={tAudio('unmute')}
        value={prefs?.sfx ?? DEFAULT_AUDIO_VOLUMES.sfx}
        muted={prefs?.mutedSfx === true}
        disabled={prefs === null}
        onVolume={(v) => update({ sfx: v })}
        onMute={(m) => update({ mutedSfx: m })}
      />
    </SettingsSection>
  );
}

/**
 * Slider + mute row. Mirrors the in-game `AudioVolumeButton` popover row so
 * the two surfaces feel like the same control, but binds to the persisted
 * prefs directly (no AudioProvider here — there is no game running).
 */
function VolumeRow({
  label,
  muteOnLabel,
  muteOffLabel,
  value,
  muted,
  disabled,
  onVolume,
  onMute,
}: {
  label: string;
  muteOnLabel: string;
  muteOffLabel: string;
  value: number;
  muted: boolean;
  disabled: boolean;
  onVolume: (value: number) => void;
  onMute: (muted: boolean) => void;
}) {
  const sliderId = useId();
  const muteId = useId();
  const percent = Math.round(value * 100);

  const handleSlider = (e: ChangeEvent<HTMLInputElement>) => {
    onVolume(Number(e.target.value) / 100);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={sliderId} className="text-xs font-semibold text-fg">
          {label}
        </label>
        <span className="numeric-tabular font-mono text-[10px] text-fg-faint">
          {muted ? '—' : `${percent}%`}
        </span>
      </div>
      <input
        id={sliderId}
        type="range"
        min={0}
        max={100}
        step={1}
        value={percent}
        onChange={handleSlider}
        disabled={disabled || muted}
        aria-label={label}
        className={cn(
          'h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-2 accent-accent transition',
          (disabled || muted) && 'cursor-not-allowed opacity-50',
        )}
      />
      <label
        htmlFor={muteId}
        className="flex items-center gap-2 text-[11px] text-fg-muted"
      >
        <input
          id={muteId}
          type="checkbox"
          checked={muted}
          onChange={(e) => onMute(e.target.checked)}
          disabled={disabled}
          className="h-3 w-3 cursor-pointer accent-accent"
        />
        <span>{muted ? muteOffLabel : muteOnLabel}</span>
      </label>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gameplay
// ---------------------------------------------------------------------------

function GameplaySection() {
  const t = useTranslations('settings');
  const replayId = useId();

  const [replay, setReplay] = useState<boolean | null>(null);
  const [tutorialResetDone, setTutorialResetDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getReplayRecordingPref()
      .then((v) => {
        if (!cancelled) setReplay(v);
      })
      .catch(() => {
        if (!cancelled) setReplay(DEFAULT_REPLAY_RECORDING);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleReplayToggle = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.checked;
    setReplay(next);
    void setReplayRecordingPref(next).catch(() => {
      // Best-effort; re-read on next mount restores the truth.
    });
  };

  const handleTutorialReset = () => {
    void setTutorialDismissed(false)
      .then(() => setTutorialResetDone(true))
      .catch(() => {
        // Persistence failed — leave the button armed so the user can retry.
      });
  };

  return (
    <SettingsSection title={t('gameplayTitle')}>
      <div className="flex items-start justify-between gap-4">
        <label htmlFor={replayId} className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs font-semibold text-fg">
            {t('replayRecording')}
          </span>
          <span className="text-[11px] leading-snug text-fg-muted">
            {t('replayRecordingHint')}
          </span>
        </label>
        <input
          id={replayId}
          type="checkbox"
          checked={replay === true}
          onChange={handleReplayToggle}
          disabled={replay === null}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-accent disabled:cursor-not-allowed"
        />
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
        {tutorialResetDone ? (
          <p role="status" className="text-xs text-success">
            {t('tutorialResetDone')}
          </p>
        ) : (
          <button
            type="button"
            onClick={handleTutorialReset}
            className="rounded-sm border border-border px-3 py-1.5 text-xs font-semibold text-fg transition hover:border-border-strong focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          >
            {t('tutorialReset')}
          </button>
        )}
      </div>
    </SettingsSection>
  );
}

// ---------------------------------------------------------------------------
// Language
// ---------------------------------------------------------------------------

function LanguageSection() {
  const t = useTranslations('settings');
  const tHome = useTranslations('home');
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = useLocale();

  return (
    <SettingsSection title={t('languageTitle')}>
      <div
        role="group"
        aria-label={tHome('languageSwitch')}
        className="flex items-center gap-2"
      >
        {routing.locales.map((loc) => {
          const isActive = loc === currentLocale;
          return (
            <button
              key={loc}
              type="button"
              aria-pressed={isActive}
              onClick={() => {
                if (isActive) return;
                router.replace(pathname, { locale: loc as AppLocale });
              }}
              className={cn(
                'rounded-sm border px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition',
                isActive
                  ? 'border-accent bg-accent/15 text-fg'
                  : 'border-border text-fg-muted hover:border-border-strong hover:text-fg',
              )}
            >
              {loc}
            </button>
          );
        })}
      </div>
    </SettingsSection>
  );
}
