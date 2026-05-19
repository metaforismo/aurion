// Two-step confirm modal for nuclear strikes.
//
// This is the most morally weighted UI in Aurion. The two-step flow is
// deliberate friction:
//
//   Step 1 — pause-and-read advisory ("AVVERTENZA — Stai per usare un'arma
//            nucleare …"). The "Continua" button is disabled for 3 seconds
//            after the modal opens (anti-misclick + signals "this is serious").
//
//   Step 2 — sanity check. The player must type the literal string `LANCIO`
//            (case-sensitive) to enable the final "Lancia" button.
//
// Both steps are NON-DISMISSABLE: ESC and backdrop clicks do not cancel,
// because cancelling the modal must be an explicit, deliberate choice. The
// Annulla button on each step is the only way out.
//
// The modal is fully driven by a single `request` prop owned by the caller
// (MilitaryPanel). When confirmed, `onConfirm()` fires; on any cancel path,
// `onCancel()` fires. Neither callback is invoked twice — internal state
// gates against re-entry.

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Skull } from 'lucide-react';

import { cn } from '../../lib/cn';
import { tone } from '../../lib/theme';

import { Modal } from './Modal';

/**
 * The kind of strike being confirmed. Drives target-label rendering and the
 * MAD warning visibility on step 1.
 */
export type NuclearLaunchKind = 'tactical' | 'strategic';

export type NuclearLaunchConfirmRequest = {
  kind: NuclearLaunchKind;
  /**
   * Pre-formatted target label shown on step 1 (e.g. region name or country
   * name). The caller is responsible for translating it via the appropriate
   * scenario / map message bundle.
   */
  targetLabel: string;
  /**
   * If true, the step-1 advisory shows the explicit MAD warning chip (target
   * is itself a nuclear power → strategic strike will trigger reciprocal
   * destruction). Engine determines this from current intel; UI just renders.
   */
  madRisk: boolean;
};

export type NuclearLaunchConfirmProps = {
  request: NuclearLaunchConfirmRequest;
  /** Player committed to the strike — caller dispatches the engine action. */
  onConfirm: () => void;
  /** Player explicitly cancelled (Annulla on either step). */
  onCancel: () => void;
};

/** Step 1 cooldown — milliseconds before the "Continua" button becomes clickable. */
const STEP_1_COOLDOWN_MS = 3000;
/** The exact (case-sensitive) word the player must type to enable "Lancia". */
const CONFIRMATION_WORD = 'LANCIO';

export function NuclearLaunchConfirm({
  request,
  onConfirm,
  onCancel,
}: NuclearLaunchConfirmProps) {
  const t = useTranslations('modals.nuclearConfirm');
  const [step, setStep] = useState<1 | 2>(1);
  const [committed, setCommitted] = useState(false);

  const handleCancel = () => {
    if (committed) return;
    onCancel();
  };

  const handleAdvance = () => {
    if (committed) return;
    setStep(2);
  };

  const handleConfirm = () => {
    if (committed) return;
    setCommitted(true);
    onConfirm();
  };

  if (step === 1) {
    return (
      <Step1
        kind={request.kind}
        targetLabel={request.targetLabel}
        madRisk={request.madRisk}
        onAdvance={handleAdvance}
        onCancel={handleCancel}
        t={t}
      />
    );
  }
  return (
    <Step2
      kind={request.kind}
      targetLabel={request.targetLabel}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      t={t}
    />
  );
}

// ---------------------------------------------------------------------------
// Step 1 — advisory + 3-second "Continua" cooldown
// ---------------------------------------------------------------------------

function Step1({
  kind,
  targetLabel,
  madRisk,
  onAdvance,
  onCancel,
  t,
}: {
  kind: NuclearLaunchKind;
  targetLabel: string;
  madRisk: boolean;
  onAdvance: () => void;
  onCancel: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  // Countdown from STEP_1_COOLDOWN_MS to 0 in 100 ms increments, so the player
  // sees the timer tick down on the button label. We start the timer as soon
  // as the component mounts (the modal's focus-trap also activates here).
  const [remainingMs, setRemainingMs] = useState(STEP_1_COOLDOWN_MS);
  useEffect(() => {
    if (remainingMs <= 0) return;
    const id = window.setInterval(() => {
      setRemainingMs((prev) => {
        const next = prev - 100;
        if (next <= 0) {
          window.clearInterval(id);
          return 0;
        }
        return next;
      });
    }, 100);
    return () => window.clearInterval(id);
  }, [remainingMs]);

  const remainingSec = Math.ceil(remainingMs / 1000);
  const continueDisabled = remainingMs > 0;
  const continueLabel = continueDisabled
    ? t('step1.continueLocked', { seconds: remainingSec })
    : t('step1.continue');

  return (
    <Modal
      // ESC + backdrop are inert — only the explicit Annulla button cancels.
      dismissable={false}
      size="md"
      className="border-danger"
      title={
        <span className="flex items-center gap-2">
          <AlertTriangle aria-hidden className={cn('h-4 w-4', tone('danger'))} />
          <span className={cn(tone('danger'))}>{t('step1.title')}</span>
        </span>
      }
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-sm border border-border bg-transparent px-4 py-2 text-xs font-semibold text-fg transition hover:border-border-strong focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          >
            {t('step1.cancel')}
          </button>
          <button
            type="button"
            onClick={onAdvance}
            disabled={continueDisabled}
            aria-disabled={continueDisabled}
            className={cn(
              'rounded-sm border bg-transparent px-4 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent',
              continueDisabled
                ? 'cursor-not-allowed border-border text-fg-faint'
                : 'border-border text-danger hover:border-danger',
            )}
          >
            {continueLabel}
          </button>
        </>
      }
    >
      <div className="space-y-4" data-testid="nuclear-confirm-stage-1">
        <p className={cn('font-semibold leading-relaxed', tone('danger'))}>
          {t('step1.body')}
        </p>
        <ul className="ml-4 list-disc space-y-1 text-xs leading-relaxed text-fg-muted">
          <li>{t(`step1.consequence.${kind}.reputation`)}</li>
          <li>{t(`step1.consequence.${kind}.warChain`)}</li>
          <li>{t(`step1.consequence.${kind}.aftermath`)}</li>
        </ul>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-y border-border py-2 text-xs">
          <dt className="font-semibold uppercase tracking-[0.14em] text-fg-muted">
            {t('step1.targetLabel')}
          </dt>
          <dd className="font-mono text-fg">{targetLabel}</dd>
          <dt className="font-semibold uppercase tracking-[0.14em] text-fg-muted">
            {t('step1.kindLabel')}
          </dt>
          <dd className="font-mono text-fg">{t(`step1.kind.${kind}`)}</dd>
        </dl>
        {madRisk ? (
          <div
            role="alert"
            className={cn(
              'flex items-start gap-2 border-l-2 border-danger px-3 py-2 text-xs font-semibold',
              tone('danger'),
            )}
          >
            <Skull aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t('mad.warning')}</span>
          </div>
        ) : null}
        <p className="text-[11px] italic leading-relaxed text-fg-faint">
          {t('step1.helper')}
        </p>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — sanity check (type LANCIO to confirm)
// ---------------------------------------------------------------------------

function Step2({
  kind,
  targetLabel,
  onConfirm,
  onCancel,
  t,
}: {
  kind: NuclearLaunchKind;
  targetLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const [typed, setTyped] = useState('');

  // Case-sensitive match against the literal CONFIRMATION_WORD. Trailing
  // whitespace is tolerated (intent: "the player typed LANCIO"), leading
  // whitespace is not (forces the player to deliberately type the word).
  const match = useMemo(() => typed.trimEnd() === CONFIRMATION_WORD, [typed]);
  const mismatch = typed.length > 0 && !match;

  return (
    <Modal
      dismissable={false}
      size="md"
      className="border-danger"
      title={
        <span className="flex items-center gap-2">
          <Skull aria-hidden className={cn('h-4 w-4', tone('danger'))} />
          <span className={cn(tone('danger'))}>{t('step2.title')}</span>
        </span>
      }
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-sm border border-border bg-transparent px-4 py-2 text-xs font-semibold text-fg transition hover:border-border-strong focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          >
            {t('step2.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!match}
            aria-disabled={!match}
            className={cn(
              'rounded-sm border px-4 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent',
              match
                ? 'border-danger bg-danger text-bg'
                : 'cursor-not-allowed border-border bg-transparent text-fg-faint',
            )}
          >
            {t('step2.confirm')}
          </button>
        </>
      }
    >
      <div className="space-y-4" data-testid="nuclear-confirm-stage-2">
        <p className={cn('font-semibold leading-relaxed', tone('danger'))}>
          {t('step2.body')}
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-y border-border py-2 text-xs">
          <dt className="font-semibold uppercase tracking-[0.14em] text-fg-muted">
            {t('step2.targetLabel')}
          </dt>
          <dd className="font-mono text-fg">{targetLabel}</dd>
          <dt className="font-semibold uppercase tracking-[0.14em] text-fg-muted">
            {t('step2.kindLabel')}
          </dt>
          <dd className="font-mono text-fg">{t(`step1.kind.${kind}`)}</dd>
        </dl>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="nuclear-confirm-input"
            className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-muted"
          >
            {t('step2.prompt', { word: CONFIRMATION_WORD })}
          </label>
          <input
            id="nuclear-confirm-input"
            data-testid="nuclear-confirm-input"
            type="text"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            aria-invalid={mismatch || undefined}
            className={cn(
              'rounded-sm border bg-transparent px-3 py-2 font-mono text-sm text-fg outline-none transition focus:border-accent',
              match
                ? 'border-danger'
                : mismatch
                  ? 'border-danger'
                  : 'border-border',
            )}
          />
          {mismatch ? (
            <p className={cn('text-[11px] italic', tone('danger'))}>
              {t('step2.mismatch', { word: CONFIRMATION_WORD })}
            </p>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

export default NuclearLaunchConfirm;
