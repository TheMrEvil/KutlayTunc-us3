import { describe, it, expect } from 'vitest';
import { calcInertialFloat, Inertializer } from '../src/primitives/inertialization';

describe('calcInertialFloat', () => {
  it('starts at the offset and lands exactly at zero', () => {
    expect(calcInertialFloat(1, 0, 0, 0.5)).toBeCloseTo(1, 6);
    expect(calcInertialFloat(1, 0, 0.5, 0.5)).toBe(0); // t >= t1
    expect(calcInertialFloat(1, 0, 0.25, 0.5)).toBeCloseTo(0.5, 6); // midpoint of this quintic
  });

  it('honors the initial velocity (slope at t=0 equals v0)', () => {
    const eps = 1e-4;
    const slope = (calcInertialFloat(1, -3, eps, 0.5) - 1) / eps;
    expect(slope).toBeCloseTo(-3, 1);
  });

  it('approaches zero with vanishing velocity near the end (no overshoot)', () => {
    const t1 = 0.5;
    const near = calcInertialFloat(1, 0, t1 - 1e-3, t1);
    expect(Math.abs(near)).toBeLessThan(1e-3); // settles to ~0
  });
});

describe('Inertializer', () => {
  it('blends smoothly to a target without overshoot', () => {
    const z = new Inertializer(0);
    z.inertialize(0.3, 10); // blend from 0 toward 10
    let v = 0, maxV = 0;
    for (let i = 0; i < 40; i++) { v = z.update(10, 1 / 60); maxV = Math.max(maxV, v); }
    expect(v).toBeCloseTo(10, 3);
    expect(maxV).toBeLessThanOrEqual(10.0001); // no overshoot past target
  });
});
