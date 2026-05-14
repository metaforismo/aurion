// Seedable PRNG (mulberry32). Stateful instance per call site, but state is
// derived deterministically from a string seed so two RNGs created with the
// same seed produce the same sequence. The engine itself stays pure: tick()
// and applyAction() create their own short-lived RNG seeded from
// `${state.rngSeed}::${state.tick}` so that re-running with the same input
// state yields the same output.

export type Rng = {
  /** Returns a float in [0, 1). */
  next(): number;
  /** Returns an int in [0, maxExclusive). Throws if maxExclusive <= 0. */
  nextInt(maxExclusive: number): number;
  /** Picks a random element. Throws on empty array. */
  pick<T>(arr: readonly T[]): T;
};

/** xmur3 string hasher → 32-bit seed. Standard companion to mulberry32. */
function xmur3(input: string): () => number {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed: string): Rng {
  const seedFn = xmur3(seed);
  // Use a single 32-bit chunk; xmur3 already mixes the whole string.
  const next = mulberry32(seedFn());
  return {
    next,
    nextInt(maxExclusive: number): number {
      if (!Number.isFinite(maxExclusive) || maxExclusive <= 0) {
        throw new Error('createRng.nextInt: maxExclusive must be > 0');
      }
      return Math.floor(next() * maxExclusive);
    },
    pick<T>(arr: readonly T[]): T {
      if (arr.length === 0) {
        throw new Error('createRng.pick: empty array');
      }
      const idx = Math.floor(next() * arr.length);
      // noUncheckedIndexedAccess: the bounds check above guarantees presence.
      const value = arr[idx];
      if (value === undefined) {
        // Should never happen but TS narrows to T | undefined.
        throw new Error('createRng.pick: undefined element');
      }
      return value;
    },
  };
}
