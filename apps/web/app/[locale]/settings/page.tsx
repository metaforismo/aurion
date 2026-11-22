// Settings. Everything persists to IndexedDB through lib/persistence (or
// the AudioProvider for the mix), so it survives across saves and sessions.

'use client';

import { useState } from 'react';

import { MenuFrame, MenuTopBar } from '../../../components/Menu/MenuFrame';
import type { BackdropRenderer } from '../../../components/Menu/PlanetBackdrop';
import { SettingsScreen } from '../../../components/Menu/settings/SettingsScreen';

export default function SettingsPage() {
  // What ended up drawing the planet; shown under "Display".
  const [renderer, setRenderer] = useState<BackdropRenderer | null>(null);
  return (
    <MenuFrame
      planet={{
        body: 'earth',
        lon: 135,
        lat: -10,
        distance: 2.6,
        offsetX: 0.34,
        onReady: setRenderer,
      }}
    >
      <MenuTopBar />
      <SettingsScreen renderer={renderer} />
    </MenuFrame>
  );
}
