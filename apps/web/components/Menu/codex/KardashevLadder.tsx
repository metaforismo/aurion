'use client';

// The megaproject ladder, Earth to the stars, with the three moments that
// define the long game marked on it.

import { useTranslations } from 'next-intl';

import { Chip } from '../../ui';
import { cn } from '../../../lib/cn';

/** Stage index → the milestone reached by finishing that stage's capstone. */
const MILESTONE: Partial<Record<number, 'typeI' | 'typeII' | 'colony'>> = {
  3: 'typeI',
  5: 'typeII',
  6: 'colony',
};
const STAGES = [0, 1, 2, 3, 4, 5, 6] as const;

export function KardashevLadder() {
  const t = useTranslations('guide.cosmos');
  const tCosmos = useTranslations('cosmos.stages');
  return (
    <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7 lg:gap-0" aria-label={t('ladderLabel')}>
      {STAGES.map((stage) => {
        const milestone = MILESTONE[stage];
        return (
          <li key={stage} className="relative flex gap-3 lg:flex-col lg:gap-0 lg:pr-3">
            {/* rail: a dot per stage, joined by a line on wide screens */}
            <div className="flex flex-col items-center lg:mb-3 lg:flex-row">
              <span
                aria-hidden
                className={cn(
                  'grid h-7 w-7 shrink-0 place-items-center rounded-full border font-mono text-[11px] font-semibold',
                  milestone
                    ? 'border-[#5cc8ff] bg-[#5cc8ff]/15 text-[#8ad8ff]'
                    : 'border-white/25 bg-white/[0.04] text-fg-muted',
                )}
              >
                {stage + 1}
              </span>
              {stage < STAGES.length - 1 ? (
                <span
                  aria-hidden
                  className="hidden h-px flex-1 bg-gradient-to-r from-white/30 to-white/10 lg:block"
                />
              ) : null}
            </div>
            <div className="min-w-0 pb-1">
              <h3 className="text-sm font-semibold text-fg">{tCosmos(`${stage}.name`)}</h3>
              <p className="text-pretty text-[11px] leading-relaxed text-fg-faint">
                {tCosmos(`${stage}.hint`)}
              </p>
              {milestone ? (
                <Chip tone="info" className="mt-1.5">
                  {t(`milestone.${milestone}`)}
                </Chip>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
