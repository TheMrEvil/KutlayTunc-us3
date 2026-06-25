// @kutlaytunc/us3-core — the shared foundation both @kutlaytunc/us3-ai and @kutlaytunc/us3-anim build on:
// pure in-house math, common types, and the two swap interfaces that keep us3
// composable —
//   • NavProvider   → navmesh-agnostic AI (grid fallback here, recast in @kutlaytunc/us3-nav-recast)
//   • WeightSolver  → drei-swappable animation blend layer
// Zero runtime dependencies. No three, no DOM, no React.

// ── math (in-house: scalar helpers, 1D bracketing, 2D Delaunay barycentric) ──
export { clamp, lerp, inverseLerp, damp, dampAngle, shortestAngle, approxEqual, smoothDamp } from './math/scalar';
export { bracketWeights } from './math/bracket';
export type { WeightEntry, WeightList } from './math/bracket';
export { BlendTriangulation, barycentric } from './math/triangulation';
export type { Point2, Triangle } from './math/triangulation';

// ── shared types ────────────────────────────────────────────────────────────
export type { Vec3 } from './types';

// ── swap interfaces ─────────────────────────────────────────────────────────
export type { NavProvider, NavPoint } from './navProvider';
export type { WeightSolver } from './weightSolver';
