'use client';

// Step 3 — the nation you lead, with the numbers it starts from and an
// honest read on how hard that start is.

import { Radiation } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { Scenario } from '@aurion/engine';

import { Chip, EmptyState, Stat, type Tone } from '../../ui';
import { useScenarioMessages } from '../../Panels/shared/useScenarioMessages';
import { cn } from '../../../lib/cn';
import { compactNumber, money, percent } from '../../../lib/format';
import { gdpLadder, nationFacts, type NationFacts, type StartLevel } from './insight';
import { OptionCard, RadioCards } from './OptionCard';
import type { StepProps } from './plan';

export const START_TONE: Record<StartLevel, Tone> = {
  gentle: 'success',
  balanced: 'neutral',
  steep: 'warning',
};

export function NationStep({ plan, resolved, failed, update }: StepProps) {
  const t = useTranslations('setup');
  const tErrors = useTranslations('errors');
  const { scenario, nationId } = resolved;

  if (failed.has(plan.worldId)) {
    return <EmptyState title={tErrors('scenarioNotFound')}>{t('nation.failed')}</EmptyState>;
  }
  if (!scenario) {
    return (
      <div aria-busy="true" className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="h-56 animate-pulse rounded-xl bg-white/[0.04] motion-reduce:animate-none"
          />
        ))}
      </div>
    );
  }

  return (
    <RadioCards
      label={t('steps.nation.label')}
      className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3"
    >
      {scenario.playableCountries.map((id) => {
        const facts = nationFacts(scenario, id);
        if (!facts) return null;
        return (
          <NationCard
            key={id}
            scenario={scenario}
            facts={facts}
            checked={id === nationId}
            onSelect={() =>
              update('nation', (prev) => ({
                ...prev,
                nationByWorld: { ...prev.nationByWorld, [prev.worldId]: id },
              }))
            }
          />
        );
      })}
    </RadioCards>
  );
}

function NationCard({
  scenario,
  facts,
  checked,
  onSelect,
}: {
  scenario: Scenario;
  facts: NationFacts;
  checked: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations('setup');
  const locale = useLocale();
  const { t: tScenario } = useScenarioMessages(
    scenario.id as Parameters<typeof useScenarioMessages>[0],
  );
  const { country } = facts;

  return (
    <OptionCard
      testId={`country-option-${country.id}`}
      checked={checked}
      onSelect={onSelect}
      leading={
        <span
          aria-hidden
          className="mt-0.5 h-9 w-9 shrink-0 rounded-lg border border-white/15"
          style={{ backgroundColor: country.color, boxShadow: `0 0 18px -6px ${country.color}` }}
        />
      }
      title={tScenario(country.nameKey)}
      description={t('nation.summary', {
        capital: tScenario(country.capitalKey),
        government: t(`nation.government.${country.politics.governmentType}`),
        popularity: percent(country.politics.popularity / 100, locale),
      })}
      badges={
        country.nuclear ? (
          <Chip tone="warning" icon={Radiation}>
            {t('nation.nuclear')}
          </Chip>
        ) : null
      }
    >
      <span className="@container block w-full border-t border-white/[0.07] pt-3">
        <span className="grid grid-cols-2 gap-x-4 gap-y-2.5 @sm:grid-cols-4">
          <Stat
            size="sm"
            label={t('nation.gdp')}
            value={money(country.economy.gdp, locale)}
            hint={t('nation.rank', { rank: facts.gdpRank, total: facts.nations })}
          />
          <Stat
            size="sm"
            label={t('nation.forces')}
            value={compactNumber(facts.forces, locale)}
            hint={t('nation.rank', { rank: facts.armyRank, total: facts.nations })}
          />
          <Stat
            size="sm"
            label={t('nation.treasury')}
            value={money(country.economy.treasury, locale)}
          />
          <Stat
            size="sm"
            label={t('nation.population')}
            value={compactNumber(country.population, locale)}
          />
        </span>
      </span>

      <GdpStrip scenario={scenario} countryId={country.id} />

      <span className="flex w-full items-start gap-2">
        <Chip tone={START_TONE[facts.start]} className="shrink-0">
          {t(`nation.start.${facts.start}.label`)}
        </Chip>
        <span className="text-[11px] leading-relaxed text-fg-faint">
          {t(`nation.start.${facts.start}.hint`)}
        </span>
      </span>
    </OptionCard>
  );
}

/** Every economy in the world as a bar, tallest first, yours in gold. */
function GdpStrip({ scenario, countryId }: { scenario: Scenario; countryId: string }) {
  const t = useTranslations('setup');
  const ladder = gdpLadder(scenario);
  const logs = ladder.map((n) => Math.log10(Math.max(1, n.gdp)));
  const max = Math.max(...logs);
  const min = Math.min(...logs);
  const span = max - min || 1;
  return (
    <span className="block w-full" aria-hidden>
      <span className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-fg-faint">
        {t('nation.stripLabel')}
      </span>
      <span className="flex h-7 items-end gap-[2px]">
        {ladder.map((n, i) => (
          <span
            key={n.id}
            className={cn(
              'min-w-0 flex-1 rounded-[1px]',
              n.id === countryId ? 'bg-accent' : 'bg-white/[0.16]',
            )}
            style={{ height: `${18 + 82 * ((logs[i]! - min) / span)}%` }}
          />
        ))}
      </span>
    </span>
  );
}
