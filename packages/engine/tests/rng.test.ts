import { describe, expect, it } from 'vitest';
import { createRng } from '../src/rng.js';

describe('createRng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createRng('seed-xyz');
    const b = createRng('seed-xyz');
    const seqA = Array.from({ length: 8 }, () => a.next());
    const seqB = Array.from({ length: 8 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = createRng('seed-1');
    const b = createRng('seed-2');
    const va = Array.from({ length: 8 }, () => a.next());
    const vb = Array.from({ length: 8 }, () => b.next());
    expect(va).not.toEqual(vb);
  });

  it('returns floats in [0,1)', () => {
    const r = createRng('abc');
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('nextInt returns integers in [0, max)', () => {
    const r = createRng('intseed');
    for (let i = 0; i < 200; i++) {
      const v = r.nextInt(7);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(7);
    }
  });

  it('nextInt throws for non-positive max', () => {
    const r = createRng('throw-me');
    expect(() => r.nextInt(0)).toThrow();
    expect(() => r.nextInt(-3)).toThrow();
  });

  it('pick returns elements from the array', () => {
    const r = createRng('pick-seed');
    const arr = ['a', 'b', 'c', 'd'];
    for (let i = 0; i < 100; i++) {
      expect(arr).toContain(r.pick(arr));
    }
  });

  it('pick throws on empty arrays', () => {
    const r = createRng('empty');
    expect(() => r.pick([])).toThrow();
  });
});
