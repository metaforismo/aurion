// Public surface of the Panels package. PanelTabs is the entry point used by
// the play page; the individual panel components are also re-exported in
// case future screens want to compose them à la carte.

export { PanelTabs as default, PanelTabs } from './PanelTabs';
export type { PanelTabsProps } from './PanelTabs';

export { EconomyPanel } from './EconomyPanel';
export { ResearchPanel } from './ResearchPanel';
export { MilitaryPanel } from './MilitaryPanel';
export { SpiesPanel } from './SpiesPanel';
export { DiplomacyPanel } from './DiplomacyPanel';
export { PoliticsPanel } from './PoliticsPanel';
export { UNPanel } from './UNPanel';
export { UNResolutionCard } from './UNResolutionCard';
export { UNProposeForm } from './UNProposeForm';

export { ActionButton } from './shared/ActionButton';
export { Disclosure } from './shared/Disclosure';
export { EmptyState } from './shared/EmptyState';
export { PanelHero } from './shared/PanelHero';
export { Section } from './shared/Section';
export { StatBar } from './shared/StatBar';
