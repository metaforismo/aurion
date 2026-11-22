'use client';

// Last step — the whole expedition on one page before committing: what
// you're setting out to do, how it can end, and under which rules.

import { Clock, Gauge, Pencil, Skull, Trophy, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, type ReactNode } from 'react';

import { Card, Chip, TextInput } from '../../ui';
import { ModifierList } from './DifficultyStep';
import { nationFacts } from './insight';
import { usePlanLabels } from './Manifest';
import { START_TONE } from './NationStep';
import type { StepId, StepProps } from './plan';
import { useVictoryCopy } from './VictoryStep';

const ALWAYS_LOSE = ['popularity', 'bankruptcy', 'capital', 'factions'] as const;

export function LaunchStep({
  plan,
  resolved,
  update,
  onJump,
}: StepProps & { onJump: (step: StepId) => void }) {
  const t = useTranslations('setup');
  const tModes = useTranslations('modes');
  const tGuide = useTranslations('guide.lose');
  const tMenu = useTranslations('menu');
  const labels = usePlanLabels(plan, resolved);
  const victoryCopy = useVictoryCopy(resolved.scenario);
  const nameId = useId();

  const { mode, scenario, nationId, difficulty, ironMan } = resolved;
  const facts = scenario && nationId ? nationFacts(scenario, nationId) : null;
  // What "victory" means in this world: Campaign's chosen path, or the
  // condition that closes Throne and Chronicles early.
  const endsOnVictory = mode.choosesVictory || mode.id === 'dethrone' || mode.id === 'era-paced';
  const worldTarget = endsOnVictory
    ? (victoryCopy.target(resolved.victory) ?? victoryCopy.description(resolved.victory))
    : null;

  return (
    <div className="flex flex-col gap-4">
      <Card tone="accent" className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
        <span
          aria-hidden
          className="h-10 w-10 shrink-0 rounded-xl border border-white/20"
          style={{ backgroundColor: labels.nationColor ?? 'transparent' }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold tracking-tight text-fg">
            {labels.nation
              ? t('launch.headline', { nation: labels.nation, world: labels.world })
              : t('launch.loadingWorld')}
          </p>
          <p className="text-xs text-fg-muted">{tModes(`${mode.key}.pitch`)}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip tone="accent" icon={mode.icon}>
            {labels.mode}
          </Chip>
          {facts ? (
            <Chip tone={START_TONE[facts.start]}>{t(`nation.start.${facts.start}.label`)}</Chip>
          ) : null}
          {ironMan ? (
            <Chip tone="danger" icon={Skull}>
              {t('ironMan.title')}
            </Chip>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <Brief
          icon={Trophy}
          tone="text-success"
          title={t('modeField.win')}
          edit={mode.choosesVictory ? () => onJump('victory') : () => onJump('mode')}
        >
          {mode.choosesVictory ? (
            <>
              <span className="font-medium text-fg">{labels.victory}.</span> {worldTarget}
            </>
          ) : (
            <>
              {tModes(`${mode.key}.win`)}
              {worldTarget ? (
                <span className="mt-2 block text-fg-faint">
                  {t('launch.inThisWorld', { victory: labels.victory })}{' '}
                  <span className="text-fg-muted">{worldTarget}</span>
                </span>
              ) : null}
            </>
          )}
        </Brief>

        <Brief
          icon={Skull}
          tone="text-[#ff8a7d]"
          title={t('modeField.lose')}
          edit={() => onJump('mode')}
        >
          {tModes(`${mode.key}.lose`)}
          <span className="mt-2 block text-fg-faint">{t('launch.alwaysLose')}</span>
          <span className="mt-1 flex flex-wrap gap-1.5">
            {ALWAYS_LOSE.map((id) => (
              <Chip key={id}>{tGuide(`${id}.title`)}</Chip>
            ))}
          </span>
        </Brief>

        <Brief
          icon={Gauge}
          tone="text-fg-muted"
          title={t('launch.rules')}
          edit={() => onJump('difficulty')}
        >
          <span className="font-medium text-fg">{labels.difficulty ?? '…'}</span>
          {ironMan ? (
            <span className="mt-1 block text-[#ffb0a6]">{t('ironMan.warning')}</span>
          ) : null}
          {difficulty ? (
            <span className="mt-2 block">
              <ModifierList preset={difficulty} />
            </span>
          ) : null}
        </Brief>

        <Brief icon={Clock} tone="text-fg-muted" title={t('modeField.length')}>
          {tModes(`${mode.key}.length`)}
          <span className="mt-3 block">
            <label
              htmlFor={nameId}
              className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-faint"
            >
              {t('launch.saveName')}
            </label>
            <TextInput
              id={nameId}
              value={plan.saveName}
              maxLength={80}
              placeholder={
                labels.nation ? tMenu('saveName', { nation: labels.nation, mode: labels.mode }) : ''
              }
              onChange={(e) => update('launch', (prev) => ({ ...prev, saveName: e.target.value }))}
            />
            <span className="mt-1 block text-[11px] text-fg-faint">
              {ironMan ? t('launch.saveNameIron') : t('launch.saveNameHint')}
            </span>
          </span>
        </Brief>
      </div>
    </div>
  );
}

function Brief({
  icon: Icon,
  tone,
  title,
  edit,
  children,
}: {
  icon: LucideIcon;
  tone: string;
  title: string;
  /** Jump back to the step that owns this part of the plan. */
  edit?: () => void;
  children: ReactNode;
}) {
  const t = useTranslations('setup');
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon aria-hidden className={`h-4 w-4 ${tone}`} />
        <h3 className="flex-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-muted">
          {title}
        </h3>
        {edit ? (
          <button
            type="button"
            onClick={edit}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-fg-faint transition-colors hover:bg-white/[0.07] hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <Pencil aria-hidden className="h-3 w-3" />
            {t('launch.change')}
          </button>
        ) : null}
      </div>
      <div className="text-pretty text-[13px] leading-relaxed text-fg-muted">{children}</div>
    </Card>
  );
}
