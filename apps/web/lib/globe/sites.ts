// Where each off-world megaproject sits on its body, in planetocentric
// degrees. Earth projects are shown at the player's capital instead.

import type { CosmosBodyId } from '@aurion/engine';

export type SurfaceBody = 'moon' | 'mars';

export const PROJECT_SITES: Readonly<Record<string, { lon: number; lat: number }>> = {
  // Moon
  moon_survey: { lon: 8, lat: -62 }, // south polar highlands
  moon_base: { lon: 23.5, lat: 0.7 }, // Mare Tranquillitatis
  moon_helium3: { lon: -15.6, lat: 32.8 }, // Mare Imbrium
  moon_mass_driver: { lon: -43, lat: -3 }, // Oceanus Procellarum
  moon_city: { lon: 59, lat: 17 }, // Mare Crisium
  // Mars
  mars_mission: { lon: 137.4, lat: -4.6 }, // Gale crater
  mars_colony: { lon: -175, lat: 47 }, // Arcadia Planitia
  mars_industry: { lon: -59, lat: -14 }, // Valles Marineris
  mars_city: { lon: -125, lat: 12 }, // foot of Olympus Mons
  mars_terraform: { lon: -30, lat: 40 }, // Acidalia Planitia
};

/** Which stage view (if any) shows the projects of a body. */
export function surfaceBodyOf(body: CosmosBodyId): SurfaceBody | null {
  return body === 'moon' || body === 'mars' ? body : null;
}
