// The codex: how the game works, in seven skimmable sections.

'use client';

import { Codex } from '../../../components/Menu/codex/Codex';
import { MenuFrame, MenuTopBar } from '../../../components/Menu/MenuFrame';

export default function GuidePage() {
  return (
    <MenuFrame planet={{ body: 'moon', lon: 20, lat: 10, distance: 2.4, offsetX: 0.32 }}>
      <MenuTopBar />
      <Codex />
    </MenuFrame>
  );
}
