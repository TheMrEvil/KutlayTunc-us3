// Delaunay triangulation + barycentric weighting — the geometric heart of a 2D
// blend space, matching Unreal's Blend Graph. Given sample points in parameter
// space and a query point, it returns the (≤3) samples whose weighted blend the
// query represents. Queries outside the convex hull clamp to the nearest edge.
//
// The triangulation is computed once and reused; only `weightsAt` runs per frame.

import type { WeightList } from './bracket';
import { bracketWeights } from './bracket';
import { triangulate, convexHull } from './delaunay';

const EPS = 1e-9;

export type Point2 = readonly [number, number];

/** A triangle as a triple of sample indices. */
export type Triangle = readonly [number, number, number];

/** Barycentric coordinates of `p` in triangle `(a, b, c)`, or `null` if degenerate. */
export function barycentric(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
  cx: number, cy: number,
): [number, number, number] | null {
  const v0x = bx - ax, v0y = by - ay;
  const v1x = cx - ax, v1y = cy - ay;
  const v2x = px - ax, v2y = py - ay;
  const den = v0x * v1y - v1x * v0y;
  if (Math.abs(den) < EPS) return null; // collinear / zero-area triangle
  const v = (v2x * v1y - v1x * v2y) / den;
  const w = (v0x * v2y - v2x * v0y) / den;
  const u = 1 - v - w;
  return [u, v, w];
}

/** Project point `p` onto segment `a→b`; returns the clamped parameter `t ∈ [0,1]`. */
function projectOnSegment(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 < EPS) return 0;
  return Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
}

/**
 * A reusable 2D blend triangulation over a fixed set of sample positions.
 * Rebuild (construct a new instance) when sample positions change.
 */
export class BlendTriangulation {
  readonly points: Point2[];
  /** Triangle list, as flat triples of sample indices. Empty for n < 3 or collinear. */
  readonly triangles: Triangle[] = [];
  /** Convex-hull sample indices in CCW order. */
  readonly hull: number[] = [];

  private readonly collinear: boolean;

  constructor(points: ReadonlyArray<Point2>) {
    this.points = points.map((p) => [p[0], p[1]] as Point2);
    const n = this.points.length;

    if (n < 3) {
      this.collinear = n === 2; // a 2-point "line" is handled by the 1D path too
      if (n >= 1) this.hull = this.points.map((_, i) => i);
      return;
    }

    // Detect collinearity geometrically rather than trusting the triangulator —
    // d3-delaunay may jitter collinear input and emit spurious thin triangles.
    this.collinear = allCollinear(this.points);
    if (this.collinear) {
      this.hull = this.points.map((_, i) => i);
      return;
    }

    this.triangles = triangulate(this.points);
    this.hull = convexHull(this.points);
  }

  /** Compute the blend weights for a query point. Non-zero weights sum to 1. */
  weightsAt(x: number, y: number): WeightList {
    const pts = this.points;
    const n = pts.length;
    if (n === 0) return [];
    if (n === 1) return [{ index: 0, weight: 1 }];

    // Snap to an exactly-coincident sample.
    for (let i = 0; i < n; i++) {
      const dx = pts[i][0] - x, dy = pts[i][1] - y;
      if (dx * dx + dy * dy < EPS) return [{ index: i, weight: 1 }];
    }

    if (this.collinear) return this.collinearWeights(x, y);

    // Inside a triangle → barycentric weights.
    for (const [a, b, c] of this.triangles) {
      const bc = barycentric(
        x, y,
        pts[a][0], pts[a][1],
        pts[b][0], pts[b][1],
        pts[c][0], pts[c][1],
      );
      if (!bc) continue;
      const [u, v, w] = bc;
      if (u >= -EPS && v >= -EPS && w >= -EPS) {
        return normalize([
          { index: a, weight: Math.max(0, u) },
          { index: b, weight: Math.max(0, v) },
          { index: c, weight: Math.max(0, w) },
        ]);
      }
    }

    // Outside the convex hull → clamp to the nearest hull edge.
    return this.nearestHullEdgeWeights(x, y);
  }

  /** Collinear samples behave like a 1D blend along the sample line. */
  private collinearWeights(x: number, y: number): WeightList {
    const pts = this.points;
    // Principal direction from the two extreme points.
    let minI = 0, maxI = 0;
    for (let i = 1; i < pts.length; i++) {
      if (pts[i][0] < pts[minI][0] || (pts[i][0] === pts[minI][0] && pts[i][1] < pts[minI][1])) minI = i;
      if (pts[i][0] > pts[maxI][0] || (pts[i][0] === pts[maxI][0] && pts[i][1] > pts[maxI][1])) maxI = i;
    }
    const ox = pts[minI][0], oy = pts[minI][1];
    const dx = pts[maxI][0] - ox, dy = pts[maxI][1] - oy;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const proj = (px: number, py: number) => (px - ox) * ux + (py - oy) * uy;
    const positions = pts.map((p) => proj(p[0], p[1]));
    return bracketWeights(positions, proj(x, y));
  }

  private nearestHullEdgeWeights(x: number, y: number): WeightList {
    const pts = this.points;
    const hull = this.hull;
    let best = { a: hull[0], b: hull[0], t: 0, d2: Infinity };
    for (let i = 0; i < hull.length; i++) {
      const a = hull[i];
      const b = hull[(i + 1) % hull.length];
      const t = projectOnSegment(x, y, pts[a][0], pts[a][1], pts[b][0], pts[b][1]);
      const cx = pts[a][0] + (pts[b][0] - pts[a][0]) * t;
      const cy = pts[a][1] + (pts[b][1] - pts[a][1]) * t;
      const d2 = (cx - x) * (cx - x) + (cy - y) * (cy - y);
      if (d2 < best.d2) best = { a, b, t, d2 };
    }
    const out: WeightList = [];
    if (1 - best.t > EPS) out.push({ index: best.a, weight: 1 - best.t });
    if (best.t > EPS) out.push({ index: best.b, weight: best.t });
    return out.length ? normalize(out) : [{ index: best.a, weight: 1 }];
  }
}

/** True when every point lies on a single line (or all coincide). */
function allCollinear(points: ReadonlyArray<Point2>): boolean {
  const x0 = points[0][0];
  const y0 = points[0][1];
  let i1 = -1;
  for (let i = 1; i < points.length; i++) {
    if (points[i][0] !== x0 || points[i][1] !== y0) {
      i1 = i;
      break;
    }
  }
  if (i1 < 0) return true; // all points coincide
  const dx = points[i1][0] - x0;
  const dy = points[i1][1] - y0;
  for (let i = 0; i < points.length; i++) {
    const cross = (points[i][0] - x0) * dy - (points[i][1] - y0) * dx;
    if (Math.abs(cross) > 1e-7) return false;
  }
  return true;
}

function normalize(list: WeightList): WeightList {
  let sum = 0;
  for (const e of list) sum += e.weight;
  if (sum < EPS) return list.length ? [{ index: list[0].index, weight: 1 }] : [];
  const out: WeightList = [];
  for (const e of list) {
    const w = e.weight / sum;
    if (w > 1e-6) out.push({ index: e.index, weight: w });
  }
  return out;
}
