// The navmesh-agnostic surface the AI navigates against. The built-in `NavGrid` is one
// implementation (a simple uniform grid); `@kutlaytunc/us3-nav-recast` provides a recast-navigation
// (real navmesh) implementation. Swapping navmesh tech never touches your AI/steering code.
//
// All points are world [x, z] on the XZ plane. Vertical placement is owned by your physics /
// character controller (e.g. ecctrl) — the AI only decides *where* on the ground to go.

export type NavPoint = [number, number];

export interface NavProvider {
  /** A path of world waypoints from→to (inclusive of both ends), or [] if unreachable. */
  findPath(from: NavPoint, to: NavPoint): NavPoint[];
  /** The nearest point that lies ON the nav surface, or null if there is none nearby. */
  project(p: NavPoint): NavPoint | null;
  /** Whether `p` is already on the nav surface (lets consumers avoid needless re-projection). */
  contains?(p: NavPoint): boolean;
  /** A random reachable point on the nav surface, or null. */
  randomPoint?(): NavPoint | null;
  /** Whether a path exists between two points. */
  isReachable?(from: NavPoint, to: NavPoint): boolean;
}
