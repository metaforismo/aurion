'use client';

// Tax policy: scrub the rate, read what it does to income and to each
// faction, then apply. Nothing is sent to the engine until "Apply" — a tax
// change moves faction satisfaction for real, so it should be a decision.

import { Check, RotateCcw } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import type { FactionId } from '@aurion/engine';

import { Button, Card, Chip, Slider } from '../../ui';

import { TAX_FACTION_EFFECT } from './model';
import { signedMoney } from './money';

const FACTIONS = Object.keys(TAX_FACTION_EFFECT) as FactionId[];

export function TaxCard({
  rate,
  currentNet,
  projectNet,
  onApply,
}: {
  /** The rate in force. */
  rate: number;
  currentNet: number;
  /** Net weekly income at a hypothetical rate. */
  projectNet: (rate: number) => number;
  onApply: (rate: number) => Promise<boolean>;
}) {
  const t = useTranslations('panelEconomy.tax');
  const tFaction = useTranslations('panelPolitics.faction');
  const locale = useLocale();
  const [pending, setPending] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState<number | null>(null);

  const live = pending ?? rate;
  const changed = pending !== null && pending !== rate;
  const delta = live - rate;
  const incomeDelta = projectNet(live) - currentNet;
  const points = new Intl.NumberFormat(locale, { maximumFractionDigits: 1, signDisplay: 'always' });

  const reactions = FACTIONS.map((id) => ({ id, value: TAX_FACTION_EFFECT[id] * delta })).sort(
    (a, b) => a.value - b.value,
  );

  const apply = async () => {
    setBusy(true);
    const ok = await onApply(live);
    setBusy(false);
    if (ok) {
      setApplied(live);
      setPending(null);
    }
  };

  return (
    <Card data-testid="economy-tax">
      <Slider
        label={t('label')}
        valueLabel={`${Math.round(live)}%`}
        min={0}
        max={100}
        step={1}
        value={live}
        onChange={(e) => {
          setPending(Number(e.target.value));
          setApplied(null);
        }}
        data-testid="economy-tax-slider"
      />
      <div className="mt-1 flex justify-between font-mono text-[10px] text-fg-faint" aria-hidden>
        <span>0%</span>
        <span>{t('inForce', { rate: Math.round(rate) })}</span>
        <span>100%</span>
      </div>

      {changed ? (
        <div className="mt-3 flex flex-col gap-2 border-t border-white/10 pt-3">
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="text-fg-muted">{t('incomeChange')}</span>
            <span className={`numeric-tabular font-mono ${incomeDelta < 0 ? 'text-[#ff8a7d]' : 'text-success'}`}>
              {signedMoney(incomeDelta, locale)} {t('perWeek')}
            </span>
          </div>
          <div>
            <p className="mb-1.5 text-[11px] text-fg-faint">{t('reactions')}</p>
            <ul className="flex flex-wrap gap-1">
              {reactions.map((r) => (
                <li key={r.id}>
                  <Chip tone={r.value < 0 ? 'danger' : 'success'}>
                    {tFaction(`${r.id}.name`)} {points.format(r.value).replace('-', '−')}
                  </Chip>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              icon={Check}
              loading={busy}
              onClick={() => void apply()}
              data-testid="economy-tax-apply"
            >
              {t('apply', { rate: Math.round(live) })}
            </Button>
            <Button variant="ghost" icon={RotateCcw} onClick={() => setPending(null)}>
              {t('reset')}
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-3 border-t border-white/10 pt-3 text-[11px] leading-snug text-fg-faint">{t('tradeOff')}</p>
      )}

      <p role="status" aria-live="polite" className={applied === null ? 'sr-only' : 'mt-2 text-[11px] text-success'}>
        {applied === null ? '' : t('applied', { rate: Math.round(applied) })}
      </p>
    </Card>
  );
}
