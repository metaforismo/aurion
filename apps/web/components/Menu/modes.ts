// The five game modes as the player meets them. The engine ids stay
// internal; menus use the player-facing names under the `modes` namespace.

import { KARDASHEV_START, type GameMode, type VictoryConditionId } from '@aurion/engine';
import {
  BookOpen,
  Crown,
  Flag,
  Infinity as InfinityIcon,
  Rocket,
  type LucideIcon,
} from 'lucide-react';

export type ModeMeta = {
  id: GameMode;
  /** Key under the `modes` i18n namespace. */
  key: 'odyssey' | 'campaign' | 'spaceRace' | 'throne' | 'chronicles';
  icon: LucideIcon;
  /** Only Campaign lets the player choose how the game is won. */
  choosesVictory: boolean;
  /**
   * Victory condition handed to the engine when the mode doesn't ask.
   * Odyssey tracks every condition as a milestone and Space Race ignores
   * it; Throne and Chronicles end early on it, so they get the hardest one.
   */
  fixedVictory: VictoryConditionId;
  /** Needs a world that declares historical eras. */
  needsEras: boolean;
};

/** Display order: the recommended long game first. */
export const MODES: readonly ModeMeta[] = [
  {
    id: 'eternal',
    key: 'odyssey',
    icon: InfinityIcon,
    choosesVictory: false,
    fixedVictory: 'ascension',
    needsEras: false,
  },
  {
    id: 'classic',
    key: 'campaign',
    icon: Flag,
    choosesVictory: true,
    fixedVictory: 'economic',
    needsEras: false,
  },
  {
    id: 'space-race',
    key: 'spaceRace',
    icon: Rocket,
    choosesVictory: false,
    fixedVictory: 'ascension',
    needsEras: false,
  },
  {
    id: 'dethrone',
    key: 'throne',
    icon: Crown,
    choosesVictory: false,
    fixedVictory: 'domination',
    needsEras: false,
  },
  {
    id: 'era-paced',
    key: 'chronicles',
    icon: BookOpen,
    choosesVictory: false,
    fixedVictory: 'domination',
    needsEras: true,
  },
];

export const RECOMMENDED_MODE: GameMode = 'eternal';

export function modeMeta(id: GameMode): ModeMeta {
  return MODES.find((m) => m.id === id) ?? MODES[0]!;
}

/** 0..1 progress toward the next Kardashev type. */
export function kardashevProgress(rating: number): number {
  if (rating < 1) return Math.max(0, (rating - KARDASHEV_START) / (1 - KARDASHEV_START));
  return rating - Math.floor(rating);
}
