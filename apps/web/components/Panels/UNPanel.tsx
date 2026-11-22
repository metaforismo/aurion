'use client';

// United Nations panel — what is on the floor and how the player votes on
// it, the way to table a resolution of one's own, and the record of what
// the assembly has already decided.

import type { UNResolution } from '@aurion/engine';
import { Globe, Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useGameStore } from '../../lib/store';
import { Button, Chip, EmptyState, SectionTitle, Stat } from '../ui';

import { CountryDot } from './diplomacy/parts';
import { useWorld, type World } from './diplomacy/world';
import { UNProposeForm } from './UNProposeForm';
import { UNResolutionCard } from './UNResolutionCard';

const HISTORY_PREVIEW = 4;

export function UNPanel({ onErrors }: { onErrors?: (errors: string[]) => void }) {
  const t = useTranslations('panelUN');
  const tToast = useTranslations('notifications.un');
  const pushActionToast = useGameStore((s) => s.pushActionToast);
  const w = useWorld();
  const [proposing, setProposing] = useState(false);
  const [allHistory, setAllHistory] = useState(false);

  if (!w) return null;

  const council = w.scenario?.unCouncilMembers ?? [];
  if (council.length === 0 || !w.state.unResolutions) {
    return (
      <div className="p-4" data-testid="un-panel">
        <EmptyState icon={Globe} title={t('inactive.title')} className="py-10">
          {t('inactive.body')}
        </EmptyState>
      </div>
    );
  }

  const isCouncil = council.includes(w.player.id);
  const all = w.state.unResolutions;
  const mine = w.player.id;
  // Ballots still to cast come first, then whatever closes soonest.
  const open = all
    .filter((r) => r.status === 'voting')
    .sort(
      (a, b) =>
        Number(a.votes[mine] !== undefined) - Number(b.votes[mine] !== undefined) ||
        a.votingClosesAtTick - b.votingClosesAtTick,
    );
  const closed = all
    .filter((r) => r.status !== 'voting')
    .sort((a, b) => b.votingClosesAtTick - a.votingClosesAtTick);
  const shownClosed = allHistory ? closed : closed.slice(0, HISTORY_PREVIEW);

  return (
    <div className="flex flex-col gap-4 p-4" data-testid="un-panel">
      <Floor w={w} open={open} closed={closed} council={council} isCouncil={isCouncil} />

      <section aria-label={t('active')} className="flex flex-col gap-2">
        <SectionTitle aside={open.length}>{t('active')}</SectionTitle>
        {open.length === 0 ? (
          <EmptyState icon={Globe} title={t('emptyTitle')}>
            {t('empty')}
          </EmptyState>
        ) : (
          open.map((r) => <UNResolutionCard key={r.id} w={w} resolution={r} isCouncil={isCouncil} onErrors={onErrors} />)
        )}
      </section>

      <section aria-label={t('propose.title')} className="flex flex-col gap-2">
        <SectionTitle>{t('propose.title')}</SectionTitle>
        {proposing ? (
          <>
            <UNProposeForm
              w={w}
              isCouncil={isCouncil}
              onErrors={onErrors}
              onDone={() => {
                setProposing(false);
                pushActionToast({ message: tToast('proposeSuccess') });
              }}
            />
            <Button size="sm" variant="ghost" icon={X} onClick={() => setProposing(false)}>
              {t('propose.cancel')}
            </Button>
          </>
        ) : (
          <>
            <p className="text-[11px] leading-snug text-fg-faint">
              {isCouncil ? t('propose.introCouncil') : t('propose.introAssembly')}
            </p>
            <Button variant="primary" icon={Plus} onClick={() => setProposing(true)} data-testid="un-propose-open">
              {t('propose.open')}
            </Button>
          </>
        )}
      </section>

      <section aria-label={t('history')} className="flex flex-col gap-2">
        <SectionTitle aside={closed.length}>{t('history')}</SectionTitle>
        {closed.length === 0 ? (
          <EmptyState>{t('historyEmpty')}</EmptyState>
        ) : (
          <>
            {shownClosed.map((r) => (
              <UNResolutionCard key={r.id} w={w} resolution={r} isCouncil={isCouncil} onErrors={onErrors} />
            ))}
            {closed.length > HISTORY_PREVIEW ? (
              <Button size="sm" variant="ghost" aria-expanded={allHistory} onClick={() => setAllHistory((v) => !v)}>
                {allHistory ? t('historyLess') : t('historyAll', { n: closed.length })}
              </Button>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

/** Hero: what awaits the player's vote, and the seat they vote from. */
function Floor({
  w,
  open,
  closed,
  council,
  isCouncil,
}: {
  w: World;
  open: UNResolution[];
  closed: UNResolution[];
  council: readonly string[];
  isCouncil: boolean;
}) {
  const t = useTranslations('panelUN');
  const waiting = open.filter((r) => r.votes[w.player.id] === undefined).length;
  const tabled = [...open, ...closed].filter((r) => r.proposerCountryId === w.player.id).length;
  const passed = closed.filter((r) => r.status === 'passed').length;

  return (
    <section
      aria-label={t('hero.label')}
      className="rounded-xl border border-accent/25 bg-gradient-to-br from-accent/[0.09] via-transparent to-[#5cc8ff]/[0.06] p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <Stat
          size="lg"
          tone={waiting > 0 ? 'accent' : 'neutral'}
          label={t('hero.waiting')}
          value={waiting}
          hint={t('hero.onFloor', { n: open.length })}
        />
        <Chip tone={isCouncil ? 'accent' : 'neutral'}>{isCouncil ? t('councilMember') : t('assemblyMember')}</Chip>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-fg-muted">{isCouncil ? t('hero.seatCouncil') : t('hero.seatAssembly')}</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
        <Stat size="sm" label={t('hero.tabled')} value={tabled} />
        <Stat size="sm" label={t('hero.passed')} value={passed} tone={passed > 0 ? 'success' : 'neutral'} />
      </dl>
      <div className="mt-3 border-t border-white/10 pt-3">
        <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-fg-faint">{t('hero.council')}</div>
        <ul className="flex flex-wrap gap-1.5">
          {council.map((id) => {
            const c = w.state.countries[id];
            if (!c) return null;
            const isPlayer = id === w.player.id;
            return (
              <li
                key={id}
                className={
                  isPlayer
                    ? 'inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] text-accent'
                    : 'inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-fg-muted'
                }
              >
                <CountryDot color={isPlayer ? 'var(--color-accent)' : c.color} className="h-2 w-2" />
                {w.nameOf(id)}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export default UNPanel;
