'use client';

// The blocs of the scenario: who leads each, who sits in it, how each one
// regards the player, and the door in or out.

import type { ActiveBlocId, Bloc } from '@aurion/engine';
import { ChevronDown, Crown, DoorOpen, LogIn } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { cn } from '../../../lib/cn';
import { useGameStore } from '../../../lib/store';
import { Button, Card, Chip, SectionTitle } from '../../ui';

import { AttitudeBar, AttitudeValue, CountryDot } from './parts';
import { useCommit, type World } from './world';

export function Blocs({ w, onErrors }: { w: World; onErrors?: (errors: string[]) => void }) {
  const t = useTranslations('panelDiplomacy.blocs');
  const tToast = useTranslations('notifications.bloc');
  const confirm = useGameStore((s) => s.confirm);
  const pushActionToast = useGameStore((s) => s.pushActionToast);
  const commit = useCommit(onErrors);
  const [open, setOpen] = useState<ActiveBlocId | null>(null);

  const blocs = Object.values(w.state.blocs ?? {});
  // Founding members sit on a roster without the country itself carrying the
  // bloc id, so membership is read from the roster first.
  const mine = blocs.find((b) => b.memberCountryIds.includes(w.player.id)) ?? null;

  /**
   * The engine only moves a country out of a bloc it is registered to. A
   * founding member is on the roster but not registered, so register first;
   * otherwise it would stay on two rosters (or be refused the exit).
   */
  const register = async (): Promise<boolean> => {
    if (!mine || w.player.blocId === mine.id) return true;
    return commit({ type: 'joinBloc', blocId: mine.id }, 'sfx.click');
  };

  const join = (bloc: Bloc) =>
    confirm({
      titleKey: 'panelDiplomacy.blocs.confirm.join.title',
      descriptionKey: mine
        ? 'panelDiplomacy.blocs.confirm.join.switch'
        : 'panelDiplomacy.blocs.confirm.join.description',
      confirmKey: 'panelDiplomacy.blocs.join',
      cancelKey: 'common.cancel',
      onConfirm: async () => {
        if (!(await register())) return;
        if (await commit({ type: 'joinBloc', blocId: bloc.id }, 'sfx.treaty')) {
          pushActionToast({ message: tToast('joined', { bloc: w.tScenario(bloc.nameKey) }) });
        }
      },
    });

  const leave = (bloc: Bloc) =>
    confirm({
      titleKey: 'panelDiplomacy.blocs.confirm.leave.title',
      descriptionKey: 'panelDiplomacy.blocs.confirm.leave.description',
      confirmKey: 'panelDiplomacy.blocs.leave',
      cancelKey: 'common.cancel',
      tone: 'danger',
      onConfirm: async () => {
        if (!(await register())) return;
        if (await commit({ type: 'leaveBloc' })) {
          pushActionToast({ message: tToast('left', { bloc: w.tScenario(bloc.nameKey) }), tone: 'info' });
        }
      },
    });

  return (
    <section aria-label={t('title')} className="flex flex-col gap-2" data-testid="diplomacy-blocs">
      <SectionTitle aside={mine ? w.tScenario(mine.nameKey) : t('unaligned')}>{t('title')}</SectionTitle>
      <p className="text-[11px] leading-snug text-fg-faint">{t('intro')}</p>
      {blocs.map((bloc) => {
        const isMine = mine?.id === bloc.id;
        const expanded = open === bloc.id;
        const reputation = w.state.reputation?.[bloc.id] ?? 0;
        const leader = bloc.leaderCountryId;
        return (
          <Card key={bloc.id} tone={isMine ? 'accent' : 'neutral'} data-testid={`bloc-card-${bloc.id}`} className="flex flex-col gap-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h4 className="truncate text-[13px] font-semibold text-fg">{w.tScenario(bloc.nameKey)}</h4>
                <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-fg-faint">
                  <Crown aria-hidden className="h-3 w-3 shrink-0" />
                  {leader ? t('leader', { name: w.nameOf(leader) }) : t('noLeader')}
                  <span aria-hidden>·</span>
                  {t('members', { n: bloc.memberCountryIds.length })}
                </p>
              </div>
              {isMine ? <Chip tone="accent">{t('yours')}</Chip> : null}
            </div>

            <div>
              <div className="mb-1.5 flex items-baseline justify-between text-[11px]">
                <span className="text-fg-muted">{t('reputation')}</span>
                <AttitudeValue attitude={reputation} className="text-xs" />
              </div>
              <AttitudeBar attitude={reputation} marks={[-50]} />
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : bloc.id)}
                className="inline-flex items-center gap-1 rounded text-[11px] font-medium text-fg-muted hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {t('showMembers')}
                <ChevronDown aria-hidden className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
              </button>
              {isMine ? (
                <Button size="sm" variant="ghost" icon={DoorOpen} onClick={() => leave(bloc)} data-testid="bloc-leave">
                  {t('leave')}
                </Button>
              ) : (
                <Button size="sm" icon={LogIn} onClick={() => join(bloc)} data-testid={`bloc-join-${bloc.id}`}>
                  {t('join')}
                </Button>
              )}
            </div>

            {expanded ? (
              bloc.memberCountryIds.length === 0 ? (
                <p className="text-[11px] text-fg-faint">{t('empty')}</p>
              ) : (
                <ul className="flex flex-wrap gap-1.5 border-t border-white/10 pt-2.5">
                  {bloc.memberCountryIds.map((id) => {
                    const c = w.state.countries[id];
                    if (!c) return null;
                    const isPlayer = id === w.player.id;
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          disabled={isPlayer}
                          onClick={() => w.selectTarget(id)}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] transition-colors',
                            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                            isPlayer
                              ? 'border-accent/40 bg-accent/10 text-accent'
                              : 'border-white/10 text-fg-muted hover:border-white/30 hover:text-fg',
                          )}
                        >
                          <CountryDot color={isPlayer ? 'var(--color-accent)' : c.color} className="h-2 w-2" />
                          {w.nameOf(id)}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )
            ) : null}
          </Card>
        );
      })}
    </section>
  );
}
