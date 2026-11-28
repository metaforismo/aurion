'use client';

// National works: facilities built at home with money — universities, data
// centres, power plants, a fusion test reactor, a particle collider. Each
// row shows the level reached, what the next one costs and brings, and the
// building site while it is going up; every work can be looked at in the
// capital, where it stands as a building of its own.

import {
  Atom,
  Building2,
  Eye,
  GraduationCap,
  Hospital,
  Landmark,
  Lock,
  Orbit,
  Plane,
  Radiation,
  Server,
  Sun,
  Telescope,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { WORKS, WORK_SLOTS, workProgress, workStatus, type Action, type WorkDef, type WorkId } from '@aurion/engine';

import { cn } from '../../../lib/cn';
import { money } from '../../../lib/format';
import { useGameStore } from '../../../lib/store';
import { SectionTitle } from '../../ui';

const ICON: Record<WorkId, LucideIcon> = {
  university: GraduationCap,
  hospital: Hospital,
  datacenter: Server,
  exchange: Landmark,
  airport: Plane,
  solar: Sun,
  nuclear: Radiation,
  fusion_lab: Atom,
  observatory: Telescope,
  collider: Orbit,
  intel_hq: Eye,
};

function Pips({ level, max }: { level: number; max: number }) {
  return (
    <span className="flex gap-0.5" aria-hidden>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={cn('h-1.5 w-3 rounded-full', i < level ? 'bg-accent' : 'bg-white/15')} />
      ))}
    </span>
  );
}

export function WorksSection({ run }: { run: (action: Action, sound?: 'sfx.coin' | 'sfx.confirm') => Promise<boolean> }) {
  const t = useTranslations('works');
  const locale = useLocale();
  const state = useGameStore((s) => s.state);
  const setCapital = useGameStore((s) => s.setCapital);
  if (!state) return null;
  const busy = state.works?.active.length ?? 0;

  const effects = (def: WorkDef) => {
    const fx = def.effects;
    const out: string[] = [];
    if (fx.research) out.push(t('fx.research', { n: fx.research }));
    if (fx.gdpMul) out.push(t('fx.gdp', { n: Math.round((fx.gdpMul - 1) * 1000) / 10 }));
    if (fx.popularity) out.push(t('fx.popularity', { n: fx.popularity }));
    if (fx.spies) out.push(t('fx.spies', { n: fx.spies }));
    if (fx.kardashev) out.push(t('fx.kardashev'));
    return out.join(' · ');
  };

  return (
    <section aria-label={t('title')} className="flex flex-col gap-2" data-testid="works-section">
      <SectionTitle aside={t('slots', { used: busy, total: WORK_SLOTS })}>{t('title')}</SectionTitle>
      <p className="-mt-1 text-[11px] leading-snug text-fg-faint">{t('intro')}</p>
      <ul className="flex flex-col gap-1.5">
        {WORKS.map((def) => {
          const status = workStatus(state, def);
          const Icon = ICON[def.id];
          const level = status.level;
          return (
            <li
              key={def.id}
              data-testid={`work-${def.id}`}
              className={cn(
                'rounded-xl border px-3 py-2.5',
                status.status === 'building' ? 'border-accent/40 bg-accent/[0.06]' : 'border-white/[0.08] bg-white/[0.03]',
              )}
            >
              <div className="flex items-start gap-3">
                <Icon aria-hidden className={cn('mt-0.5 h-4 w-4 shrink-0', level > 0 ? 'text-accent' : 'text-fg-muted')} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-medium text-fg">{t(`items.${def.id}.name`)}</span>
                    <Pips level={level} max={def.maxLevel} />
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-fg-faint">{t(`items.${def.id}.blurb`)}</p>
                  <p className="mt-1 text-[11px] text-fg-muted">
                    {t('perLevel')} {effects(def)}
                  </p>

                  {status.status === 'building' ? (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-[11px] text-fg-muted">
                        <span>{t('building', { level: status.build.toLevel, weeks: status.build.remainingTicks })}</span>
                        <button
                          type="button"
                          className="flex items-center gap-1 text-fg-faint hover:text-fg"
                          onClick={() => void run({ type: 'cancelWork', workId: def.id })}
                          data-testid={`work-${def.id}-cancel`}
                        >
                          <X aria-hidden className="h-3 w-3" />
                          {t('cancel')}
                        </button>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-accent transition-[width] duration-700"
                          style={{ width: `${Math.round(workProgress(status.build) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {status.status === 'available' ? (
                      <button
                        type="button"
                        disabled={!status.affordable || !status.slotFree}
                        onClick={() => void run({ type: 'buildWork', workId: def.id }, 'sfx.coin')}
                        data-testid={`work-${def.id}-build`}
                        className="rounded-lg border border-accent/50 bg-accent/15 px-2.5 py-1 text-[12px] font-medium text-fg transition-colors hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {t(level === 0 ? 'build' : 'upgrade', {
                          level: level + 1,
                          price: money(status.cost, locale).replace(' ', ' '),
                          weeks: status.duration,
                        })}
                      </button>
                    ) : null}
                    {status.status === 'locked' ? (
                      <span className="flex items-center gap-1 text-[11px] text-fg-faint">
                        <Lock aria-hidden className="h-3 w-3" />
                        {t('locked', { name: t(`items.${status.requires.work}.name`), level: status.requires.level })}
                      </span>
                    ) : null}
                    {status.status === 'maxed' ? <span className="text-[11px] text-accent">{t('maxed')}</span> : null}
                    {level > 0 || status.status === 'building' ? (
                      <button
                        type="button"
                        onClick={() => setCapital(true, def.id)}
                        data-testid={`work-${def.id}-see`}
                        className="ml-auto flex items-center gap-1 text-[11px] text-fg-faint hover:text-fg"
                      >
                        <Building2 aria-hidden className="h-3 w-3" />
                        {t('see')}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
