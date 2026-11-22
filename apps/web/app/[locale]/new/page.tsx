// New game: mode → world → nation → (victory, Campaign only) → difficulty →
// launch. The flow itself lives in components/Menu/wizard.

'use client';

import { MenuFrame, MenuTopBar } from '../../../components/Menu/MenuFrame';
import { Wizard } from '../../../components/Menu/wizard/Wizard';

export default function NewGamePage() {
  return (
    <MenuFrame planet={{ body: 'earth', lon: -40, lat: 18, distance: 2.3, offsetX: 0.3 }}>
      <MenuTopBar />
      <Wizard />
    </MenuFrame>
  );
}
