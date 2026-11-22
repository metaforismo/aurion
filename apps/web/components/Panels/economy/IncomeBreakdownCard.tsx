'use client';

// "Where the money comes from": the weekly income, one line per cause.

import { useLocale, useTranslations } from 'next-intl';

import { cn } from '../../../lib/cn';
import { percent } from '../../../lib/format';
import { Card } from '../../ui';

import { SANCTION_PENALTY, TRADE_DEAL_BONUS, type IncomeBreakdown } from './model';
import { signedMoney } from './money';

type Line = { id: string; label: string; hint: string; value: number };

export function IncomeBreakdownCard({
  breakdown,
  taxRate,
  onOpenDiplomacy,
}: {
  breakdown: IncomeBreakdown;
  taxRate: number;
  onOpenDiplomacy: () => void;
}) {
  const t = useTranslations('panelEconomy.sources');
  const locale = useLocale();
  const b = breakdown;

  const lines: Line[] = [
    { id: 'tax', label: t('tax'), hint: t('taxHint', { rate: Math.round(taxRate) }), value: b.taxTake },
    {
      id: 'sectors',
      label: t('sectors'),
      hint: t('sectorsHint', { pct: percent(b.taxTake > 0 ? b.sectorBonus / b.taxTake : 0, locale, 1) }),
      value: b.sectorBonus,
    },
  ];
  if (b.tradeDeals > 0) {
    lines.push({
      id: 'trade',
      label: t('trade', { n: b.tradeDeals }),
      hint: t('tradeHint', { pct: percent(TRADE_DEAL_BONUS, locale) }),
      value: b.tradeGain,
    });
  }
  if (b.sanctions > 0) {
    lines.push({
      id: 'sanctions',
      label: t('sanctions', { n: b.sanctions }),
      hint: t('sanctionsHint', { pct: percent(SANCTION_PENALTY, locale) }),
      value: b.sanctionLoss,
    });
  }
  if (b.wars > 0) {
    lines.push({ id: 'wars', label: t('wars', { n: b.wars }), hint: t('warsHint'), value: b.warCost });
  }
  if (b.difficultyDelta !== 0) {
    lines.push({ id: 'difficulty', label: t('difficulty'), hint: t('difficultyHint'), value: b.difficultyDelta });
  }
  if (b.policies !== 0) {
    lines.push({ id: 'policies', label: t('policies'), hint: t('policiesHint'), value: b.policies });
  }

  return (
    <Card data-testid="economy-income-breakdown">
      <dl className="flex flex-col gap-2">
        {lines.map((line) => (
          <div key={line.id} className="flex items-baseline justify-between gap-3">
            <dt className="min-w-0">
              <span className="block text-[13px] text-fg">{line.label}</span>
              <span className="block text-[11px] leading-snug text-fg-faint">{line.hint}</span>
            </dt>
            <dd
              className={cn(
                'numeric-tabular shrink-0 font-mono text-[13px]',
                line.value < 0 ? 'text-[#ff8a7d]' : 'text-fg',
              )}
            >
              {signedMoney(line.value, locale)}
            </dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 border-t border-white/10 pt-2">
          <dt className="text-[13px] font-semibold text-fg">{t('net')}</dt>
          <dd
            className={cn(
              'numeric-tabular shrink-0 font-mono text-sm font-semibold',
              b.net < 0 ? 'text-[#ff8a7d]' : 'text-success',
            )}
          >
            {signedMoney(b.net, locale)}
          </dd>
        </div>
      </dl>
      {b.tradeDeals === 0 ? (
        <p className="mt-2 border-t border-white/10 pt-2 text-[11px] leading-snug text-fg-faint">
          {t('noTrade', { pct: percent(TRADE_DEAL_BONUS, locale) })}{' '}
          <button
            type="button"
            onClick={onOpenDiplomacy}
            className="rounded font-medium text-fg-muted underline decoration-white/30 underline-offset-2 transition-colors hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {t('openDiplomacy')}
          </button>
        </p>
      ) : null}
    </Card>
  );
}
