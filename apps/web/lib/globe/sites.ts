// Off-world project sites live in the engine (they decide a colony's home
// sector); this re-exports them for the stage views. Earth projects are
// shown at the player's capital instead.

import type { CosmosBodyId } from '@aurion/engine';

export type SurfaceBody = 'moon' | 'mars';

export { PROJECT_SITES } from '@aurion/engine';

/** Which stage view (if any) shows the projects of a body. */
export function surfaceBodyOf(body: CosmosBodyId): SurfaceBody | null {
  return body === 'moon' || body === 'mars' ? body : null;
}
