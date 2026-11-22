'use client';

// The selected country seen from the foreign ministry: how they feel about
// the player, what binds the two, and every move available — each with its
// consequences worked out on a copy of the game before the click.

import type { Country, DiplomacyKind } from '@aurion/engine';
import { Ban, Check, Coins, Handshake, HeartHandshake, Swords, Unlink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { compactNumber } from '../../../lib/format';
import { useGameStore } from '../../../lib/store';
import { Card, Chip } from '../../ui';
import type { SfxId } from '../../Audio';

import { ActionCard, AttitudeBar, AttitudeValue, Fact, StanceChip, TargetHeader } from './parts';
import {
  cash,
  formatAttitude,
  knowsFigures,
  relationKey,
  stanceOf,
  useCommit,
  useEngineError,
  type World,
} from './world';

const ICON: Record<DiplomacyKind, typeof Handshake> = {
  proposeAlliance: Handshake,
  breakAlliance: Unlink,
  tradeDeal: Coins,
  imposeSanction: Ban,
  liftSanction: HeartHandshake,
  declareWar: Swords,
  sueForPeace: HeartHandshake,
};

const SOUND: Partial<Record<DiplomacyKind, SfxId>> = {
  proposeAlliance: 'sfx.treaty',
  tradeDeal: 'sfx.treaty',
  sueForPeace: 'sfx.treaty',
  declareWar: 'sfx.war',
};

/** Moves that cannot be taken back with another click. */
const NEEDS_CONFIRM: readonly DiplomacyKind[] = ['breakAlliance', 'declareWar', 'sueForPeace'];

export function Dossier({
  w,
  target,
  onErrors,
}: {
  w: World;
  target: Country;
  onErrors?: (errors: string[]) => void;
}) {
  const t = useTranslations('panelDiplomacy');
  const confirm = useGameStore((s) => s.confirm);
  const commit = useCommit(onErrors);
  const explain = useEngineError();
  const [outcome, setOutcome] = useState<{ id: string; text: string } | null>(null);

  const rel = w.relation(target.id);
  const name = w.nameOf(target.id);
  const allied = rel.treaties.includes('alliance');
  const sanctioned = rel.treaties.includes('sanctions');
  const trading = rel.treaties.includes('tradeDeal');
  const known = knowsFigures(w.intelOn(target.id));
  const bloc = Object.values(w.state.blocs ?? {}).find((b) => b.memberCountryIds.includes(target.id));

  // What each move is worth to the treasury, from the engine's income rules.
  const weekly = w.player.economy.weeklyIncome;
  const figures: Record<DiplomacyKind, Record<string, string>> = {
    proposeAlliance: {},
    breakAlliance: {},
    tradeDeal: { gain: cash(Math.abs(weekly) * 0.02, w.locale) },
    imposeSanction: { loss: cash(Math.abs(weekly) * 0.05, w.locale) },
    liftSanction: { gain: cash(Math.abs(weekly) * 0.05, w.locale) },
    declareWar: { cost: cash(w.player.military.armySize * 50, w.locale) },
    sueForPeace: { saving: cash(w.player.military.armySize * 50, w.locale) },
  };

  const kinds: DiplomacyKind[] = rel.atWar
    ? ['sueForPeace', sanctioned ? 'liftSanction' : 'imposeSanction']
    : [
        allied ? 'breakAlliance' : 'proposeAlliance',
        ...(trading ? [] : (['tradeDeal'] as const)),
        sanctioned ? 'liftSanction' : 'imposeSanction',
        'declareWar',
      ];
  const primary: DiplomacyKind = rel.atWar ? 'sueForPeace' : 'proposeAlliance';

  const run = async (kind: DiplomacyKind) => {
    const ok = await commit({ type: 'diplomacy', target: target.id, kind }, SOUND[kind]);
    if (ok) setOutcome({ id: target.id, text: t(`done.${kind}`, { name }) });
  };
  const act = (kind: DiplomacyKind) => {
    if (!NEEDS_CONFIRM.includes(kind)) {
      void run(kind);
      return;
    }
    confirm({
      titleKey: `panelDiplomacy.confirm.${kind}.title`,
      descriptionKey: `panelDiplomacy.confirm.${kind}.description`,
      confirmKey: `panelDiplomacy.action.${kind}`,
      cancelKey: 'common.cancel',
      tone: kind === 'sueForPeace' ? 'primary' : 'danger',
      onConfirm: () => run(kind),
    });
  };

  return (
    <section aria-label={t('dossier.label', { name })} data-testid="diplomacy-dossier" className="flex flex-col gap-3">
      <Card tone={rel.atWar ? 'danger' : 'neutral'} className="flex flex-col gap-3">
        <TargetHeader
          name={name}
          color={target.color}
          aside={<StanceChip stance={stanceOf(rel)} />}
          caption={
            <>
              {w.tScenario(target.capitalKey)} · {w.regionName(target.regionId)}
              {bloc ? ` · ${w.tScenario(bloc.nameKey)}` : ''}
            </>
          }
          onClear={() => w.selectTarget(null)}
        />

        <div>
          <div className="mb-1.5 flex items-baseline justify-between text-[11px]">
            <span className="text-fg-muted">{t('dossier.attitude')}</span>
            <AttitudeValue attitude={rel.attitude} className="text-sm font-semibold" />
          </div>
          <AttitudeBar attitude={rel.attitude} marks={[-25]} />
          <div className="mt-1 flex justify-between font-mono text-[10px] text-fg-faint">
            <span>−100</span>
            <span>{t('dossier.scaleHint')}</span>
            <span>+100</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {rel.treaties.length === 0 && !rel.atWar ? (
            <span className="text-[11px] text-fg-faint">{t('noTreaties')}</span>
          ) : null}
          {rel.atWar ? <Chip tone="danger" icon={Swords}>{t('atWar')}</Chip> : null}
          {rel.treaties.map((k) => (
            <Chip key={k} tone={k === 'alliance' ? 'success' : k === 'sanctions' ? 'warning' : k === 'tradeDeal' ? 'info' : 'neutral'}>
              {t(`treaty.${k}`)}
            </Chip>
          ))}
        </div>

        {known ? (
          <dl className="flex flex-col gap-1 border-t border-white/10 pt-2.5">
            <Fact label={t('dossier.gdp')}>{cash(target.economy.gdp, w.locale)}</Fact>
            <Fact label={t('dossier.army')}>{compactNumber(target.military.armySize, w.locale)}</Fact>
          </dl>
        ) : (
          <p className="border-t border-white/10 pt-2.5 text-[11px] leading-snug text-fg-faint">{t('dossier.unknown')}</p>
        )}
      </Card>

      <p role="status" aria-live="polite" className="flex items-center gap-1.5 text-[12px] font-medium text-success empty:hidden">
        {outcome && outcome.id === target.id ? (
          <>
            <Check aria-hidden className="h-3.5 w-3.5" />
            {outcome.text}
          </>
        ) : null}
      </p>

      <ul className="flex flex-col gap-2" aria-label={t('dossier.actions')}>
        {kinds.map((kind) => {
          const dry = w.preview({ type: 'diplomacy', target: target.id, kind });
          const blocked = dry.errors[0] ? explain(dry.errors[0]) : undefined;
          const next = blocked ? undefined : dry.state.relations[relationKey(w.player.id, target.id)]?.attitude;
          return (
            <ActionCard
              key={kind}
              testId={`diplomacy-action-${kind}`}
              title={t(`action.${kind}`)}
              effect={t(`effect.${kind}`, figures[kind])}
              blocked={blocked}
              cta={t(`cta.${kind}`)}
              icon={ICON[kind]}
              variant={kind === primary && !blocked ? 'primary' : kind === 'declareWar' ? 'danger' : 'secondary'}
              onAct={() => act(kind)}
            >
              {next !== undefined ? (
                <p className="mt-2 font-mono text-[10px] text-fg-faint">
                  {t('dossier.attitudeShift', { from: formatAttitude(rel.attitude), to: formatAttitude(next) })}
                </p>
              ) : null}
            </ActionCard>
          );
        })}
      </ul>

    </section>
  );
}
