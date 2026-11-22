// Title screen. All of it is client-side: saves and trophies live in
// IndexedDB and the backdrop is a WebGL planet.

'use client';

import { TitleScreen } from '../../components/Menu/home/TitleScreen';
import { MenuFrame, MenuTopBar } from '../../components/Menu/MenuFrame';

export default function HomePage() {
  return (
    <MenuFrame
      variant="hero"
      planet={{ body: 'earth', lon: 12, lat: 28, distance: 3.1, offsetX: 0.21 }}
    >
      <MenuTopBar backHref={null} />
      <TitleScreen />
    </MenuFrame>
  );
}
