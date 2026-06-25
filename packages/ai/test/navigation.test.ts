import { describe, it, expect } from 'vitest';
import { NavGrid, findPath, isReachable, PathFollower, type NavGridData } from '../src/navigation';
import type { NavProvider } from '@kutlaytunc/us3-core';

const base: NavGridData = { min: [-5, -5], max: [5, 5], cellSize: 0.5 };
const dist = (p: [number, number][]) => p.reduce((a, _, i) => i ? a + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]) : 0, 0);

describe('NavGrid + findPath', () => {
  it('finds a straight path on open ground', () => {
    const grid = new NavGrid(base);
    const path = findPath(grid, [-4, 0], [4, 0]);
    expect(path.length).toBeGreaterThanOrEqual(2);
    expect(path[0]).toEqual([-4, 0]);
    expect(path[path.length - 1]).toEqual([4, 0]);
    expect(dist(path)).toBeCloseTo(8, 0); // ~straight
  });

  it('routes around a wall obstacle', () => {
    const grid = new NavGrid({ ...base, obstacles: [{ x: 0, z: 0, w: 1, d: 7 }] });
    const path = findPath(grid, [-4, 0], [4, 0]);
    expect(path.length).toBeGreaterThan(2);
    expect(dist(path)).toBeGreaterThan(8.5); // detours around the wall
  });

  it('returns [] when the goal is unreachable', () => {
    // fully wall off the right half
    const grid = new NavGrid({ ...base, obstacles: [{ x: 1, z: 0, w: 0.5, d: 12 }] });
    // block everything to the right by a thick wall spanning full height
    const walled = new NavGrid({ ...base, obstacles: [{ x: 0, z: 0, w: 0.5, d: 20 }] });
    void grid;
    const path = findPath(walled, [-4, 0], [4, 0]);
    // a single thin wall still has gaps at top/bottom? d:20 > height(10) so spans fully → blocked
    expect(path.length).toBe(0);
  });

  it('nearestWalkable snaps off an obstacle', () => {
    const grid = new NavGrid({ ...base, obstacles: [{ x: 0, z: 0, w: 2, d: 2 }] });
    const p = grid.nearestWalkable(0, 0);
    expect(p).not.toBeNull();
    const [c, r] = grid.worldToCell(p![0], p![1]);
    expect(grid.isBlocked(c, r)).toBe(false);
  });

  it('randomPoint is walkable and isReachable reflects connectivity', () => {
    const grid = new NavGrid({ ...base, obstacles: [{ x: 0, z: 0, w: 1, d: 1 }] });
    const p = grid.randomPoint()!;
    const [c, r] = grid.worldToCell(p[0], p[1]);
    expect(grid.isBlocked(c, r)).toBe(false);
    expect(isReachable(grid, [-4, 0], [4, 0])).toBe(true);
    const walled = new NavGrid({ ...base, obstacles: [{ x: 0, z: 0, w: 0.5, d: 20 }] });
    expect(isReachable(walled, [-4, 0], [4, 0])).toBe(false);
  });

  it('PathFollower walks to the end', () => {
    const grid = new NavGrid(base);
    const f = new PathFollower();
    f.setPath(findPath(grid, [-4, 0], [4, 0]));
    const pos = { x: -4, z: 0 };
    for (let i = 0; i < 200 && !f.done; i++) f.step(pos, 5, 0.1);
    expect(f.done).toBe(true);
    expect(pos.x).toBeCloseTo(4, 1);
  });
});

describe('NavGrid as a NavProvider', () => {
  it('satisfies the NavProvider surface (findPath/project/contains/isReachable)', () => {
    const grid = new NavGrid({ ...base, obstacles: [{ x: 0, z: 0, w: 1, d: 1 }] });
    const nav: NavProvider = grid; // structural conformance (compile-time)
    expect(nav.contains!([4, 4])).toBe(true);
    expect(nav.contains!([0, 0])).toBe(false); // inside the obstacle
    expect(nav.project!([0, 0])).not.toBeNull(); // snaps off the obstacle onto walkable
    expect(nav.findPath([-4, -4], [4, 4]).length).toBeGreaterThan(0);
    expect(nav.isReachable!([-4, -4], [4, 4])).toBe(true);
  });
});
