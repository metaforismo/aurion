// Vertical tab strip rendered on the left of the play screen. Hosts the 6
// game-system panels and switches between them based on `selectedPanel` in
// the store. Default export of the components/Panels package.

'use client';

import { useTranslations } from 'next-intl';
import {
  Coins,
  Flag,
  FlaskConical,
  Landmark,
  Shield,
  UserSearch,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useState } from 'react';

import { cn } from '../../lib/cn';
import {
  PANEL_IDS,
  useGameStore,
  type GameStoreState,
  type PanelId,
} from '../../lib/store';

import { DiplomacyPanel } from './DiplomacyPanel';
import { EconomyPanel } from './EconomyPanel';
import { MilitaryPanel } from './MilitaryPanel';
import { PoliticsPanel } from './PoliticsPanel';
import { ResearchPanel } from './ResearchPanel';
import { SpiesPanel } from './SpiesPanel';

const PANEL_ICONS: Record<PanelId, LucideIcon> = {
  economy: Coins,
  research: FlaskConical,
  military: Shield,
  spies: UserSearch,
  diplomacy: Flag,
  politics: Landmark,
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
  const selectedPanel = useGameStore((s: GameStoreState) => s.selectedPanel);
  const setSelectedPanel = useGameStore(
    (s: GameStoreState) => s.setSelectedPanel,
  );

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

  const ActivePanel = PANEL_COMPONENTS[selectedPanel];

  return (
    <aside
      className={cn(
        'flex h-full w-full flex-col overflow-hidden rounded-xl border border-border bg-surface/40',
        className,
      )}
      aria-label={tRail('label')}
    >
      <nav
        role="tablist"
        aria-orientation="vertical"
        aria-label={tRail('tablistLabel')}
        className="flex shrink-0 flex-row gap-0.5 border-b border-border bg-bg/60 p-1 lg:flex-col lg:border-b-0 lg:border-r"
      >
        {PANEL_IDS.map((id) => {
          const Icon = PANEL_ICONS[id];
          const active = id === selectedPanel;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`panel-${id}`}
              id={`tab-${id}`}
              onClick={() => setSelectedPanel(id)}
              className={cn(
                'group flex flex-1 items-center justify-start gap-2 rounded-md px-2 py-2 text-left text-xs transition lg:flex-none',
                active
                  ? 'bg-accent/15 text-accent'
                  : 'text-fg-muted hover:bg-surface-2/60 hover:text-fg',
              )}
            >
              <Icon
                aria-hidden
                className={cn(
                  'h-4 w-4 shrink-0',
                  active ? 'text-accent' : 'text-fg-faint group-hover:text-fg',
                )}
              />
              <span className="truncate font-medium">{t(id)}</span>
            </button>
          );
        })}
      </nav>

      <div
        role="tabpanel"
        id={`panel-${selectedPanel}`}
        aria-labelledby={`tab-${selectedPanel}`}
        className="flex-1 overflow-y-auto"
      >
        {inlineErrors.length > 0 ? (
          <ul
            role="alert"
            className="m-2 flex flex-col gap-1 rounded-md border border-danger bg-danger/15 p-2 text-[11px] text-danger"
          >
            {inlineErrors.map((err, i) => (
              <li key={`${err}-${i}`}>{err}</li>
            ))}
          </ul>
        ) : null}
        <ActivePanel onErrors={handleErrors} />
      </div>
    </aside>
  );
}

export default PanelTabs;
