// Inline form for proposing a new UN resolution.
//
// Only rendered by the UNPanel when the player country sits on the scenario's
// `unCouncilMembers` list. Lets the player pick a kind, an optional target
// (country or region — depends on kind), previews the static defaults, and
// dispatches `proposeUNResolution` through the store. The engine fills in
// proposer / titleKey / votingClosesAtTick / effects from the scenario's
// `unTriggerMap` (or its built-in defaults).

'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import type {
  CountryId,
  RegionId,
  UNResolutionKind,
} from '@aurion/engine';

import { cn } from '../../lib/cn';
import { ActionButton } from './shared/ActionButton';

const KIND_OPTIONS: readonly UNResolutionKind[] = [
  'sanctions',
  'peacekeeping',
  'recognition',
  'humanitarian',
  'climate',
  'nonProliferation',
  'condemnation',
];

/**
 * Per-kind metadata: which target the resolution accepts (country / region /
 * none), and a short preview blurb describing the typical effect family. Kept
 * here so the form can render contextual UI without round-tripping through
 * the engine. The engine remains the source of truth for actual effects.
 */
type KindMeta = {
  target: 'country' | 'region' | 'none';
  /** i18n keys (under panelUN.propose.preview.{kind}.*). */
  previewBullets: readonly string[];
};

const KIND_META: Record<UNResolutionKind, KindMeta> = {
  sanctions: {
    target: 'country',
    previewBullets: [
      'sanctions.income',
      'sanctions.tension',
      'sanctions.repCost',
    ],
  },
  peacekeeping: {
    target: 'region',
    previewBullets: [
      'peacekeeping.tension',
      'peacekeeping.repWestern',
      'peacekeeping.cost',
    ],
  },
  recognition: {
    target: 'country',
    previewBullets: [
      'recognition.attitude',
      'recognition.repNonAligned',
    ],
  },
  humanitarian: {
    target: 'none',
    previewBullets: [
      'humanitarian.cost',
      'humanitarian.repAll',
    ],
  },
  climate: {
    target: 'none',
    previewBullets: [
      'climate.cost',
      'climate.repWestern',
      'climate.repNonAligned',
    ],
  },
  nonProliferation: {
    target: 'none',
    previewBullets: [
      'nonProliferation.tension',
      'nonProliferation.repAll',
    ],
  },
  condemnation: {
    target: 'country',
    previewBullets: [
      'condemnation.attitude',
      'condemnation.tension',
    ],
  },
};

export type UNProposeFormProps = {
  /** Selectable target countries (typically every non-player country). */
  countries: ReadonlyArray<{ id: CountryId; nameKey: string }>;
  /** Selectable regions (typically every distinct regionId in the scenario). */
  regions: ReadonlyArray<RegionId>;
  /** Translated country name lookup — shared with the parent panel. */
  countryName: (id: CountryId) => string;
  /** Translated region name lookup — shared with the parent panel. */
  regionName: (id: string) => string;
  /** Submission handler. Returns the engine's i18n-key error array. */
  onSubmit: (args: {
    kind: UNResolutionKind;
    targetCountryId?: CountryId;
    targetRegionId?: RegionId;
  }) => Promise<string[]>;
  /** Optional cancel hook (e.g. to collapse the form back into a CTA). */
  onCancel?: () => void;
  /** Forwarded to the submit button. */
  onErrors?: (errors: string[]) => void;
};

export function UNProposeForm({
  countries,
  regions,
  countryName,
  regionName,
  onSubmit,
  onCancel,
  onErrors,
}: UNProposeFormProps) {
  const t = useTranslations('panelUN');
  const tShared = useTranslations('panelShared');

  const [kind, setKind] = useState<UNResolutionKind>('sanctions');
  const [targetCountry, setTargetCountry] = useState<CountryId>('');
  const [targetRegion, setTargetRegion] = useState<RegionId>('');

  const meta = KIND_META[kind];
  const needsCountry = meta.target === 'country';
  const needsRegion = meta.target === 'region';

  // Validation: depending on the kind, we may require a country or region
  // before we can dispatch the action. The engine will repeat the check
  // server-side, but we surface a friendlier disabled hint up front.
  const disabledReason: string | null = useMemo(() => {
    if (needsCountry && !targetCountry) return t('propose.pickCountry');
    if (needsRegion && !targetRegion) return t('propose.pickRegion');
    return null;
  }, [needsCountry, needsRegion, targetCountry, targetRegion, t]);

  const handleSubmit = async () => {
    if (disabledReason) return [];
    const args: {
      kind: UNResolutionKind;
      targetCountryId?: CountryId;
      targetRegionId?: RegionId;
    } = { kind };
    if (needsCountry && targetCountry) args.targetCountryId = targetCountry;
    if (needsRegion && targetRegion) args.targetRegionId = targetRegion;
    const errors = await onSubmit(args);
    if (errors.length === 0) {
      // Reset back to the default state on success so the form is ready for
      // a follow-up proposal without an extra reload.
      setTargetCountry('');
      setTargetRegion('');
    }
    return errors;
  };

  return (
    <form
      className="flex flex-col gap-3 pt-1"
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit();
      }}
    >
      {/* Kind selector */}
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-fg">{t('propose.kindLabel')}</span>
        <select
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as UNResolutionKind);
            // Clear stale targets when the kind changes — different kinds may
            // accept different target shapes.
            setTargetCountry('');
            setTargetRegion('');
          }}
          className="rounded-sm border border-border bg-transparent px-2 py-1.5 text-xs text-fg outline-none transition focus:border-accent focus-visible:border-accent"
        >
          {KIND_OPTIONS.map((k) => (
            <option key={k} value={k}>
              {t(`kind.${k}`)}
            </option>
          ))}
        </select>
        <span className="text-[11px] leading-snug text-fg-muted">
          {t(`kindDescription.${kind}`)}
        </span>
      </label>

      {/* Target country */}
      {needsCountry ? (
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-fg">
            {t('propose.targetCountryLabel')}
          </span>
          <select
            value={targetCountry}
            onChange={(e) => setTargetCountry(e.target.value)}
            className="rounded-sm border border-border bg-transparent px-2 py-1.5 text-xs text-fg outline-none transition focus:border-accent focus-visible:border-accent"
          >
            <option value="">{t('propose.targetPlaceholder')}</option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {countryName(c.id)}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {/* Target region */}
      {needsRegion ? (
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-fg">
            {t('propose.targetRegionLabel')}
          </span>
          <select
            value={targetRegion}
            onChange={(e) => setTargetRegion(e.target.value)}
            className="rounded-sm border border-border bg-transparent px-2 py-1.5 text-xs text-fg outline-none transition focus:border-accent focus-visible:border-accent"
          >
            <option value="">{t('propose.targetPlaceholder')}</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {regionName(r)}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {/* Preview */}
      <section
        className={cn('border-t border-border pt-2 text-[11px] text-fg-muted')}
        aria-label={t('propose.previewLabel')}
      >
        <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
          {t('propose.previewLabel')}
        </h4>
        <ul className="ml-3 list-disc space-y-0.5">
          {meta.previewBullets.map((bk) => (
            <li key={bk}>{t(`propose.preview.${bk}`)}</li>
          ))}
        </ul>
      </section>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-sm border border-border bg-transparent px-3 py-1.5 text-xs text-fg-muted transition hover:border-border-strong hover:text-fg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          >
            {tShared('cancel')}
          </button>
        ) : null}
        <div className="flex-1">
          <ActionButton
            tone="primary"
            disabledReason={disabledReason}
            onClick={handleSubmit}
            onErrors={onErrors}
          >
            {t('propose.submit')}
          </ActionButton>
        </div>
      </div>
    </form>
  );
}

export default UNProposeForm;
