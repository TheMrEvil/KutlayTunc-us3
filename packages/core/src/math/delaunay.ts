// A small, dependency-free 2D Delaunay triangulation (Bowyer–Watson) plus a
// monotone-chain convex hull. us3 builds its own geometry rather than
// pulling in a triangulation library — the blend-space sample counts are tiny,
// and the barycentric tests pin the behaviour.

import type { Point2, Triangle } from './triangulation';

interface Tri {
  a: number;
  b: number;
  c: number;
}

/** Triangulate `points` (≥3, not all collinear). Returns triangles as index triples. */
export function triangulate(points: ReadonlyArray<Point2>): Triangle[] {
  const n = points.length;
  if (n < 3) return [];

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const dmax = Math.max(maxX - minX, maxY - minY) || 1;
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  // Points + a super-triangle big enough to contain them all (indices n..n+2).
  const pts: Point2[] = points.map((p) => [p[0], p[1]] as Point2);
  pts.push([midX - 20 * dmax, midY - dmax]);
  pts.push([midX, midY + 20 * dmax]);
  pts.push([midX + 20 * dmax, midY - dmax]);

  let tris: Tri[] = [{ a: n, b: n + 1, c: n + 2 }];

  for (let i = 0; i < n; i++) {
    const bad: Tri[] = [];
    for (const t of tris) if (inCircumcircle(pts, t, i)) bad.push(t);

    // Boundary of the hole = edges that belong to exactly one bad triangle.
    const boundary: Array<[number, number]> = [];
    for (const t of bad) {
      for (const [u, v] of triEdges(t)) {
        let shared = false;
        for (const o of bad) {
          if (o !== t && hasEdge(o, u, v)) {
            shared = true;
            break;
          }
        }
        if (!shared) boundary.push([u, v]);
      }
    }

    const badSet = new Set(bad);
    tris = tris.filter((t) => !badSet.has(t));
    for (const [u, v] of boundary) tris.push({ a: u, b: v, c: i });
  }

  const out: Triangle[] = [];
  for (const t of tris) {
    if (t.a < n && t.b < n && t.c < n) out.push([t.a, t.b, t.c]);
  }
  return out;
}

/** Convex hull as CCW point indices (Andrew's monotone chain). */
export function convexHull(points: ReadonlyArray<Point2>): number[] {
  const n = points.length;
  if (n < 3) return points.map((_, i) => i);
  const idx = points.map((_, i) => i).sort((a, b) => points[a][0] - points[b][0] || points[a][1] - points[b][1]);
  const cross = (o: number, a: number, b: number) =>
    (points[a][0] - points[o][0]) * (points[b][1] - points[o][1]) - (points[a][1] - points[o][1]) * (points[b][0] - points[o][0]);

  const lower: number[] = [];
  for (const i of idx) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], i) <= 0) lower.pop();
    lower.push(i);
  }
  const upper: number[] = [];
  for (let k = idx.length - 1; k >= 0; k--) {
    const i = idx[k];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], i) <= 0) upper.pop();
    upper.push(i);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper); // CCW
}

function triEdges(t: Tri): Array<[number, number]> {
  return [
    [t.a, t.b],
    [t.b, t.c],
    [t.c, t.a],
  ];
}

function hasEdge(t: Tri, u: number, v: number): boolean {
  return triEdges(t).some(([x, y]) => (x === u && y === v) || (x === v && y === u));
}

/** Is point `pi` strictly inside the circumcircle of triangle `t`? */
function inCircumcircle(pts: ReadonlyArray<Point2>, t: Tri, pi: number): boolean {
  const [ax, ay] = pts[t.a];
  const [bx, by] = pts[t.b];
  const [cx, cy] = pts[t.c];
  const [px, py] = pts[pi];

  const adx = ax - px, ady = ay - py;
  const bdx = bx - px, bdy = by - py;
  const cdx = cx - px, cdy = cy - py;
  const ad = adx * adx + ady * ady;
  const bd = bdx * bdx + bdy * bdy;
  const cd = cdx * cdx + cdy * cdy;

  const det = adx * (bdy * cd - bd * cdy) - ady * (bdx * cd - bd * cdx) + ad * (bdx * cdy - bdy * cdx);
  // Orientation of the triangle decides the sign of "inside".
  const orient = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  return orient > 0 ? det > 0 : det < 0;
}
