// Home-screen chip that summarises cross-game (meta) achievement progress.
// Reads the `achievements` IndexedDB table (see `lib/persistence.ts`) and
// renders a small trophy + `unlocked / total` count. Clicking the chip
// navigates to `/trofei`.
//
// Strict TS: hydration is lazy and tolerant — if persistence isn't available
// (SSR, private browsing without IndexedDB) we render nothing rather than
// flash a "0 / N" pill that suggests the player has never played.

'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { BUILTIN_ACHIEVEMENTS } from '@aurion/engine';

import { Link } from '../../i18n/navigation';
import { cn } from '../../lib/cn';
import { getUnlockedAchievements } from '../../lib/persistence';

export function AchievementCounter() {
  const t = useTranslations('trofei');
  const [unlocked, setUnlocked] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getUnlockedAchievements()
      .then((rows) => {
        if (!cancelled) setUnlocked(rows.length);
      })
      .catch(() => {
        if (!cancelled) setUnlocked(0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const total = BUILTIN_ACHIEVEMENTS.length;

  // Do not surface the counter until we've hydrated AND the player has at
  // least one achievement — keeps the home header quiet for first-time users.
  if (unlocked === null) return null;
  if (total === 0) return null;
  if (unlocked === 0) return null;

  const label = t('counterLabel', { unlocked, total });

  return (
    <Link
      href="/trofei"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/60 px-2.5 py-1',
        'font-mono text-[11px] tabular-nums text-fg-muted transition-colors',
        'hover:border-accent/50 hover:text-accent',
      )}
    >
      <Trophy aria-hidden className="h-3.5 w-3.5 text-accent" />
      <span>
        {unlocked}/{total}
      </span>
    </Link>
  );
}

export default AchievementCounter;
