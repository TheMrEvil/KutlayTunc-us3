import { describe, it, expect } from 'vitest';
import { clamp, lerp, damp, shortestAngle } from '../src/math/scalar';
import { bracketWeights } from '../src/math/bracket';
import { BlendTriangulation } from '../src/math/triangulation';
import type { WeightList } from '../src/math/bracket';

const sum = (w: WeightList) => w.reduce((a, e) => a + e.weight, 0);
const weightOf = (w: WeightList, index: number) => w.find((e) => e.index === index)?.weight ?? 0;

describe('scalar', () => {
  it('clamps', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });
  it('lerps', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
  });
  it('damp converges toward target', () => {
    let v = 0;
    for (let i = 0; i < 200; i++) v = damp(v, 10, 8, 1 / 60);
    expect(v).toBeCloseTo(10, 3);
  });
  it('shortestAngle wraps', () => {
    expect(shortestAngle(0, Math.PI * 1.5)).toBeCloseTo(-Math.PI / 2, 5);
  });
});

describe('bracketWeights (1D)', () => {
  const pos = [0, 1, 2]; // three samples on a line
  it('returns weight 1 at a sample', () => {
    expect(weightOf(bracketWeights(pos, 1), 1)).toBeCloseTo(1, 6);
  });
  it('clamps below the first sample', () => {
    expect(weightOf(bracketWeights(pos, -5), 0)).toBe(1);
  });
  it('clamps above the last sample', () => {
    expect(weightOf(bracketWeights(pos, 99), 2)).toBe(1);
  });
  it('blends between two samples', () => {
    const w = bracketWeights(pos, 0.25);
    expect(weightOf(w, 0)).toBeCloseTo(0.75, 6);
    expect(weightOf(w, 1)).toBeCloseTo(0.25, 6);
    expect(sum(w)).toBeCloseTo(1, 6);
  });
  it('handles unsorted positions', () => {
    const w = bracketWeights([2, 0, 1], 0.5);
    expect(sum(w)).toBeCloseTo(1, 6);
  });
});

describe('BlendTriangulation (2D barycentric)', () => {
  // A right triangle plus interior queries.
  const tri = new BlendTriangulation([
    [0, 0],
    [1, 0],
    [0, 1],
  ]);

  it('recovers a sample exactly at its position', () => {
    expect(weightOf(tri.weightsAt(0, 0), 0)).toBeCloseTo(1, 6);
    expect(weightOf(tri.weightsAt(1, 0), 1)).toBeCloseTo(1, 6);
    expect(weightOf(tri.weightsAt(0, 1), 2)).toBeCloseTo(1, 6);
  });

  it('gives equal weights at the centroid', () => {
    const w = tri.weightsAt(1 / 3, 1 / 3);
    expect(weightOf(w, 0)).toBeCloseTo(1 / 3, 5);
    expect(weightOf(w, 1)).toBeCloseTo(1 / 3, 5);
    expect(weightOf(w, 2)).toBeCloseTo(1 / 3, 5);
  });

  it('blends 50/50 along an edge', () => {
    const w = tri.weightsAt(0.5, 0);
    expect(weightOf(w, 0)).toBeCloseTo(0.5, 5);
    expect(weightOf(w, 1)).toBeCloseTo(0.5, 5);
  });

  it('clamps a far-outside query to the hull (still sums to 1)', () => {
    const w = tri.weightsAt(10, 10);
    expect(sum(w)).toBeCloseTo(1, 5);
    for (const e of w) expect(e.weight).toBeGreaterThanOrEqual(0);
  });

  it('weights are non-negative and sum to 1 across a grid (locomotion square)', () => {
    const square = new BlendTriangulation([
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
      [0, 0],
    ]);
    for (let x = -1; x <= 1; x += 0.2) {
      for (let y = -1; y <= 1; y += 0.2) {
        const w = square.weightsAt(x, y);
        expect(sum(w)).toBeCloseTo(1, 5);
        for (const e of w) expect(e.weight).toBeGreaterThanOrEqual(-1e-9);
      }
    }
  });

  it('falls back to 1D for collinear samples', () => {
    const line = new BlendTriangulation([
      [0, 0],
      [1, 0],
      [2, 0],
    ]);
    const w = line.weightsAt(0.5, 0);
    expect(weightOf(w, 0)).toBeCloseTo(0.5, 5);
    expect(weightOf(w, 1)).toBeCloseTo(0.5, 5);
  });
});

import { smoothDamp } from '../src/math/scalar';
describe('smoothDamp', () => {
  it('eases toward the target without overshoot and settles', () => {
    const vel = { value: 0 };
    let v = 0;
    let maxV = 0;
    for (let i = 0; i < 120; i++) { v = smoothDamp(v, 10, vel, 0.3, 1 / 60); maxV = Math.max(maxV, v); }
    expect(v).toBeCloseTo(10, 1);
    expect(maxV).toBeLessThanOrEqual(10.05); // no meaningful overshoot
    expect(Math.abs(vel.value)).toBeLessThan(0.5); // settled
  });
});
