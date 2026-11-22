'use client';

// Settings: the sound mix (heard live — the menu music is playing while
// you drag), language, a few game preferences, what the display is doing,
// and the data kept on this device.

import { BUILTIN_ACHIEVEMENTS } from '@aurion/engine';
import {
  Download,
  Languages,
  MonitorCog,
  Music,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  Volume2,
  HardDrive,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useState, useSyncExternalStore, type ReactNode } from 'react';

import { useAudio, useSfx, type SfxId } from '../../Audio';
import { Button, Card, Glass, Slider, Stat } from '../../ui';
import { usePathname, useRouter } from '../../../i18n/navigation';
import { routing, type AppLocale } from '../../../i18n/routing';
import { cn } from '../../../lib/cn';
import {
  DEFAULT_REPLAY_RECORDING,
  deleteSave,
  getReplayRecordingPref,
  getUnlockedAchievements,
  isPersistenceAvailable,
  setReplayRecordingPref,
  setTutorialDismissed,
} from '../../../lib/persistence';
import { PageHeading } from '../MenuFrame';
import type { BackdropRenderer } from '../PlanetBackdrop';
import { downloadSave, useSaveList } from '../saves';
import { Switch } from '../Switch';

export function SettingsScreen({ renderer }: { renderer: BackdropRenderer | null }) {
  const t = useTranslations('settings');
  // The server can't know; assume storage works there so hydration matches,
  // then let the browser correct it.
  const persistenceOk = useSyncExternalStore(subscribeNever, isPersistenceAvailable, () => true);

  return (
    <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 pb-16 pt-6 sm:px-8">
      <PageHeading eyebrow={t('eyebrow')} title={t('pageTitle')} lead={t('lead')} />

      {persistenceOk ? null : (
        <Card tone="warning" role="alert" className="mt-6 text-sm text-fg">
          {t('unavailable')}
        </Card>
      )}

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <AudioSection />
          <DisplaySection renderer={renderer} />
        </div>
        <div className="flex flex-col gap-5">
          <LanguageSection />
          {persistenceOk ? (
            <>
              <GameSection />
              <DataSection />
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}

const subscribeNever = () => () => undefined;

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Music;
  title: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <Glass role="region" aria-labelledby={id} className="p-4 sm:p-5">
      <h2
        id={id}
        className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-muted"
      >
        <Icon aria-hidden className="h-3.5 w-3.5 text-accent" />
        {title}
      </h2>
      <div className="flex flex-col gap-4">{children}</div>
    </Glass>
  );
}

/** Label + hint on the left, a control on the right. */
function SettingRow({
  labelId,
  hintId,
  label,
  hint,
  children,
}: {
  labelId?: string;
  hintId?: string;
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p id={labelId} className="text-sm font-medium text-fg">
          {label}
        </p>
        {hint ? (
          <p id={hintId} className="mt-0.5 text-pretty text-xs leading-relaxed text-fg-muted">
            {hint}
          </p>
        ) : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------

const SAMPLES: readonly { id: string; sfx: SfxId }[] = [
  { id: 'confirm', sfx: 'sfx.confirm' },
  { id: 'treaty', sfx: 'sfx.treaty' },
  { id: 'launch', sfx: 'sfx.launch' },
  { id: 'trophy', sfx: 'sfx.achievement' },
];

function AudioSection() {
  const t = useTranslations('settings.audio');
  const locale = useLocale();
  const audio = useAudio();
  const musicId = useId();
  const sfxId = useId();
  const pct = (v: number) => new Intl.NumberFormat(locale, { style: 'percent' }).format(v);

  const channel = (category: 'music' | 'sfx', labelId: string) => {
    const muted = audio.mutes[category];
    const volume = audio.volumes[category];
    return (
      <div className="flex items-end gap-4">
        <Slider
          className="min-w-0 flex-1"
          label={<span id={labelId}>{t(category)}</span>}
          valueLabel={muted ? t('muted') : pct(volume)}
          min={0}
          max={100}
          step={1}
          value={Math.round(volume * 100)}
          disabled={audio.hydrating || muted}
          onChange={(e) => audio.setCategoryVolume(category, Number(e.target.value) / 100)}
          // Let the player hear the level they just set.
          onPointerUp={category === 'sfx' ? () => audio.play('sfx.click') : undefined}
          onKeyUp={category === 'sfx' ? () => audio.play('sfx.click') : undefined}
        />
        <div className="flex flex-col items-center gap-1 pb-0.5">
          <span
            id={`${labelId}-on`}
            className="text-[10px] uppercase tracking-[0.12em] text-fg-faint"
          >
            {t('on')}
          </span>
          <Switch
            checked={!muted}
            disabled={audio.hydrating}
            labelledBy={`${labelId} ${labelId}-on`}
            onChange={(on) => audio.setCategoryMuted(category, !on)}
          />
        </div>
      </div>
    );
  };

  return (
    <Section icon={Volume2} title={t('title')}>
      {channel('music', musicId)}
      {channel('sfx', sfxId)}
      <div>
        <p className="mb-2 text-xs text-fg-muted">{t('tryLabel')}</p>
        <div className="flex flex-wrap gap-2">
          {SAMPLES.map((sample) => (
            <Button
              key={sample.id}
              size="sm"
              icon={Play}
              disabled={audio.mutes.sfx}
              title={audio.mutes.sfx ? t('tryMuted') : undefined}
              onClick={() => audio.play(sample.sfx)}
            >
              {t(`sample.${sample.id}`)}
            </Button>
          ))}
        </div>
      </div>
      <p className="text-pretty text-[11px] leading-relaxed text-fg-faint">{t('note')}</p>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Language
// ---------------------------------------------------------------------------

function LanguageSection() {
  const t = useTranslations('settings.language');
  const tMenu = useTranslations('menu');
  const router = useRouter();
  const pathname = usePathname();
  const current = useLocale();
  const sfx = useSfx();
  return (
    <Section icon={Languages} title={t('title')}>
      <div role="radiogroup" aria-label={t('title')} className="grid grid-cols-2 gap-2">
        {routing.locales.map((loc) => {
          const active = loc === current;
          return (
            <button
              key={loc}
              type="button"
              role="radio"
              aria-checked={active}
              lang={loc}
              onClick={() => {
                if (active) return;
                sfx('sfx.confirm');
                router.replace(pathname, { locale: loc as AppLocale });
              }}
              className={cn(
                'flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                active
                  ? 'border-accent/60 bg-accent/10'
                  : 'border-white/[0.09] bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              )}
            >
              <span
                className={cn(
                  'font-mono text-[11px] font-semibold uppercase',
                  active ? 'text-accent' : 'text-fg-faint',
                )}
              >
                {loc}
              </span>
              <span className="text-sm font-medium text-fg">{tMenu(`localeName.${loc}`)}</span>
            </button>
          );
        })}
      </div>
      <p className="text-pretty text-[11px] leading-relaxed text-fg-faint">{t('note')}</p>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Game
// ---------------------------------------------------------------------------

function GameSection() {
  const t = useTranslations('settings.game');
  const sfx = useSfx();
  const replayLabel = useId();
  const replayHint = useId();
  const [replay, setReplay] = useState<boolean | null>(null);
  const [tutorialReset, setTutorialReset] = useState<'idle' | 'done' | 'failed'>('idle');

  useEffect(() => {
    let cancelled = false;
    getReplayRecordingPref()
      .then((v) => !cancelled && setReplay(v))
      .catch(() => !cancelled && setReplay(DEFAULT_REPLAY_RECORDING));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Section icon={SlidersHorizontal} title={t('title')}>
      <SettingRow
        labelId={replayLabel}
        hintId={replayHint}
        label={t('replay')}
        hint={t('replayHint')}
      >
        <Switch
          checked={replay === true}
          disabled={replay === null}
          labelledBy={replayLabel}
          describedBy={replayHint}
          onChange={(next) => {
            setReplay(next);
            // Best effort: a failed write is corrected on the next visit.
            void setReplayRecordingPref(next).catch(() => undefined);
          }}
        />
      </SettingRow>
      <SettingRow label={t('tutorial')} hint={t('tutorialHint')}>
        <Button
          size="sm"
          icon={RotateCcw}
          disabled={tutorialReset === 'done'}
          onClick={() => {
            setTutorialDismissed(false)
              .then(() => {
                sfx('sfx.confirm');
                setTutorialReset('done');
              })
              .catch(() => {
                sfx('sfx.error');
                setTutorialReset('failed');
              });
          }}
        >
          {t('tutorialReset')}
        </Button>
      </SettingRow>
      <p
        aria-live="polite"
        className={cn('text-xs', tutorialReset === 'failed' ? 'text-[#ffb0a6]' : 'text-success')}
      >
        {tutorialReset === 'done'
          ? t('tutorialDone')
          : tutorialReset === 'failed'
            ? t('tutorialFailed')
            : ''}
      </p>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

/** Brand names of the live backends; the still fallback is translated. */
const RENDERER_NAME: Partial<Record<BackdropRenderer, string>> = {
  webgpu: 'WebGPU',
  webgl2: 'WebGL 2',
};

const MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeMotion(onChange: () => void) {
  const mq = window.matchMedia(MOTION_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

function DisplaySection({ renderer }: { renderer: BackdropRenderer | null }) {
  const t = useTranslations('settings.display');
  const reduced = useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(MOTION_QUERY).matches,
    () => false,
  );
  return (
    <Section icon={MonitorCog} title={t('title')}>
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <Stat
            label={t('motion')}
            value={reduced ? t('motionReduced') : t('motionFull')}
            tone={reduced ? 'info' : 'neutral'}
          />
        </Card>
        <Card>
          <Stat
            label={t('renderer')}
            value={renderer === null ? '…' : (RENDERER_NAME[renderer] ?? t('rendererStatic'))}
            tone={renderer === 'webgpu' ? 'success' : renderer === 'static' ? 'warning' : 'neutral'}
          />
        </Card>
      </div>
      <p className="text-pretty text-xs leading-relaxed text-fg-muted">
        {reduced ? t('motionReducedHint') : t('motionFullHint')}
      </p>
      <p className="text-pretty text-[11px] leading-relaxed text-fg-faint">
        {renderer === 'static'
          ? t('rendererStaticNote')
          : renderer === 'webgl2'
            ? t('rendererFallback')
            : t('rendererNote')}
      </p>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Data on this device
// ---------------------------------------------------------------------------

/** "412 kB" / "3,4 MB" — storage sizes in the reader's locale. */
function formatBytes(bytes: number, locale: string): string {
  const mega = bytes >= 1_000_000;
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: mega ? 'megabyte' : 'kilobyte',
    maximumFractionDigits: mega ? 1 : 0,
  }).format(bytes / (mega ? 1_000_000 : 1_000));
}

function DataSection() {
  const t = useTranslations('settings.data');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const sfx = useSfx();
  const { saves, refresh } = useSaveList();
  const [trophies, setTrophies] = useState<number | null>(null);
  const [bytes, setBytes] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getUnlockedAchievements()
      .then((rows) => !cancelled && setTrophies(rows.length))
      .catch(() => !cancelled && setTrophies(0));
    return () => {
      cancelled = true;
    };
  }, []);

  // Storage use changes with the save list, so re-measure when it does.
  useEffect(() => {
    let cancelled = false;
    void navigator.storage
      ?.estimate?.()
      .then((estimate) => !cancelled && setBytes(estimate.usage ?? null))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [saves]);

  const count = saves?.length ?? 0;

  const exportAll = async () => {
    if (!saves) return;
    setBusy(true);
    setMessage(null);
    try {
      for (const save of saves) await downloadSave(save);
      sfx('sfx.confirm');
      setMessage({ tone: 'ok', text: t('exportDone', { count: saves.length }) });
    } catch {
      sfx('sfx.error');
      setMessage({ tone: 'error', text: t('exportFailed') });
    } finally {
      setBusy(false);
    }
  };

  const deleteAll = async () => {
    if (!saves) return;
    setBusy(true);
    setMessage(null);
    try {
      for (const save of saves) await deleteSave(save.id);
      sfx('sfx.confirm');
      setMessage({ tone: 'ok', text: t('deleteDone') });
    } catch {
      sfx('sfx.error');
      setMessage({ tone: 'error', text: t('deleteFailed') });
    } finally {
      await refresh();
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <Section icon={HardDrive} title={t('title')}>
      <div className="grid grid-cols-3 gap-3">
        <Stat label={t('saves')} value={saves === null ? '…' : count} />
        <Stat
          label={t('trophies')}
          value={trophies === null ? '…' : `${trophies}/${BUILTIN_ACHIEVEMENTS.length}`}
        />
        <Stat label={t('space')} value={bytes === null ? '—' : formatBytes(bytes, locale)} />
      </div>
      <p className="text-pretty text-xs leading-relaxed text-fg-muted">{t('note')}</p>

      {confirming ? (
        <Card
          tone="danger"
          role="alertdialog"
          aria-label={t('deleteTitle')}
          className="flex flex-col gap-3"
        >
          <div>
            <p className="text-sm font-medium text-fg">{t('deleteTitle')}</p>
            <p className="mt-0.5 text-pretty text-xs leading-relaxed text-fg-muted">
              {t('deleteBody', { count })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="danger"
              size="sm"
              icon={Trash2}
              loading={busy}
              onClick={() => void deleteAll()}
            >
              {t('deleteConfirm', { count })}
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirming(false)}>
              {tCommon('cancel')}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            icon={Download}
            disabled={count === 0 || busy}
            title={count === 0 ? t('nothingToExport') : t('exportHint')}
            onClick={() => void exportAll()}
          >
            {t('exportAll')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={Trash2}
            disabled={count === 0 || busy}
            title={count === 0 ? t('nothingToDelete') : undefined}
            onClick={() => setConfirming(true)}
          >
            {t('deleteAll')}
          </Button>
        </div>
      )}
      {count === 0 && saves !== null ? (
        <p className="text-[11px] text-fg-faint">{t('empty')}</p>
      ) : null}
      <p
        aria-live="polite"
        className={cn('text-xs', message?.tone === 'error' ? 'text-[#ffb0a6]' : 'text-success')}
      >
        {message?.text ?? ''}
      </p>
    </Section>
  );
}
