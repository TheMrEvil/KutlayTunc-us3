import { describe, it, expect } from 'vitest';
import { aimYawPitch, LookAtSolver } from '../src/primitives/aim';

const close = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;

describe('aim solver', () => {
  it('aimYawPitch points +Z forward, +X to the right, +Y up', () => {
    expect(aimYawPitch([0, 0, 0], [0, 0, 5]).yaw).toBeCloseTo(0); // straight ahead
    expect(aimYawPitch([0, 0, 0], [5, 0, 0]).yaw).toBeCloseTo(Math.PI / 2); // right → +90° yaw
    expect(aimYawPitch([0, 0, 0], [0, 0, -5]).yaw).toBeCloseTo(Math.PI); // behind → 180°
    // target straight up relative to a forward point → look up (negative pitch)
    expect(aimYawPitch([0, 0, 0], [0, 5, 5]).pitch).toBeLessThan(0);
    expect(aimYawPitch([0, 0, 0], [0, -5, 5]).pitch).toBeGreaterThan(0);
  });

  it('clamps yaw/pitch to limits', () => {
    const s = new LookAtSolver({ yaw: [-0.3, 0.3], pitch: [-0.2, 0.2] });
    const g = s.solve([0, 0, 0], [100, 100, 0.001]); // hard right + up, way past limits
    expect(g.yaw).toBeCloseTo(0.3);
    expect(g.pitch).toBeCloseTo(-0.2);
  });

  it('eases toward the target and converges', () => {
    const s = new LookAtSolver({}, 10);
    let last = 0;
    for (let i = 0; i < 120; i++) last = s.update([0, 0, 0], [5, 0, 0], 1 / 60).yaw;
    expect(close(last, Math.PI / 2, 1e-3)).toBe(true);
  });

  it('returns to rest when the target is lost', () => {
    const s = new LookAtSolver({}, 10);
    for (let i = 0; i < 60; i++) s.update([0, 0, 0], [5, 0, 0], 1 / 60); // lock onto it
    expect(Math.abs(s.yaw)).toBeGreaterThan(0.5);
    for (let i = 0; i < 200; i++) s.update([0, 0, 0], null, 1 / 60); // lose it
    expect(close(s.yaw, 0, 1e-3)).toBe(true);
    expect(close(s.pitch, 0, 1e-3)).toBe(true);
  });
});
