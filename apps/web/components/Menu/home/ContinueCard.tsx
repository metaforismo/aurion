'use client';

// The save you were playing: who, where, when — and one button to go back.

import { ArrowRight } from 'lucide-react';
import { useFormatter, useLocale, useNow, useTranslations } from 'next-intl';
import { kardashevType } from '@aurion/engine';

import { Chip, Glass, Meter } from '../../ui';
import { useScenarioMessages } from '../../Panels/shared/useScenarioMessages';
import { Link } from '../../../i18n/navigation';
import { cn } from '../../../lib/cn';
import type { SaveSummary } from '../../../lib/persistence';
import { getScenarioMeta, type ScenarioId } from '../../../lib/scenarios';
import { kardashevProgress, modeMeta } from '../modes';
import { gameDate, useSaveDigest } from '../saves';

export function ContinueCard({ save }: { save: SaveSummary }) {
  const t = useTranslations('home');
  const tMenu = useTranslations('menu');
  const tModes = useTranslations('modes');
  const tAll = useTranslations();
  const locale = useLocale();
  const format = useFormatter();
  const now = useNow();
  const digest = useSaveDigest(save);
  const { t: tScenario } = useScenarioMessages(save.scenarioId as ScenarioId);

  const meta = getScenarioMeta(save.scenarioId);
  const world = meta && tAll.has(meta.nameKey) ? tAll(meta.nameKey) : save.scenarioId;
  const finished = digest ? digest.outcome !== 'playing' : false;
  const difficultyKey = digest ? `difficulty.${digest.difficultyId}.name` : '';

  return (
    <Glass
      className="relative overflow-hidden p-4"
      style={{ animation: 'rise-in 420ms 60ms cubic-bezier(0, 0, 0.2, 1) both' }}
    >
      {/* The nation's colour, as a quiet edge light. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: digest?.nationColor ?? save.thumbnailColor }}
      />
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
          {t('continue')}
        </h2>
        <span className="truncate font-mono text-[11px] text-fg-faint">
          {t('savedAgo', { when: format.relativeTime(new Date(save.savedAt), now) })}
        </span>
      </div>

      <p className="mt-2 truncate text-2xl font-semibold tracking-tight text-fg">
        {digest ? tScenario(digest.nationKey) : save.name}
      </p>
      <p className="truncate text-sm text-fg-muted">
        {digest ? `${world} · ${tMenu('gameDate', gameDate(digest.tick))}` : world}
      </p>

      <div className="mt-3 flex min-h-[22px] flex-wrap items-center gap-1.5">
        {digest ? (
          <>
            <Chip tone="accent" icon={modeMeta(digest.gameMode).icon}>
              {tModes(`${modeMeta(digest.gameMode).key}.name`)}
            </Chip>
            <Chip tone={digest.difficultyId === 'ironMan' ? 'danger' : 'neutral'}>
              {tAll.has(difficultyKey) ? tAll(difficultyKey) : digest.difficultyId}
            </Chip>
            <Chip>{t('economyRank', { rank: digest.gdpRank, total: digest.nations })}</Chip>
            {digest.outcome === 'won' ? <Chip tone="success">{tMenu('outcome.won')}</Chip> : null}
            {digest.outcome === 'lost' ? <Chip tone="danger">{tMenu('outcome.lost')}</Chip> : null}
          </>
        ) : null}
      </div>

      {digest && digest.kardashev !== null ? (
        <Meter
          className="mt-3"
          tone="info"
          value={kardashevProgress(digest.kardashev)}
          label={tAll(`cosmos.kardashev.type.${kardashevType(digest.kardashev)}`)}
          valueLabel={`K ${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(digest.kardashev)}`}
        />
      ) : null}

      <Link
        href={`/play/${encodeURIComponent(save.id)}`}
        data-menu-item
        data-testid="continue-latest"
        className={cn(
          'mt-3.5 inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-xl bg-accent px-6 text-base font-semibold text-black transition-colors',
          'shadow-[0_6px_20px_-8px_rgba(232,180,90,0.7)] hover:bg-accent-strong',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        )}
      >
        {finished ? t('reviewGame') : t('resume')}
        <ArrowRight aria-hidden className="h-4 w-4" />
      </Link>
    </Glass>
  );
}
