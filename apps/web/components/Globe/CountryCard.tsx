'use client';

// Selection card for the country the player clicked on the globe: who they
// are, how they stand toward you, and one-tap routes into the systems that
// act on them.

import { Coins, Flag, Landmark, Shield, UserSearch, X } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';

import { cn } from '../../lib/cn';
import type { ScenarioId } from '../../lib/scenarios';
import { useGameStore, type PanelId } from '../../lib/store';
import { useScenarioMessages } from '../Panels/shared/useScenarioMessages';

export default function CountryCard() {
  const t = useTranslations('globe.country');
  const fmt = useFormatter();
  const state = useGameStore((s) => s.state);
  const scenario = useGameStore((s) => s.scenario);
  const selectedCountryId = useGameStore((s) => s.selectedCountryId);
  const selectCountry = useGameStore((s) => s.selectCountry);
  const setSelectedPanel = useGameStore((s) => s.setSelectedPanel);
  const { t: tScenario } = useScenarioMessages((scenario?.id as ScenarioId | undefined) ?? null);

  const country = state && selectedCountryId ? state.countries[selectedCountryId] : undefined;
  if (!state || !country) return null;

  const isPlayer = country.id === state.playerCountryId;
  const key = isPlayer
    ? null
    : country.id < state.playerCountryId
      ? `${country.id}::${state.playerCountryId}`
      : `${state.playerCountryId}::${country.id}`;
  const rel = key ? state.relations[key as keyof typeof state.relations] : undefined;
  const intel = isPlayer ? 'full' : (state.countries[state.playerCountryId]?.intelligence.knownIntel[country.id] ?? 'none');
  const knows = intel === 'full' || intel === 'partial';
  const compact = (n: number) => fmt.number(n, { notation: 'compact', maximumFractionDigits: 1 });
  const spaceDone = isPlayer
    ? (state.cosmos?.completed.length ?? 0)
    : (state.cosmos?.rivals[country.id]?.completed.length ?? 0);

  const status = isPlayer
    ? { label: t('you'), cls: 'border-accent/50 bg-accent/15 text-accent' }
    : rel?.atWar
      ? { label: t('status.war'), cls: 'border-[#ff5d4d]/50 bg-[#ff5d4d]/15 text-[#ff8a7d]' }
      : rel?.treaties.includes('alliance')
        ? { label: t('status.ally'), cls: 'border-success/50 bg-success/15 text-success' }
        : rel?.treaties.includes('sanctions')
          ? { label: t('status.sanctions'), cls: 'border-warning/50 bg-warning/15 text-warning' }
          : rel?.treaties.includes('tradeDeal')
            ? { label: t('status.trade'), cls: 'border-[#5cc8ff]/50 bg-[#5cc8ff]/15 text-[#8ad8ff]' }
            : { label: t('status.neutral'), cls: 'border-white/15 bg-white/5 text-fg-muted' };

  const actions: { panel: PanelId; label: string; icon: typeof Flag }[] = isPlayer
    ? [
        { panel: 'economy', label: t('actions.economy'), icon: Coins },
        { panel: 'politics', label: t('actions.politics'), icon: Landmark },
        { panel: 'military', label: t('actions.military'), icon: Shield },
      ]
    : [
        { panel: 'diplomacy', label: t('actions.diplomacy'), icon: Flag },
        { panel: 'spies', label: t('actions.spies'), icon: UserSearch },
        { panel: 'military', label: t('actions.military'), icon: Shield },
      ];

  const name = tScenario(country.nameKey);
  const capital = tScenario(country.capitalKey);

  return (
    <section
      key={country.id}
      data-testid="country-card"
      aria-label={name}
      className="glass-panel pointer-events-auto w-[min(27rem,calc(100vw-2rem))] rounded-2xl p-3.5"
      style={{ animation: 'rise-in 260ms cubic-bezier(0.2, 0.8, 0.2, 1) both' }}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 h-9 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: isPlayer ? 'var(--color-accent)' : country.color }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold leading-tight text-fg">{name}</h3>
            <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold', status.cls)}>
              {status.label}
            </span>
          </div>
          <p className="truncate text-[11px] text-fg-faint">{capital}</p>
        </div>
        <button
          type="button"
          onClick={() => selectCountry(null)}
          aria-label={t('close')}
          title={t('close')}
          className="-mr-1 -mt-1 rounded-lg p-1.5 text-fg-faint transition-colors hover:bg-white/10 hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          <X aria-hidden className="h-4 w-4" />
        </button>
      </div>

      <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
        {[
          { label: t('gdp'), value: knows ? compact(country.economy.gdp) : '?' },
          { label: t('army'), value: knows ? compact(country.military.armySize) : '?' },
          {
            label: t('attitude'),
            value: isPlayer ? '—' : rel ? `${rel.attitude > 0 ? '+' : ''}${Math.round(rel.attitude)}` : '0',
          },
          { label: t('space'), value: String(spaceDone) },
        ].map((s) => (
          <div key={s.label} className="rounded-lg bg-white/[0.05] px-1 py-1.5">
            <dt className="truncate text-[9px] uppercase tracking-wider text-fg-faint">{s.label}</dt>
            <dd className="numeric-tabular font-mono text-sm text-fg">{s.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {actions.map((a) => (
          <button
            key={a.panel}
            type="button"
            onClick={() => setSelectedPanel(a.panel)}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 px-2 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:border-accent/50 hover:bg-accent/10 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <a.icon aria-hidden className="h-3.5 w-3.5" />
            {a.label}
          </button>
        ))}
      </div>
    </section>
  );
}
