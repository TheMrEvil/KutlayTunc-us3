import { describe, it, expect } from 'vitest';
import { runQuery, type EnvQueryData, type EqsCtx } from '../src/eqs';

const ctx: EqsCtx = { querier: [0, 0, 0], contexts: { target: [[10, 0, 0]] } };

describe('EQS runQuery', () => {
  it('grid + distance(inverse) picks the point nearest the target', () => {
    const q: EnvQueryData = {
      generator: { type: 'grid', halfExtent: 4, spacing: 2 },
      tests: [{ type: 'distance', purpose: 'score', context: 'target', score: { equation: 'inverse', normalize: 'relative' } }],
      runMode: 'best',
    };
    const [best] = runQuery(q, ctx);
    expect(best.point[0]).toBeCloseTo(4, 5); // max +x toward target
    expect(best.point[2]).toBeCloseTo(0, 5);
  });

  it('trace filter (wantHit) drops occluded points', () => {
    const occluded: EqsCtx = { ...ctx, raycast: (_from, to) => to[0] > 2.5 }; // wall: anything past x=2.5 is blocked
    const q: EnvQueryData = {
      generator: { type: 'grid', halfExtent: 4, spacing: 2 },
      tests: [
        { type: 'trace', purpose: 'filter', filter: { wantHit: true } },
        { type: 'distance', purpose: 'score', context: 'target', score: { equation: 'inverse', normalize: 'relative' } },
      ],
      runMode: 'bestN', n: 50,
    };
    const items = runQuery(q, occluded);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((it) => it.point[0] <= 2.5)).toBe(true); // all visible
    expect(items[0].point[0]).toBeCloseTo(2, 5); // best visible is closest to target
  });

  it('dot test scores points in front of the querier', () => {
    const q: EnvQueryData = {
      generator: { type: 'circle', radius: 5, count: 8 },
      tests: [{ type: 'dot', purpose: 'score', context: 'target', score: { equation: 'linear', normalize: 'relative' } }],
      runMode: 'best',
    };
    const [best] = runQuery(q, ctx);
    expect(best.point[0]).toBeGreaterThan(0); // toward +x (target direction)
  });

  it('pathfinding test drops unreachable items', () => {
    const navCtx: EqsCtx = {
      querier: [0, 0, 0],
      contexts: { target: [[10, 0, 0]] },
      pathLength: (from, to) => (to[0] > 5 ? null : Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2])),
    };
    const q: EnvQueryData = {
      generator: { type: 'grid', halfExtent: 8, spacing: 2 },
      tests: [
        { type: 'pathfinding', purpose: 'filter' },
        { type: 'distance', purpose: 'score', context: 'target', score: { equation: 'inverse', normalize: 'relative' } },
      ],
      runMode: 'bestN', n: 200,
    };
    const items = runQuery(q, navCtx);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((it) => it.point[0] <= 5)).toBe(true); // unreachable (x>5) dropped
  });
});
