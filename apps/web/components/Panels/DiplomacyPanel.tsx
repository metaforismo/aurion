// Diplomacy system panel.
// - Lists every other country with attitude, treaties, atWar.
// - Click a country to expand and see contextual diplomatic actions.
// - Sort by name / attitude / treaty count.
// - "Declare war" routes through store.confirm() so the Modals agent can render
//   a confirmation modal.

'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import type {
  Country,
  CountryId,
  DiplomacyKind,
  Relation,
  RelationKey,
  TreatyKind,
} from '@aurion/engine';

import { cn } from '../../lib/cn';
import {
  selectPlayerCountry,
  useGameStore,
  type GameStoreState,
} from '../../lib/store';
import { ScenarioId } from '../../lib/scenarios';
import { ActionButton } from './shared/ActionButton';
import { EmptyState } from './shared/EmptyState';
import { useScenarioMessages } from './shared/useScenarioMessages';

type SortMode = 'alpha' | 'attitude' | 'treaties';

function relationKey(a: CountryId, b: CountryId): RelationKey {
  return (a < b ? `${a}::${b}` : `${b}::${a}`) as RelationKey;
}

const TREATY_TONE: Record<TreatyKind, string> = {
  alliance: 'border-emerald-700 bg-emerald-500/15 text-emerald-200',
  tradeDeal: 'border-indigo-700 bg-indigo-500/15 text-indigo-200',
  nonAggression: 'border-slate-700 bg-slate-800 text-slate-300',
  sanctions: 'border-rose-700 bg-rose-500/15 text-rose-200',
};

export function DiplomacyPanel({
  onErrors,
}: {
  onErrors?: (errors: string[]) => void;
}) {
  const t = useTranslations('panelDiplomacy');
  const tShared = useTranslations('panelShared');
  const tCommon = useTranslations('common');
  const fmt = useFormatter();

  const player = useGameStore(selectPlayerCountry);
  const state = useGameStore((s: GameStoreState) => s.state);
  const scenario = useGameStore((s: GameStoreState) => s.scenario);
  const applyAction = useGameStore((s: GameStoreState) => s.applyAction);
  const confirm = useGameStore((s: GameStoreState) => s.confirm);

  const scenarioId = (scenario?.id ?? null) as ScenarioId | null;
  const { t: tScenario } = useScenarioMessages(scenarioId);

  const [sortMode, setSortMode] = useState<SortMode>('alpha');
  const [expanded, setExpanded] = useState<CountryId | null>(null);

  const rows = useMemo(() => {
    if (!player || !state) return [];
    const me = player.id;
    const out: { country: Country; relation: Relation | null }[] = [];
    for (const c of Object.values(state.countries)) {
      if (c.id === me) continue;
      const rel = state.relations[relationKey(me, c.id)] ?? null;
      out.push({ country: c, relation: rel });
    }
    out.sort((a, b) => {
      switch (sortMode) {
        case 'attitude': {
          const aAtt = a.relation?.attitude ?? 0;
          const bAtt = b.relation?.attitude ?? 0;
          return bAtt - aAtt;
        }
        case 'treaties': {
          const aT = a.relation?.treaties.length ?? 0;
          const bT = b.relation?.treaties.length ?? 0;
          return bT - aT;
        }
        case 'alpha':
        default:
          return tScenario(a.country.nameKey).localeCompare(
            tScenario(b.country.nameKey),
          );
      }
    });
    return out;
  }, [player, state, sortMode, tScenario]);

  if (!player || !state) {
    return (
      <div className="p-4">
        <EmptyState>{tShared('noPlayer')}</EmptyState>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Sort toolbar */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-wider text-slate-500">
          {t('countries.title')} ({rows.length})
        </span>
        <div className="flex gap-1" role="group" aria-label={t('sort.label')}>
          {(['alpha', 'attitude', 'treaties'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setSortMode(m)}
              aria-pressed={sortMode === m}
              className={cn(
                'rounded border px-2 py-0.5 text-[11px] transition',
                sortMode === m
                  ? 'border-indigo-500 bg-indigo-500/15 text-indigo-100'
                  : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600',
              )}
            >
              {t(`sort.${m}`)}
            </button>
          ))}
        </div>
      </div>

      <ul className="flex flex-col gap-1">
        {rows.map(({ country, relation }) => {
          const expandedNow = expanded === country.id;
          return (
            <li key={country.id}>
              <CountryRow
                country={country}
                relation={relation}
                expanded={expandedNow}
                playerName={tScenario(player.nameKey)}
                otherName={tScenario(country.nameKey)}
                onToggle={() =>
                  setExpanded((prev) => (prev === country.id ? null : country.id))
                }
                onAction={async (kind) => {
                  return applyAction({ type: 'diplomacy', target: country.id, kind });
                }}
                onConfirmAction={(kind, titleKey, descriptionKey, tone) => {
                  confirm({
                    titleKey,
                    descriptionKey,
                    tone,
                    confirmKey: 'common.confirm',
                    cancelKey: 'common.cancel',
                    onConfirm: async () => {
                      const errors = await applyAction({
                        type: 'diplomacy',
                        target: country.id,
                        kind,
                      });
                      if (errors.length > 0) onErrors?.(errors);
                    },
                  });
                }}
                onErrors={onErrors}
                fmt={fmt}
                tCommon={tCommon}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Country row
// ---------------------------------------------------------------------------

function CountryRow({
  country,
  relation,
  expanded,
  playerName,
  otherName,
  onToggle,
  onAction,
  onConfirmAction,
  onErrors,
  fmt,
  tCommon,
}: {
  country: Country;
  relation: Relation | null;
  expanded: boolean;
  playerName: string;
  otherName: string;
  onToggle: () => void;
  onAction: (kind: DiplomacyKind) => Promise<string[]>;
  onConfirmAction: (
    kind: DiplomacyKind,
    titleKey: string,
    descriptionKey: string,
    tone?: 'primary' | 'danger',
  ) => void;
  onErrors?: (errors: string[]) => void;
  fmt: ReturnType<typeof useFormatter>;
  tCommon: ReturnType<typeof useTranslations<'common'>>;
}) {
  const t = useTranslations('panelDiplomacy');

  const attitude = relation?.attitude ?? 0;
  const attitudeTone =
    attitude >= 30
      ? 'text-emerald-300'
      : attitude <= -30
        ? 'text-rose-300'
        : 'text-slate-300';
  const treaties = relation?.treaties ?? [];
  const atWar = !!relation?.atWar;
  const allied = treaties.includes('alliance');
  const sanctioned = treaties.includes('sanctions');
  const trading = treaties.includes('tradeDeal');

  // Suppress unused
  void tCommon;
  void fmt;

  return (
    <article
      className={cn(
        'rounded-md border bg-slate-900/40 transition',
        expanded ? 'border-indigo-700' : 'border-slate-800 hover:border-slate-700',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left"
      >
        <span
          aria-hidden
          className="inline-block h-3 w-3 shrink-0 rounded-full border border-slate-800"
          style={{ backgroundColor: country.color }}
        />
        <span className="flex-1 truncate text-xs font-medium text-slate-100">
          {otherName}
        </span>
        <span className={cn('font-mono text-[11px] tabular-nums', attitudeTone)}>
          {attitude > 0 ? `+${attitude}` : attitude}
        </span>
        {atWar ? (
          <span className="rounded-full border border-rose-700 bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-mono uppercase text-rose-200">
            {t('atWar')}
          </span>
        ) : null}
        {treaties.length > 0 ? (
          <span className="text-[10px] text-slate-500">{treaties.length}</span>
        ) : null}
      </button>

      {expanded ? (
        <div className="flex flex-col gap-2 border-t border-slate-800 p-2">
          {/* Treaties */}
          {treaties.length > 0 ? (
            <ul className="flex flex-wrap gap-1">
              {treaties.map((tr) => (
                <li
                  key={tr}
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase',
                    TREATY_TONE[tr],
                  )}
                >
                  {t(`treaty.${tr}`)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] italic text-slate-500">{t('noTreaties')}</p>
          )}

          {/* Actions */}
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {/* Alliance proposal — requires friendly attitude and no war */}
            {!allied && !atWar ? (
              <ActionButton
                tone="primary"
                disabledReason={
                  attitude < 30 ? t('reason.attitudeTooLow') : null
                }
                onClick={() => onAction('proposeAlliance')}
                onErrors={onErrors}
              >
                {t('action.proposeAlliance')}
              </ActionButton>
            ) : null}

            {allied ? (
              <ActionButton
                tone="neutral"
                onClick={() => onAction('breakAlliance')}
                onErrors={onErrors}
              >
                {t('action.breakAlliance')}
              </ActionButton>
            ) : null}

            {/* Sanctions */}
            {!sanctioned ? (
              <ActionButton
                tone="neutral"
                onClick={() => onAction('imposeSanction')}
                onErrors={onErrors}
              >
                {t('action.imposeSanction')}
              </ActionButton>
            ) : (
              <ActionButton
                tone="neutral"
                onClick={() => onAction('liftSanction')}
                onErrors={onErrors}
              >
                {t('action.liftSanction')}
              </ActionButton>
            )}

            {/* Trade */}
            {!trading && !atWar ? (
              <ActionButton
                tone="neutral"
                onClick={() => onAction('tradeDeal')}
                onErrors={onErrors}
              >
                {t('action.tradeDeal')}
              </ActionButton>
            ) : null}

            {/* War / peace — gated through confirm */}
            {atWar ? (
              <ActionButton
                tone="primary"
                onClick={() =>
                  onConfirmAction(
                    'sueForPeace',
                    'panelDiplomacy.confirm.peace.title',
                    'panelDiplomacy.confirm.peace.description',
                    'primary',
                  )
                }
                onErrors={onErrors}
              >
                {t('action.sueForPeace')}
              </ActionButton>
            ) : (
              <ActionButton
                tone="danger"
                onClick={() =>
                  onConfirmAction(
                    'declareWar',
                    'panelDiplomacy.confirm.war.title',
                    'panelDiplomacy.confirm.war.description',
                    'danger',
                  )
                }
                onErrors={onErrors}
              >
                {t('action.declareWar')}
              </ActionButton>
            )}
          </div>

          <p className="text-[10px] text-slate-600">
            {t('hint.relation', { player: playerName, other: otherName })}
          </p>
        </div>
      ) : null}
    </article>
  );
}

export default DiplomacyPanel;
