import { describe, it, expect, vi } from 'vitest';
import { NotifyTrack } from '../src/primitives/notifies';
import { sampleCurve, CurveSet } from '../src/primitives/animCurves';
import { solveFabrik, solveTwoBone } from '../src/primitives/ik';
import { RootMotion } from '../src/primitives/rootMotion';

type V3 = [number, number, number];
const d = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('NotifyTrack', () => {
  it('fires point notifies when the head crosses, loop-aware', () => {
    const t = new NotifyTrack({ notifies: [{ name: 'step', time: 0.5 }] });
    const on = vi.fn();
    t.update(0.3, 0.6, 1, on); // crosses 0.5
    expect(on).toHaveBeenCalledWith('step', undefined);
    on.mockClear();
    t.update(0.6, 0.9, 1, on); // no crossing
    expect(on).not.toHaveBeenCalled();
    t.update(0.9, 0.2, 1, on); // loop wrap past 1 → crosses 0.5? no (0.5 not in (0.9..1]∪[0..0.2])
    expect(on).not.toHaveBeenCalled();
  });

  it('drives state begin/tick/end', () => {
    const t = new NotifyTrack({ states: [{ name: 'win', start: 0.2, end: 0.6 }] });
    const phases: string[] = [];
    const on = (_n: string, p: 'begin' | 'tick' | 'end') => phases.push(p);
    t.update(0.0, 0.1, 1, undefined, on); // before
    t.update(0.1, 0.3, 1, undefined, on); // enters → begin + tick
    t.update(0.3, 0.5, 1, undefined, on); // inside → tick
    t.update(0.5, 0.7, 1, undefined, on); // leaves → end
    expect(phases).toEqual(['begin', 'tick', 'tick', 'end']);
  });
});

describe('AnimCurves', () => {
  it('linear interpolates and clamps ends', () => {
    const c = { name: 'x', keys: [{ t: 0, v: 0 }, { t: 1, v: 10 }] };
    expect(sampleCurve(c, -1)).toBe(0);
    expect(sampleCurve(c, 0.5)).toBeCloseTo(5);
    expect(sampleCurve(c, 2)).toBe(10);
  });
  it('step holds the left value; CurveSet samples all', () => {
    const set = new CurveSet([{ name: 'a', keys: [{ t: 0, v: 1, interp: 'step' }, { t: 1, v: 9 }] }]);
    expect(set.value('a', 0.5)).toBe(1);
    expect(set.sample(0.5)).toEqual({ a: 1 });
  });
});

describe('IK', () => {
  it('FABRIK reaches a reachable target', () => {
    const joints: V3[] = [[0, 0, 0], [1, 0, 0], [2, 0, 0]];
    const out = solveFabrik(joints, [1, 1, 0]);
    expect(d(out[out.length - 1], [1, 1, 0])).toBeLessThan(0.01);
    // bone lengths preserved
    expect(d(out[0], out[1])).toBeCloseTo(1, 2);
    expect(d(out[1], out[2])).toBeCloseTo(1, 2);
  });
  it('FABRIK stretches toward an unreachable target', () => {
    const out = solveFabrik([[0, 0, 0], [1, 0, 0], [2, 0, 0]], [10, 0, 0]);
    expect(d(out[2], [0, 0, 0])).toBeCloseTo(2, 2); // fully extended (reach = 2)
  });
  it('two-bone solver puts the tip on a reachable target', () => {
    const { mid, tip } = solveTwoBone([0, 0, 0], [1, 0, 0], [2, 0, 0], [1, 1, 0]);
    expect(d(tip, [1, 1, 0])).toBeLessThan(1e-6);
    expect(d([0, 0, 0], mid)).toBeCloseTo(1, 3); // upper bone length kept
    expect(d(mid, [1, 1, 0])).toBeCloseTo(1, 3); // lower bone length kept
  });
});

describe('RootMotion', () => {
  it('returns zero on first frame then per-frame deltas with yaw wrap', () => {
    const rm = new RootMotion();
    expect(rm.consume(0, 0, 0)).toEqual({ dx: 0, dz: 0, dyaw: 0 });
    expect(rm.consume(1, 2, 0)).toEqual({ dx: 1, dz: 2, dyaw: 0 });
    const dd = rm.consume(1, 2, -Math.PI + 0.1); // wrapped from previous 0 → +... shortest path
    expect(Math.abs(dd.dyaw)).toBeLessThanOrEqual(Math.PI);
  });
});
