'use client';

// The turning planet behind every menu page. Loaded client-only (see
// MenuFrame) so it can read the viewport and the graphics stack before the
// renderer is created: the planet's sideways offset is fixed at
// construction time, and without a GPU we don't create a renderer at all.

import { useEffect, useState } from 'react';

import PlanetView from '../Globe/PlanetView';
import type { PlanetBody } from '../../lib/globe/planet-renderer';

/** What ended up drawing the backdrop. `static` = no GPU, a still image. */
export type BackdropRenderer = 'webgpu' | 'webgl2' | 'static';

export type PlanetBackdropProps = {
  body: PlanetBody;
  /** Centre of the view, degrees. */
  lon?: number;
  lat?: number;
  /** Camera distance on wide screens (smaller = bigger planet). */
  distance?: number;
  /** Sideways shift on wide screens, as a fraction of the viewport. */
  offsetX?: number;
  /** Reports what is drawing the backdrop — Settings shows it. */
  onReady?: (renderer: BackdropRenderer) => void;
};

const WIDE_QUERY = '(min-width: 1024px)';

/**
 * True when WebGL would run on the CPU (no GPU, remote desktops, headless
 * browsers). A full-screen planet shaded in software takes the main thread
 * to ~1 fps, which makes a menu unusable — so a decoration isn't worth it.
 */
function isSoftwareRendered(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /swiftshader|llvmpipe|softpipe|warp|software/i.test(name);
  } catch {
    return true;
  }
}

/** Limb colours for the still fallback: lit side → terminator → night. */
const STILL: Record<PlanetBody, { lit: string; mid: string; dark: string; glow: string }> = {
  earth: { lit: '#3f86b8', mid: '#17405f', dark: '#061627', glow: 'rgba(92, 200, 255, 0.35)' },
  moon: { lit: '#b9bcc2', mid: '#5c5f66', dark: '#15161a', glow: 'rgba(210, 215, 225, 0.18)' },
  mars: { lit: '#c7673f', mid: '#6d2f1c', dark: '#1c0b07', glow: 'rgba(232, 140, 90, 0.25)' },
};

export default function PlanetBackdrop({
  body,
  lon = 12,
  lat = 28,
  distance = 2.6,
  offsetX = 0.18,
  onReady,
}: PlanetBackdropProps) {
  // Both read once, before the renderer exists. On phones the planet sits
  // centred and further away, so it reads as a globe above the content.
  const [wide] = useState(() => window.matchMedia(WIDE_QUERY).matches);
  const [software] = useState(isSoftwareRendered);

  useEffect(() => {
    if (software) onReady?.('static');
    // Reported once; `onReady` identity is irrelevant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [software]);

  if (software) {
    const c = STILL[body];
    return (
      <div className="relative h-full w-full bg-[#010206]">
        <div
          className="absolute top-1/2 aspect-square h-[118vmin] -translate-x-1/2 -translate-y-1/2 rounded-full lg:h-[128vmin]"
          style={{
            left: `${50 + (wide ? offsetX : 0) * 100}%`,
            background: `radial-gradient(circle at 34% 30%, ${c.lit} 0%, ${c.mid} 42%, ${c.dark} 70%, #010206 100%)`,
            boxShadow: `0 0 140px -30px ${c.glow}, inset -60px -40px 120px rgba(0, 0, 0, 0.55)`,
          }}
        />
      </div>
    );
  }

  return (
    <PlanetView
      body={body}
      className="h-full w-full"
      interactive={false}
      autoRotate
      initialLon={lon}
      initialLat={lat}
      initialDistance={wide ? distance : distance + 0.9}
      offsetX={wide ? offsetX : 0}
      sunSpeed={1.2}
      onReady={onReady}
    />
  );
}
