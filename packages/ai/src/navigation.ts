// Navigation — a clean web/TS take on Unreal's navmesh + pathfinding. Instead of
// Recast, a uniform grid baked from axis-aligned obstacle footprints, 8-connected
// A* (octile heuristic) + line-of-sight string-pulling, and a small path follower.
// Editable via `*.navmesh.json` (bounds + cellSize + obstacles).

import type { NavPoint, NavProvider } from '@kutlaytunc/us3-core';
export type { NavPoint } from '@kutlaytunc/us3-core';

export interface NavObstacle { x: number; z: number; w: number; d: number }
export interface NavGridData {
  version?: 1;
  min: [number, number]; // world X,Z of the grid's lower corner
  max: [number, number];
  cellSize: number;
  obstacles?: NavObstacle[];
  /** extra clearance (agent radius) baked around obstacles, in world units */
  agentRadius?: number;
}

/** A simple uniform-grid {@link NavProvider}. For real navmeshes use `@kutlaytunc/us3-nav-recast`. */
export class NavGrid implements NavProvider {
  readonly cols: number;
  readonly rows: number;
  readonly minX: number;
  readonly minZ: number;
  readonly cellSize: number;
  private blocked: Uint8Array;

  constructor(data: NavGridData) {
    this.minX = data.min[0];
    this.minZ = data.min[1];
    this.cellSize = data.cellSize;
    this.cols = Math.max(1, Math.ceil((data.max[0] - data.min[0]) / data.cellSize));
    this.rows = Math.max(1, Math.ceil((data.max[1] - data.min[1]) / data.cellSize));
    this.blocked = new Uint8Array(this.cols * this.rows);
    const pad = data.agentRadius ?? 0;
    for (const o of data.obstacles ?? []) this.blockBox(o, pad);
  }

  private idx(c: number, r: number): number { return r * this.cols + c; }
  inBounds(c: number, r: number): boolean { return c >= 0 && r >= 0 && c < this.cols && r < this.rows; }
  isBlocked(c: number, r: number): boolean { return !this.inBounds(c, r) || this.blocked[this.idx(c, r)] === 1; }
  setBlocked(c: number, r: number, v = true): void { if (this.inBounds(c, r)) this.blocked[this.idx(c, r)] = v ? 1 : 0; }

  worldToCell(x: number, z: number): [number, number] {
    return [Math.floor((x - this.minX) / this.cellSize), Math.floor((z - this.minZ) / this.cellSize)];
  }
  cellToWorld(c: number, r: number): NavPoint {
    return [this.minX + (c + 0.5) * this.cellSize, this.minZ + (r + 0.5) * this.cellSize];
  }

  private blockBox(o: NavObstacle, pad: number): void {
    const x0 = o.x - o.w / 2 - pad, x1 = o.x + o.w / 2 + pad;
    const z0 = o.z - o.d / 2 - pad, z1 = o.z + o.d / 2 + pad;
    const [c0, r0] = this.worldToCell(x0, z0);
    const [c1, r1] = this.worldToCell(x1, z1);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) this.setBlocked(c, r, true);
  }

  /** Nearest walkable cell center to a world point (ring search), or null. */
  nearestWalkable(x: number, z: number): NavPoint | null {
    const [c, r] = this.worldToCell(x, z);
    if (!this.isBlocked(c, r)) return this.cellToWorld(c, r);
    const maxRing = Math.max(this.cols, this.rows);
    for (let ring = 1; ring <= maxRing; ring++) {
      for (let dr = -ring; dr <= ring; dr++) for (let dc = -ring; dc <= ring; dc++) {
        if (Math.abs(dr) !== ring && Math.abs(dc) !== ring) continue;
        if (!this.isBlocked(c + dc, r + dr)) return this.cellToWorld(c + dc, r + dr);
      }
    }
    return null;
  }

  /** A random walkable point on the grid (Unreal GetRandomReachablePoint-ish), or null. */
  randomPoint(): NavPoint | null {
    for (let i = 0; i < 200; i++) {
      const c = Math.floor(Math.random() * this.cols);
      const r = Math.floor(Math.random() * this.rows);
      if (!this.isBlocked(c, r)) return this.cellToWorld(c, r);
    }
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) if (!this.isBlocked(c, r)) return this.cellToWorld(c, r);
    return null;
  }

  // ── NavProvider ───────────────────────────────────────────────────────────
  /** {@link NavProvider.findPath} — 8-connected A* + string-pull (delegates to `findPath`). */
  findPath(from: NavPoint, to: NavPoint): NavPoint[] { return findPath(this, from, to); }
  /** {@link NavProvider.project} — snap to the nearest walkable cell centre. */
  project(p: NavPoint): NavPoint | null { return this.nearestWalkable(p[0], p[1]); }
  /** {@link NavProvider.contains} — whether the point's cell is walkable. */
  contains(p: NavPoint): boolean { const [c, r] = this.worldToCell(p[0], p[1]); return !this.isBlocked(c, r); }
  /** {@link NavProvider.isReachable} — whether a path exists (delegates to the free `isReachable`). */
  isReachable(from: NavPoint, to: NavPoint): boolean { return isReachable(this, from, to); }

  /** Supercover line-of-sight between two cells (no blocked cell crossed). */
  lineOfSight(c0: number, r0: number, c1: number, r1: number): boolean {
    let dx = Math.abs(c1 - c0), dy = Math.abs(r1 - r0);
    let x = c0, y = r0;
    const sx = c0 < c1 ? 1 : -1, sy = r0 < r1 ? 1 : -1;
    let err = dx - dy;
    for (;;) {
      if (this.isBlocked(x, y)) return false;
      if (x === c1 && y === r1) return true;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
  }
}

class MinHeap {
  private a: { f: number; i: number }[] = [];
  get size() { return this.a.length; }
  push(f: number, i: number): void {
    const a = this.a; a.push({ f, i }); let n = a.length - 1;
    while (n > 0) { const p = (n - 1) >> 1; if (a[p].f <= a[n].f) break; [a[p], a[n]] = [a[n], a[p]]; n = p; }
  }
  pop(): number {
    const a = this.a; const top = a[0]; const last = a.pop()!;
    if (a.length) { a[0] = last; let n = 0; for (;;) { const l = 2 * n + 1, r = l + 1; let m = n; if (l < a.length && a[l].f < a[m].f) m = l; if (r < a.length && a[r].f < a[m].f) m = r; if (m === n) break; [a[m], a[n]] = [a[n], a[m]]; n = m; } }
    return top.i;
  }
}

/** 8-connected A* + line-of-sight smoothing. Returns world waypoints (incl. exact
 *  start/goal), or [] if unreachable. */
export function findPath(grid: NavGrid, start: NavPoint, goal: NavPoint): NavPoint[] {
  const s = grid.nearestWalkable(start[0], start[1]);
  const g = grid.nearestWalkable(goal[0], goal[1]);
  if (!s || !g) return [];
  const [sc, sr] = grid.worldToCell(s[0], s[1]);
  const [gc, gr] = grid.worldToCell(g[0], g[1]);
  const cols = grid.cols;
  const n = cols * grid.rows;
  const gScore = new Float64Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const id = (c: number, r: number) => r * cols + c;
  const h = (c: number, r: number) => { const dc = Math.abs(c - gc), dr = Math.abs(r - gr); return (dc + dr) + (Math.SQRT2 - 2) * Math.min(dc, dr); };
  const open = new MinHeap();
  const start_i = id(sc, sr);
  gScore[start_i] = 0;
  open.push(h(sc, sr), start_i);
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  let found = false;
  while (open.size) {
    const cur = open.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === id(gc, gr)) { found = true; break; }
    const cc = cur % cols, cr = (cur - cc) / cols;
    for (const [dc, dr] of DIRS) {
      const nc = cc + dc, nr = cr + dr;
      if (grid.isBlocked(nc, nr)) continue;
      if (dc !== 0 && dr !== 0 && (grid.isBlocked(cc + dc, cr) || grid.isBlocked(cc, cr + dr))) continue; // no corner cutting
      const ni = id(nc, nr);
      if (closed[ni]) continue;
      const step = dc !== 0 && dr !== 0 ? Math.SQRT2 : 1;
      const tentative = gScore[cur] + step;
      if (tentative < gScore[ni]) { gScore[ni] = tentative; came[ni] = cur; open.push(tentative + h(nc, nr), ni); }
    }
  }
  if (!found) return [];

  // reconstruct cell path
  const cells: [number, number][] = [];
  for (let cur = id(gc, gr); cur !== -1; cur = came[cur]) { const c = cur % cols, r = (cur - c) / cols; cells.push([c, r]); }
  cells.reverse();

  // string-pull: keep a waypoint only when LoS to the next-next breaks
  const keep: [number, number][] = [cells[0]];
  let anchor = 0;
  for (let i = 2; i < cells.length; i++) {
    if (!grid.lineOfSight(cells[anchor][0], cells[anchor][1], cells[i][0], cells[i][1])) { keep.push(cells[i - 1]); anchor = i - 1; }
  }
  keep.push(cells[cells.length - 1]);

  const pts = keep.map(([c, r]) => grid.cellToWorld(c, r));
  pts[0] = start;          // exact start
  pts[pts.length - 1] = goal; // exact goal
  return pts;
}

/** True if a path exists between two world points. */
export function isReachable(grid: NavGrid, a: NavPoint, b: NavPoint): boolean {
  return findPath(grid, a, b).length > 0;
}

/** Walks a transform along a path at a given speed. */
export class PathFollower {
  private path: NavPoint[] = [];
  private i = 1;
  setPath(path: NavPoint[]): void { this.path = path; this.i = 1; }
  get done(): boolean { return this.i >= this.path.length; }
  /** Advance `pos` toward the path; mutates pos. Returns the heading (radians) or null. */
  step(pos: { x: number; z: number }, speed: number, dt: number): number | null {
    if (this.done) return null;
    let budget = speed * dt;
    let heading: number | null = null;
    while (budget > 0 && this.i < this.path.length) {
      const [tx, tz] = this.path[this.i];
      const dx = tx - pos.x, dz = tz - pos.z;
      const dist = Math.hypot(dx, dz);
      heading = Math.atan2(dx, dz);
      if (dist <= budget) { pos.x = tx; pos.z = tz; budget -= dist; this.i++; }
      else { pos.x += (dx / dist) * budget; pos.z += (dz / dist) * budget; budget = 0; }
    }
    return heading;
  }
}
