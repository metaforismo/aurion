'use client';

// Investments: pick where the money goes, pick how much (a share of the
// treasury or an exact figure), read exactly what it buys, confirm.

import { Coins, Factory, FlaskConical, Shield, TrainFront, UserSearch, type LucideIcon } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import type { Country, InvestTarget } from '@aurion/engine';

import { money, percent } from '../../../lib/format';
import { Button, Card, Row, Segmented, TextInput } from '../../ui';

import { EUROS_PER_ARMY_UNIT, INVEST_TARGETS, type InvestPreview } from './model';
import { signedMoney } from './money';

const TARGET_ICON: Record<InvestTarget, LucideIcon> = {
  economy: Factory,
  infra: TrainFront,
  research: FlaskConical,
  military: Shield,
  intel: UserSearch,
};

const SHARES = ['10', '25', '50'] as const;
type Share = (typeof SHARES)[number] | 'custom';

const MILLION = 1_000_000;

export function InvestCard({
  player,
  preview,
  onInvest,
}: {
  player: Country;
  preview: (target: InvestTarget, amount: number) => InvestPreview;
  onInvest: (target: InvestTarget, amount: number) => Promise<boolean>;
}) {
  const t = useTranslations('panelEconomy.invest');
  const locale = useLocale();
  const fmt = useFormatter();
  const customId = useId();
  const [target, setTarget] = useState<InvestTarget>('economy');
  const [share, setShare] = useState<Share>('10');
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const treasury = player.economy.treasury;
  const customMillions = Number(custom.replace(',', '.'));
  const amount =
    share === 'custom'
      ? Number.isFinite(customMillions)
        ? Math.round(customMillions * MILLION)
        : 0
      : Math.max(0, Math.floor((treasury * Number(share)) / 100));

  let blocked: string | null = null;
  if (treasury <= 0) blocked = t('blocked.empty');
  else if (share === 'custom' && custom.trim() === '') blocked = t('blocked.enter');
  else if (amount <= 0) blocked = t('blocked.invalid');
  else if (amount > treasury) blocked = t('blocked.tooMuch', { treasury: money(treasury, locale) });
  else if (target === 'military' && amount < EUROS_PER_ARMY_UNIT) {
    blocked = t('blocked.noUnit', { cost: money(EUROS_PER_ARMY_UNIT, locale) });
  }

  const result = amount > 0 ? preview(target, amount) : null;
  const num = (n: number, digits = 1) => fmt.number(n, { maximumFractionDigits: digits });

  const lines: string[] = [];
  if (result) {
    switch (result.target) {
      case 'economy':
      case 'infra':
        lines.push(
          t('preview.gdp', {
            from: money(player.economy.gdp, locale, 2),
            to: money(player.economy.gdp + result.gdpGain, locale, 2),
          }),
        );
        lines.push(
          result.paybackWeeks !== null
            ? t('preview.income', {
                gain: signedMoney(result.incomeGain, locale, 2),
                weeks: result.paybackWeeks,
              })
            : t('preview.incomeNone'),
        );
        if (result.target === 'infra') {
          lines.push(t('preview.popularity', { points: num(result.popularityGain, 2) }));
        }
        break;
      case 'research':
        lines.push(
          t('preview.research', {
            from: num(player.science.researchOutput),
            to: num(player.science.researchOutput + result.outputGain),
          }),
        );
        break;
      case 'military':
        lines.push(
          t('preview.military', {
            units: fmt.number(result.units),
            total: fmt.number(player.military.armySize + result.units),
          }),
        );
        break;
      case 'intel':
        lines.push(t('preview.spies', { n: result.spies, total: player.intelligence.spyCount + result.spies }));
        lines.push(
          t('preview.counterIntel', {
            from: percent(player.intelligence.counterIntelLevel, locale),
            to: percent(player.intelligence.counterIntelLevel + result.counterIntelGain, locale),
          }),
        );
        break;
    }
    // Say so when recent spending is eating into the return.
    if ('efficiency' in result && result.efficiency < 0.9) {
      lines.push(t('preview.saturated', { pct: percent(result.efficiency, locale) }));
    }
    lines.push(t('preview.treasuryAfter', { value: money(treasury - amount, locale, 2) }));
  }

  const invest = async () => {
    setBusy(true);
    const ok = await onInvest(target, amount);
    setBusy(false);
    setDone(ok ? t('done', { amount: money(amount, locale), target: t(`target.${target}.name`) }) : null);
  };

  return (
    <div className="flex flex-col gap-2" data-testid="economy-invest">
      <div role="group" aria-label={t('targetLabel')} className="flex flex-col gap-1.5">
        {INVEST_TARGETS.map((id) => {
          const Icon = TARGET_ICON[id];
          const selected = id === target;
          return (
            <Row
              key={id}
              testId={`invest-target-${id}`}
              selected={selected}
              onClick={() => {
                setTarget(id);
                setDone(null);
              }}
              leading={<Icon aria-hidden className={selected ? 'h-4 w-4 text-accent' : 'h-4 w-4 text-fg-faint'} />}
              title={t(`target.${id}.name`)}
              subtitle={t(`target.${id}.rate`)}
            />
          );
        })}
      </div>

      <Card className="flex flex-col gap-3">
        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
            <span className="text-fg-muted">{t('amountLabel')}</span>
            <span className="numeric-tabular font-mono text-fg" data-testid="invest-amount">
              {amount > 0 ? money(amount, locale, 2) : '—'}
            </span>
          </div>
          <Segmented<Share>
            label={t('amountLabel')}
            size="sm"
            className="flex w-full"
            value={share}
            onChange={(value) => {
              setShare(value);
              setDone(null);
            }}
            options={[
              ...SHARES.map((s) => ({ value: s, label: `${s}%` })),
              { value: 'custom' as const, label: t('custom') },
            ]}
          />
          {share === 'custom' ? (
            <div className="mt-2">
              <label htmlFor={customId} className="mb-1 block text-[11px] text-fg-faint">
                {t('customLabel')}
              </label>
              <TextInput
                id={customId}
                inputMode="decimal"
                autoComplete="off"
                placeholder={t('customPlaceholder')}
                value={custom}
                onChange={(e) => {
                  setCustom(e.target.value);
                  setDone(null);
                }}
                className="font-mono"
                data-testid="invest-custom"
              />
            </div>
          ) : (
            <p className="mt-1.5 text-[11px] text-fg-faint">{t('shareHint')}</p>
          )}
        </div>

        {lines.length > 0 && !blocked ? (
          <div aria-live="polite" className="border-t border-white/10 pt-3">
            <p className="mb-1 text-[11px] font-medium text-fg-muted">{t('preview.title')}</p>
            <ul className="flex flex-col gap-1 text-[12px] leading-snug text-fg" data-testid="invest-preview">
              {lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div>
          <Button
            variant="primary"
            block
            icon={Coins}
            loading={busy}
            disabled={blocked !== null}
            onClick={() => void invest()}
            data-testid="invest-confirm"
          >
            {amount > 0 && !blocked
              ? t('confirm', { amount: money(amount, locale), target: t(`target.${target}.name`) })
              : t('confirmIdle')}
          </Button>
          {blocked ? (
            <p className="mt-1.5 text-[11px] text-warning" data-testid="invest-blocked">
              {blocked}
            </p>
          ) : null}
          <p role="status" aria-live="polite" className={done ? 'mt-1.5 text-[11px] text-success' : 'sr-only'}>
            {done ?? ''}
          </p>
        </div>
      </Card>
    </div>
  );
}
