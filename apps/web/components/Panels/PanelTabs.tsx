// Vertical tab strip rendered on the left of the play screen. Hosts the 7
// game-system panels and switches between them based on `selectedPanel` in
// the store. Default export of the components/Panels package.
//
// Discoverability upgrades:
//   - Notification badges (top-right dot on the tab icon) indicating the
//     panel has an actionable state. Color follows the semantic intent —
//     danger / warning / info. Always paired with an `aria-label` so SR
//     users hear the same signal.
//   - Number shortcuts 1..7. Pressing the digit selects the panel in the
//     same order the tabs are rendered. Ignored when the user is typing
//     into an input / textarea / contenteditable (same helper as Hud.tsx).
//   - Each tab surfaces its shortcut digit in a [N] hint in the
//     bottom-right of the button so the affordance is discoverable.

'use client';

import { useTranslations } from 'next-intl';
import {
  Coins,
  Flag,
  FlaskConical,
  Globe,
  Landmark,
  Shield,
  UserSearch,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { cn } from '../../lib/cn';
import {
  PANEL_IDS,
  selectPlayerCountry,
  useGameStore,
  type GameStoreState,
  type PanelId,
} from '../../lib/store';

import { AdvisorStrip } from './AdvisorStrip';
import { DiplomacyPanel } from './DiplomacyPanel';
import { EconomyPanel } from './EconomyPanel';
import { MilitaryPanel } from './MilitaryPanel';
import { PoliticsPanel } from './PoliticsPanel';
import { ResearchPanel } from './ResearchPanel';
import { SpiesPanel } from './SpiesPanel';
import { UNPanel } from './UNPanel';

const PANEL_ICONS: Record<PanelId, LucideIcon> = {
  economy: Coins,
  research: FlaskConical,
  military: Shield,
  spies: UserSearch,
  diplomacy: Flag,
  politics: Landmark,
  un: Globe,
};

const PANEL_COMPONENTS: Record<
  PanelId,
  React.ComponentType<{ onErrors?: (errors: string[]) => void }>
> = {
  economy: EconomyPanel,
  research: ResearchPanel,
  military: MilitaryPanel,
  spies: SpiesPanel,
  diplomacy: DiplomacyPanel,
  politics: PoliticsPanel,
  un: UNPanel,
};

// Badge tone → CSS variable. Kept here so all colour decisions for the rail
// live in one table; if we ever introduce a fourth tone we update once.
type BadgeTone = 'danger' | 'warning' | 'info';
const BADGE_COLOR: Record<BadgeTone, string> = {
  danger: 'var(--color-danger)',
  warning: 'var(--color-warning)',
  info: 'var(--color-info)',
};

type PanelBadge = {
  tone: BadgeTone;
  /** Pre-translated SR label. Falsy = no badge. */
  ariaLabel: string;
};

export type PanelTabsProps = {
  /** Optional className applied to the outer container. */
  className?: string;
  /**
   * Optional toast handler. When a panel reports validation errors (i18n keys),
   * we forward them here so the parent (play page / Notifications) can render
   * a real toast. If not provided, we render a transient inline banner inside
   * the tabs container.
   */
  onErrors?: (errors: string[]) => void;
};

export function PanelTabs({ className, onErrors }: PanelTabsProps) {
  const t = useTranslations('panels');
  const tRail = useTranslations('panelRail');
  const tIntro = useTranslations('panelIntro');
  const selectedPanel = useGameStore((s: GameStoreState) => s.selectedPanel);
  const setSelectedPanel = useGameStore(
    (s: GameStoreState) => s.setSelectedPanel,
  );

  // Pull the slices needed to compute badges. We subscribe to whole objects
  // here (rather than the derived booleans) because Zustand selectors must
  // return stable references — the per-panel derivation below stays cheap.
  const state = useGameStore((s: GameStoreState) => s.state);
  const player = useGameStore(selectPlayerCountry);
  const scenario = useGameStore((s: GameStoreState) => s.scenario);

  const badges = useMemo<Partial<Record<PanelId, PanelBadge>>>(() => {
    return computeBadges({
      state,
      player,
      scenario,
      tRail,
    });
    // tRail is stable per locale; state/player/scenario are the meaningful inputs.
  }, [state, player, scenario, tRail]);

  const [inlineErrors, setInlineErrors] = useState<string[]>([]);

  // Forward errors externally if a handler was provided; otherwise show a
  // transient inline list at the top of the panel content.
  const handleErrors = useCallback(
    (errors: string[]) => {
      if (onErrors) {
        onErrors(errors);
        return;
      }
      setInlineErrors(errors);
      // Auto-clear after 3.5s — non-critical UX nicety.
      window.setTimeout(() => setInlineErrors([]), 3500);
    },
    [onErrors],
  );

  // Number-key shortcuts 1..7. Mirrors the spacebar pattern in Hud.tsx —
  // ignored when the focus is on an editable surface so it doesn't fight
  // numeric inputs in panel composers.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: KeyboardEvent) => {
      // Don't steal shortcuts that have a modifier — those belong to the OS
      // or the browser (e.g. cmd+1 switches tabs).
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      // We listen on `e.key` (digit) rather than `e.code` so number-row vs
      // numpad both work and keyboard layouts that reshuffle digits still hit.
      const digit = Number(e.key);
      if (!Number.isInteger(digit) || digit < 1 || digit > PANEL_IDS.length) {
        return;
      }
      const targetId = PANEL_IDS[digit - 1];
      if (!targetId) return;
      e.preventDefault();
      setSelectedPanel(targetId);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setSelectedPanel]);

  const ActivePanel = PANEL_COMPONENTS[selectedPanel];

  return (
    <aside
      className={cn(
        'flex h-full w-full flex-col overflow-hidden border border-border bg-bg',
        className,
      )}
      aria-label={tRail('label')}
    >
      <nav
        role="tablist"
        aria-orientation="vertical"
        aria-label={tRail('tablistLabel')}
        className="flex shrink-0 flex-row border-b border-border lg:flex-col lg:border-b-0 lg:border-r"
      >
        {PANEL_IDS.map((id, index) => {
          const Icon = PANEL_ICONS[id];
          const active = id === selectedPanel;
          const shortcut = index + 1;
          const badge = badges[id];
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`panel-${id}`}
              aria-keyshortcuts={`${shortcut}`}
              id={`tab-${id}`}
              onClick={() => setSelectedPanel(id)}
              title={tRail('shortcutHint', { key: shortcut })}
              className={cn(
                // Underline-only tab. Active: 2px bottom in accent; inactive:
                // 1px bottom in border. On vertical (lg) layout the underline
                // becomes a left border (2px / 1px) so the editorial line
                // motif stays consistent.
                'group relative flex flex-1 items-center justify-start gap-2 px-3 py-2.5 pr-7 text-left text-xs transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent lg:flex-none',
                'border-b-2 lg:border-b-0 lg:border-l-2',
                active
                  ? 'border-accent bg-accent/[0.07] text-fg'
                  : 'border-transparent text-fg-muted hover:text-fg',
              )}
            >
              <span className="relative inline-flex shrink-0">
                <Icon
                  aria-hidden
                  className={cn(
                    'h-4 w-4 shrink-0',
                    active ? 'text-accent' : 'text-fg-faint group-hover:text-fg',
                  )}
                />
                {badge ? (
                  <span
                    // Small dot anchored to the top-right of the icon. The
                    // accessible label lives on the parent <span> so SR users
                    // hear "ONU, 1 azione richiesta" without two tab stops.
                    role="status"
                    aria-label={badge.ariaLabel}
                    className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full ring-1 ring-bg"
                    style={{ backgroundColor: BADGE_COLOR[badge.tone] }}
                  />
                ) : null}
              </span>
              <span className="truncate font-medium">{t(id)}</span>
              {/* Shortcut hint — small mono digit anchored to the bottom-right
                  of the button. Doesn't compete with the label; readable but
                  intentionally quiet. `aria-hidden` because the shortcut is
                  also surfaced via aria-keyshortcuts above. */}
              <span
                aria-hidden
                className="pointer-events-none absolute bottom-1 right-2 font-mono text-[10px] leading-none text-fg-faint"
              >
                [{shortcut}]
              </span>
            </button>
          );
        })}
      </nav>

      {/* Advisor — "what should I do now?" Suggestions derive from the same
          signals as the tab badges and navigate straight to the panel where
          the action lives. Renders nothing when all is calm. */}
      <AdvisorStrip onNavigate={setSelectedPanel} />

      <div
        role="tabpanel"
        id={`panel-${selectedPanel}`}
        aria-labelledby={`tab-${selectedPanel}`}
        className="flex-1 overflow-y-auto"
      >
        {/* One-line system explainer — answers "what is this panel for?"
            without costing more than a line of quiet text. */}
        <p className="border-b border-border/60 px-3 py-2 text-[11px] leading-snug text-fg-faint">
          {tIntro(selectedPanel)}
        </p>
        {inlineErrors.length > 0 ? (
          <ul
            role="alert"
            className="m-3 flex flex-col gap-1 border-l-2 border-danger bg-transparent px-3 py-2 text-[11px] text-danger"
          >
            {inlineErrors.map((err, i) => (
              <li key={`${err}-${i}`}>{err}</li>
            ))}
          </ul>
        ) : null}
        {/*
         * Keyed wrapper restarts the `tab-fade` keyframe each time the user
         * picks a new tab. Reduced-motion users get an instant cut via the
         * blanket animation-duration override in globals.css.
         */}
        <div
          key={selectedPanel}
          style={{
            animation: 'tab-fade 160ms cubic-bezier(0, 0, 0.2, 1) both',
          }}
        >
          <ActivePanel onErrors={handleErrors} />
        </div>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Badge derivation. Pure function over the slices we subscribe to above so
// the computation stays predictable and easy to test (no hooks inside).
// ---------------------------------------------------------------------------

function computeBadges(args: {
  state: GameStoreState['state'];
  player: ReturnType<typeof selectPlayerCountry>;
  scenario: GameStoreState['scenario'];
  tRail: ReturnType<typeof useTranslations<'panelRail'>>;
}): Partial<Record<PanelId, PanelBadge>> {
  const { state, player, scenario, tRail } = args;
  const out: Partial<Record<PanelId, PanelBadge>> = {};
  if (!state || !player) return out;

  // — ONU: red dot when the player has at least one resolution awaiting their
  // vote. Voting status + the player's vote slot empty (engine writes the
  // player's id into `votes` once they cast).
  const resolutions = state.unResolutions ?? [];
  const unvoted = resolutions.filter(
    (r) => r.status === 'voting' && r.votes[player.id] === undefined,
  );
  if (unvoted.length > 0) {
    out.un = {
      tone: 'danger',
      ariaLabel: tRail('badge.unvotedResolution'),
    };
  }

  // — Ricerca: amber dot when the player has NO active research AND the tech
  // tree has at least one tech that is available (prereqs met and not yet
  // completed). We compute "available" defensively against an empty tree.
  const activeResearch = player.science.activeResearch;
  const completedSet = new Set(player.science.completedTechs);
  const techs = scenario?.techTree ?? [];
  const hasAvailable = techs.some(
    (tech) =>
      !completedSet.has(tech.id) &&
      tech.prereqs.every((p) => completedSet.has(p)),
  );
  if (activeResearch === null && hasAvailable) {
    out.research = {
      tone: 'warning',
      ariaLabel: tRail('badge.researchIdle'),
    };
  }

  // — Militare: amber dot when at least one war is active AND the player has
  // zero deployed units. We derive `wars` from relations rather than reading a
  // dedicated `state.wars` array (which the engine doesn't expose).
  const me = player.id;
  let atWarCount = 0;
  for (const c of Object.values(state.countries)) {
    if (c.id === me) continue;
    const a = me < c.id ? me : c.id;
    const b = me < c.id ? c.id : me;
    const rel = state.relations[`${a}::${b}`];
    if (rel?.atWar) atWarCount += 1;
  }
  const deployedCount = player.military.deployedUnits.length;
  if (atWarCount > 0 && deployedCount === 0) {
    out.military = {
      tone: 'warning',
      ariaLabel: tRail('badge.warNoDeployment'),
    };
  }

  // — Politica interna: amber dot when popularity < 30 (player risks losing
  // power soon — the engine flips the loss streak once popularity stays below
  // 10 for 12 weeks; 30 gives us a comfortable early-warning band).
  if (player.politics.popularity < 30) {
    out.politics = {
      tone: 'warning',
      ariaLabel: tRail('badge.lowPopularity'),
    };
  }

  // OPEN: Diplomazia "unhandled diplomatic request" badge — the engine does
  // not expose a per-event "kind === diplomacy / unhandled" flag we can
  // filter on without false positives. Skipped intentionally.

  // OPEN: Intelligence "new intel that hasn't been seen" badge — the engine's
  // `intelligence.knownIntel` does not carry a per-target `seen` boolean.
  // Skipped intentionally.

  return out;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Mirrors the helper in Hud.tsx — returns true when the keyboard event was
 * dispatched on an editable surface (form widgets / contenteditable). We
 * suppress the panel shortcuts in that case so typing digits in a numeric
 * input doesn't flip the active panel under the user.
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export default PanelTabs;
