'use client';

// Root of the first-time tutorial. Mounted by the play page next to the HUD,
// the world map and the panels. Sequence:
//   1. Hook reads the dismissed flag from IndexedDB on mount.
//   2. If not dismissed, the game is paused (speed → 0) and the intro modal
//      appears. Otherwise the component renders nothing.
//   3. The player walks through 6 steps (intro → HUD → map → panels → speed
//      → outro) using "Avanti" / "Indietro" / "Salta" buttons.
//   4. On complete or skip we resume the game (1× speed) and persist the
//      dismissed flag so the tutorial never reappears.
//
// We intentionally re-implement the centred "intro/outro" frame rather than
// reuse the Modal primitive — Modal allows ESC dismissal and click-outside
// dismissal, both of which are explicitly forbidden for the tutorial. ESC
// here advances to the next step; only the explicit "Salta" button skips.

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { cn } from '../../lib/cn';
import { useGameStore } from '../../lib/store';

import {
  TUTORIAL_STEPS,
  type TutorialAnchoredStep,
  type TutorialStep,
} from './tutorialSteps';
import { TutorialStep as TutorialStepCard } from './TutorialStep';
import { useTutorialState } from './useTutorialState';

/**
 * `<TutorialOverlay />` is the only export consumers need. It self-bootstraps
 * via the persistence flag and renders nothing once dismissed. Mount it once
 * inside the play screen — multiple mounts will produce multiple modals.
 */
export function TutorialOverlay() {
  const tutorial = useTutorialState();
  const t = useTranslations('tutorial');
  const tCommon = useTranslations('common');
  const setSpeed = useGameStore((s) => s.setSpeed);

  // Pause the game when the overlay first becomes visible, and restore play
  // (1×) when it goes away. We snapshot the previous speed so we can restore
  // *something* sensible if the player was already paused. Keeping the
  // restore deterministic (always 1×) was chosen by the spec.
  const wasPausedByTutorial = useRef(false);

  useEffect(() => {
    if (!tutorial.isReady) return;
    if (tutorial.shouldShow) {
      // Pause via the store directly — the ticker auto-syncs on the next frame.
      useGameStore.setState({ speed: 0 });
      wasPausedByTutorial.current = true;
    } else if (wasPausedByTutorial.current) {
      // Resume play. We use the store action so the preferred-speed slice
      // gets updated correctly.
      setSpeed(1);
      wasPausedByTutorial.current = false;
    }
  }, [tutorial.isReady, tutorial.shouldShow, setSpeed]);

  // ESC advances to the next step instead of dismissing the overlay.
  useEffect(() => {
    if (!tutorial.shouldShow) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      tutorial.next();
    };
    // Capture phase so we beat the underlying Modal primitive's ESC handler
    // (the play page does not currently render a modal alongside us, but
    // belt-and-braces if a future feature adds one).
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [tutorial]);

  if (!tutorial.isReady || !tutorial.shouldShow) return null;

  const step = TUTORIAL_STEPS[tutorial.currentStepIndex];
  if (!step) return null;

  return (
    <TutorialOverlayBody
      step={step}
      stepIndex={tutorial.currentStepIndex}
      totalSteps={tutorial.totalSteps}
      onNext={tutorial.next}
      onPrev={tutorial.prev}
      onSkip={tutorial.skip}
      onComplete={tutorial.complete}
      labels={{
        title: t('title'),
        start: t('start'),
        next: t('next'),
        prev: t('prev'),
        skip: t('skip'),
        complete: t('complete'),
        dontShowAgain: t('dontShowAgain'),
        introBody: t('intro.body'),
        footerNote: t('footerNote'),
        stepOf: tCommon('loading'), // unused; placeholder to keep namespace warm
        stepLabel: (n: number, m: number) =>
          t('stepLabel', { current: n, total: m }),
      }}
      stepTitle={t(`steps.${idForI18n(step)}.title` as Parameters<typeof t>[0])}
      stepBody={t(`steps.${idForI18n(step)}.body` as Parameters<typeof t>[0])}
    />
  );
}

// `intro` and `outro` keys live at the top level of the namespace, not under
// `steps.*`. We map them through this helper so the lookup stays a single
// concern.
function idForI18n(step: TutorialStep): string {
  if (step.kind === 'intro') return 'intro';
  if (step.kind === 'outro') return 'outro';
  return step.id;
}

// ---------------------------------------------------------------------------
// Inner body — receives already-resolved labels so it doesn't have to know
// about useTranslations(). Eases potential testing later.
// ---------------------------------------------------------------------------

type LabelBag = {
  title: string;
  start: string;
  next: string;
  prev: string;
  skip: string;
  complete: string;
  dontShowAgain: string;
  introBody: string;
  footerNote: string;
  stepOf: string;
  stepLabel: (current: number, total: number) => string;
};

type TutorialOverlayBodyProps = {
  step: TutorialStep;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onComplete: () => void;
  labels: LabelBag;
  stepTitle: string;
  stepBody: string;
};

function TutorialOverlayBody({
  step,
  stepIndex,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
  onComplete,
  labels,
  stepTitle,
  stepBody,
}: TutorialOverlayBodyProps) {
  const stepLabel = labels.stepLabel(stepIndex + 1, totalSteps);
  const isAnchoredStep = step.kind === 'anchored';

  // Resolve the anchor element for anchored steps. We re-resolve on each
  // render of this body so a layout change (panel switch, locale flip)
  // re-binds the tooltip to the new node. The TutorialStep card additionally
  // listens to resize / scroll events for fine-grained re-positioning.
  const anchor = useResolvedAnchor(isAnchoredStep ? step : null);

  if (step.kind === 'intro') {
    return (
      <CenteredFrame>
        <CenteredCard
          title={labels.title}
          body={labels.introBody}
          stepLabel={stepLabel}
          primaryLabel={labels.start}
          onPrimary={onNext}
          secondaryLabel={labels.skip}
          onSecondary={onSkip}
          footerNote={labels.footerNote}
        />
      </CenteredFrame>
    );
  }

  if (step.kind === 'outro') {
    return (
      <CenteredFrame>
        <CenteredCard
          title={stepTitle}
          body={stepBody}
          stepLabel={stepLabel}
          primaryLabel={labels.dontShowAgain}
          onPrimary={onComplete}
          secondaryLabel={labels.prev}
          onSecondary={onPrev}
          footerNote={labels.footerNote}
        />
      </CenteredFrame>
    );
  }

  // Anchored step — render the dim backdrop plus the tooltip card.
  return (
    <DimBackdrop>
      <TutorialStepCard
        anchor={anchor}
        title={stepTitle}
        body={stepBody}
        position={step.position}
        stepLabel={stepLabel}
        prevLabel={stepIndex > 0 ? labels.prev : undefined}
        nextLabel={labels.next}
        skipLabel={labels.skip}
        onNext={onNext}
        onPrev={stepIndex > 0 ? onPrev : undefined}
        onSkip={onSkip}
      />
    </DimBackdrop>
  );
}

// ---------------------------------------------------------------------------
// Anchor resolution
// ---------------------------------------------------------------------------

function useResolvedAnchor(step: TutorialAnchoredStep | null): Element | null {
  const [anchor, setAnchor] = useState<Element | null>(null);

  // The DOM is an external system here — we synchronise the anchor element
  // we resolved from `document.querySelector` into React state so the card
  // can re-render with the new geometry. The lint rule about setState in
  // effects is a false positive for this synchronisation pattern; the
  // codebase already uses the same exception in `lib/ticker.ts` and
  // `components/Map/WorldMap.tsx`.
  useEffect(() => {
    if (!step) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAnchor(null);
      return;
    }
    const tryResolve = () => {
      try {
        const el = document.querySelector(step.anchorSelector);
        setAnchor(el);
        return Boolean(el);
      } catch {
        // `:has()` is widely supported in 2026 evergreen browsers but we
        // tolerate older engines silently.
        setAnchor(null);
        return true; // don't keep retrying on a SyntaxError
      }
    };

    if (tryResolve()) return;
    // Anchor may not have been rendered yet (race with hydration). Retry on
    // the next frame and once more after a short delay to give the rest of
    // the page time to settle.
    const raf = window.requestAnimationFrame(() => {
      if (tryResolve()) return;
      window.setTimeout(tryResolve, 100);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [step]);

  return anchor;
}

// ---------------------------------------------------------------------------
// Centred intro / outro frame (modal-style, no dismissal except via buttons)
// ---------------------------------------------------------------------------

function CenteredFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-bg/70 p-4 transition-opacity duration-200"
      role="presentation"
    >
      {children}
    </div>
  );
}

function DimBackdrop({ children }: { children: React.ReactNode }) {
  // Backdrop click does NOT dismiss — modal-style behaviour required by spec.
  return (
    <div
      className="fixed inset-0 z-40 bg-bg/50 transition-opacity duration-200"
      role="presentation"
      aria-hidden
    >
      {/* The card itself is rendered as a sibling so the backdrop's
          `aria-hidden` doesn't poison the tooltip semantics. */}
      <div className="pointer-events-none">{children}</div>
    </div>
  );
}

type CenteredCardProps = {
  title: string;
  body: string;
  stepLabel: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel: string;
  onSecondary: () => void;
  footerNote: string;
};

function CenteredCard({
  title,
  body,
  stepLabel,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  footerNote,
}: CenteredCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const primaryRef = useRef<HTMLButtonElement | null>(null);
  const reactId = useId();
  const titleId = `tutorial-title-${reactId}`;
  const descId = `tutorial-desc-${reactId}`;

  // Focus the primary CTA on mount so keyboard users can confirm with Enter.
  useEffect(() => {
    primaryRef.current?.focus();
  }, []);

  // Tab trap inside the card.
  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const card = cardRef.current;
    if (!card) return;
    const focusables = Array.from(
      card.querySelectorAll<HTMLElement>('button:not([disabled])'),
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey) {
      if (active === first || !card.contains(active)) {
        e.preventDefault();
        last?.focus();
      }
    } else if (active === last) {
      e.preventDefault();
      first?.focus();
    }
  }, []);

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className={cn(
        'relative flex w-full max-w-md flex-col gap-4 rounded-2xl border border-border bg-surface-1 p-6 text-fg shadow-2xl outline-none',
      )}
    >
      <header className="flex items-baseline justify-between gap-3">
        <h2 id={titleId} className="text-lg font-semibold text-fg">
          {title}
        </h2>
        <span className="text-[11px] uppercase tracking-wider text-fg-faint">
          {stepLabel}
        </span>
      </header>
      <p
        id={descId}
        className="text-sm leading-relaxed text-fg-muted"
      >
        {body}
      </p>
      <p className="text-[11px] leading-relaxed text-fg-faint">{footerNote}</p>
      <footer className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onSecondary}
          className="rounded-md px-3 py-1 text-xs text-fg-faint transition hover:text-fg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-border-strong"
        >
          {secondaryLabel}
        </button>
        <button
          ref={primaryRef}
          type="button"
          onClick={onPrimary}
          className="rounded-md border border-accent bg-accent/15 px-4 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {primaryLabel}
        </button>
      </footer>
    </div>
  );
}

export default TutorialOverlay;
