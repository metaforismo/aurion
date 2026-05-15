// HUD button that opens a tiny popover with two volume sliders (Music / SFX)
// and per-category mute checkboxes. Reads + writes through the AudioProvider
// context, which handles persistence + manager wiring.
//
// Visually mirrors the existing MenuButton: 36px square, glass surface
// popover anchored bottom-right, ESC + outside-click to dismiss.

'use client';

import { Volume2, VolumeX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';

import { useAudioOptional } from '../Audio/AudioProvider';
import { cn } from '../../lib/cn';
import type { AudioCategory } from '../../lib/audio';

export function AudioVolumeButton() {
  const audio = useAudioOptional();
  const t = useTranslations('hud.audio');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const node = containerRef.current;
      if (!node) return;
      if (e.target instanceof Node && !node.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on ESC.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Hide the control entirely when no provider is mounted (e.g. an environment
  // that didn't wire AudioProvider). Better than a misleading button that
  // does nothing.
  if (!audio) return null;

  // The visible icon reflects the most aggressive mute: muted only when both
  // categories are silenced. Single-category mute keeps the open icon since
  // sound is still nominally available.
  const fullyMuted = audio.mutes.music && audio.mutes.sfx;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t('volumeButton')}
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-md border border-border-strong bg-surface-1 text-fg-muted transition',
          open ? 'border-accent text-accent' : 'hover:border-border-strong hover:text-fg',
        )}
      >
        {fullyMuted ? (
          <VolumeX className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Volume2 className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
      {open ? <VolumePopover /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Popover body. Pulled out so its hooks (sliders, ids) only mount when open.
// ---------------------------------------------------------------------------

function VolumePopover() {
  const audio = useAudioOptional();
  const t = useTranslations('hud.audio');
  const titleId = useId();

  if (!audio) return null;

  return (
    <div
      role="dialog"
      aria-modal={false}
      aria-labelledby={titleId}
      className="glass-surface absolute right-0 z-30 mt-2 w-64 rounded-lg border border-border-strong bg-surface-1/95 p-3 shadow-2xl backdrop-blur"
    >
      <h3
        id={titleId}
        className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-muted"
      >
        {t('popoverTitle')}
      </h3>
      <div className="flex flex-col gap-3">
        <VolumeRow
          category="music"
          label={t('musicLabel')}
          muteOnLabel={t('mute')}
          muteOffLabel={t('unmute')}
        />
        <VolumeRow
          category="sfx"
          label={t('sfxLabel')}
          muteOnLabel={t('mute')}
          muteOffLabel={t('unmute')}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single category row — slider + mute checkbox + numeric readout.
// ---------------------------------------------------------------------------

type VolumeRowProps = {
  category: AudioCategory;
  label: string;
  muteOnLabel: string;
  muteOffLabel: string;
};

function VolumeRow({
  category,
  label,
  muteOnLabel,
  muteOffLabel,
}: VolumeRowProps) {
  const audio = useAudioOptional();
  const sliderId = useId();
  const muteId = useId();

  if (!audio) return null;

  const value = audio.volumes[category];
  const muted = audio.mutes[category];
  const percent = Math.round(value * 100);

  const handleSlider = (e: ChangeEvent<HTMLInputElement>) => {
    const next = Number(e.target.value) / 100;
    audio.setCategoryVolume(category, next);
  };

  const handleMute = (e: ChangeEvent<HTMLInputElement>) => {
    audio.setCategoryMuted(category, e.target.checked);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label
          htmlFor={sliderId}
          className="text-xs font-semibold text-fg"
        >
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
        disabled={muted}
        aria-label={label}
        className={cn(
          'h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-2 accent-accent transition',
          muted && 'cursor-not-allowed opacity-50',
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
          onChange={handleMute}
          className="h-3 w-3 cursor-pointer accent-accent"
        />
        <span>{muted ? muteOffLabel : muteOnLabel}</span>
      </label>
    </div>
  );
}

export default AudioVolumeButton;
