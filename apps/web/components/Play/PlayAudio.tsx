'use client';

// Sound that follows the game rather than the player's clicks: the music bed
// for the current view and tension, and cues for things that finish or break
// out over time (a technology, a megaproject, a war, a covert operation).
// Click feedback lives next to the controls that produce it.

import { useEffect, useRef } from 'react';
import { kardashevType } from '@aurion/engine';

import { useGameStore } from '../../lib/store';
import { startWorldNews } from '../../lib/world-news';
import { useEventModalSfx, useGameplayMusic, useSfx } from '../Audio';

type Snapshot = {
  saveId: string | null;
  techs: number;
  projectsDone: number;
  projectsActive: number;
  kardashevType: number;
  wars: number;
  spyDone: number;
  spyCaught: number;
  achievement: string | null;
};

export function PlayAudio() {
  const mapView = useGameStore((s) => s.mapView);
  const state = useGameStore((s) => s.state);
  const saveId = useGameStore((s) => s.saveId);
  const achievement = useGameStore((s) => s.pendingAchievementToast);
  const sfx = useSfx();

  // Off-world views swap the underscore for the deep-space bed.
  useGameplayMusic({ override: mapView === 'earth' ? null : 'music.space' });
  useEventModalSfx();

  // The diplomatic wire records relation changes for the map and briefing.
  useEffect(() => {
    startWorldNews();
  }, []);

  const prev = useRef<Snapshot | null>(null);
  const lastView = useRef(mapView);

  useEffect(() => {
    if (lastView.current !== mapView) {
      lastView.current = mapView;
      sfx('sfx.zoom');
    }
  }, [mapView, sfx]);

  useEffect(() => {
    if (!state) return;
    const me = state.playerCountryId;
    const player = state.countries[me];
    const ops = state.spyOperations.filter((o) => o.ownerCountryId === me);
    const next: Snapshot = {
      saveId: saveId ?? null,
      techs: player?.science.completedTechs.length ?? 0,
      projectsDone: state.cosmos?.completed.length ?? 0,
      projectsActive: state.cosmos?.active.length ?? 0,
      kardashevType: kardashevType(state.cosmos?.kardashev ?? 0),
      wars: Object.values(state.relations).filter(
        (r) => r.atWar && (r.countryA === me || r.countryB === me),
      ).length,
      spyDone: ops.filter((o) => o.status === 'completed').length,
      spyCaught: ops.filter((o) => o.status === 'detected' || o.status === 'failed').length,
      achievement: achievement ? String(achievement) : null,
    };
    const before = prev.current;
    prev.current = next;
    // First snapshot of a save (or a different save): nothing "happened".
    if (!before || before.saveId !== next.saveId) return;

    if (next.kardashevType > before.kardashevType) sfx('sfx.milestone');
    else if (next.projectsDone > before.projectsDone) sfx('sfx.colony');
    if (next.projectsActive > before.projectsActive) sfx('sfx.launch');
    if (next.techs > before.techs) sfx('sfx.tech-unlock');
    if (next.wars > before.wars) sfx('sfx.war');
    if (next.spyDone > before.spyDone) sfx('sfx.spy-success');
    if (next.spyCaught > before.spyCaught) sfx('sfx.spy-detected');
    if (next.achievement && next.achievement !== before.achievement) sfx('sfx.achievement');
  }, [state, saveId, achievement, sfx]);

  return null;
}

export default PlayAudio;
