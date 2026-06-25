import { describe, it, expect } from 'vitest';
import { groundFeet, FootGrounder, type FootSample } from '../src/primitives/footIK';

describe('foot IK grounding', () => {
  it('flat ground at expected height leaves feet untouched', () => {
    const feet: FootSample[] = [
      { pos: [-0.2, 0.1, 0], groundY: 0 },
      { pos: [0.2, 0.1, 0], groundY: 0 },
    ];
    const r = groundFeet(feet, { ankleHeight: 0.1 });
    expect(r.pelvisOffset).toBeCloseTo(0);
    expect(r.feet[0][1]).toBeCloseTo(0.1);
    expect(r.feet[1][1]).toBeCloseTo(0.1);
  });

  it('drops the pelvis so the downhill foot reaches lower ground', () => {
    const feet: FootSample[] = [
      { pos: [-0.2, 0.1, 0], groundY: 0 },     // uphill foot, on the plane
      { pos: [0.2, 0.1, 0], groundY: -0.3 },   // downhill foot, ground 0.3 below
    ];
    const r = groundFeet(feet, { ankleHeight: 0.1, maxPelvisDrop: 0.5 });
    expect(r.pelvisOffset).toBeCloseTo(-0.3); // body drops 0.3
    // downhill foot now sits on its ground (groundY + ankle)
    expect(r.feet[1][1]).toBeCloseTo(-0.2);
    // uphill foot would sink to -0.2 but is clamped to its own ground at 0.1
    expect(r.feet[0][1]).toBeCloseTo(0.1);
  });

  it('clamps the pelvis drop to maxPelvisDrop', () => {
    const feet: FootSample[] = [{ pos: [0, 0.1, 0], groundY: -5 }];
    const r = groundFeet(feet, { ankleHeight: 0.1, maxPelvisDrop: 0.4 });
    expect(r.pelvisOffset).toBeCloseTo(-0.4);
  });

  it('ignores feet with no ground hit (float free)', () => {
    const feet: FootSample[] = [{ pos: [0, 2, 0], groundY: null }];
    const r = groundFeet(feet);
    expect(r.pelvisOffset).toBeCloseTo(0);
    expect(r.feet[0][1]).toBeCloseTo(2);
  });

  it('FootGrounder smooths toward the target offset', () => {
    const g = new FootGrounder({ ankleHeight: 0.1 }, 12);
    const feet: FootSample[] = [{ pos: [0, 0.1, 0], groundY: -0.3 }];
    let r = g.update(feet, 1 / 60);
    expect(r.pelvisOffset).toBeGreaterThan(-0.3); // not there yet (eased)
    expect(r.pelvisOffset).toBeLessThan(0);
    for (let i = 0; i < 120; i++) r = g.update(feet, 1 / 60);
    expect(r.pelvisOffset).toBeCloseTo(-0.3, 2); // converged
  });
});
