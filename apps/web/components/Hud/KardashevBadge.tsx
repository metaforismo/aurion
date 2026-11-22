'use client';

// HUD readout for the long game: the civilisation's Kardashev rating with a
// thin bar toward the next type. Clicking it opens the Cosmos panel.

import { Orbit } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { kardashevType } from '@aurion/engine';

import { useGameStore } from '../../lib/store';

export function KardashevBadge() {
  const t = useTranslations('cosmos.kardashev');
  const rating = useGameStore((s) => s.state?.cosmos?.kardashev);
  const building = useGameStore((s) => s.state?.cosmos?.active.length ?? 0);
  const setSelectedPanel = useGameStore((s) => s.setSelectedPanel);
  if (rating === undefined) return null;

  const type = kardashevType(rating);
  const next = type === 0 ? 1 : type === 1 ? 2 : 3;
  const prev = type === 0 ? 0.7 : type;
  const progress = Math.max(0.04, Math.min(1, (rating - prev) / (next - prev)));

  return (
    <button
      type="button"
      data-testid="hud-kardashev"
      onClick={() => setSelectedPanel('cosmos')}
      title={t('hudHint')}
      aria-label={`${t('title')}: ${rating.toFixed(2)} — ${t(`type.${type}`)}`}
      className="group flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-white/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
    >
      <Orbit
        aria-hidden
        className={`h-4 w-4 text-[#8ad8ff] ${building > 0 ? 'motion-safe:animate-[spin_6s_linear_infinite]' : ''}`}
      />
      <span className="flex flex-col items-start gap-1 leading-none">
        <span className="flex items-baseline gap-1.5">
          <span className="hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-faint xl:inline">
            {t('short')}
          </span>
          <span className="numeric-tabular font-mono text-sm text-fg">{rating.toFixed(2)}</span>
        </span>
        <span aria-hidden className="block h-[3px] w-14 overflow-hidden rounded-full bg-white/10">
          <span
            className="block h-full rounded-full bg-gradient-to-r from-[#5cc8ff] to-accent transition-[width] duration-700"
            style={{ width: `${progress * 100}%` }}
          />
        </span>
      </span>
    </button>
  );
}

export default KardashevBadge;
