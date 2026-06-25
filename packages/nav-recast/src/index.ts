// A recast-navigation–backed NavProvider for us3. Bake a real navmesh from your scene
// geometry and the AI (behaviour trees, steering, crowds, useNavAgent) navigates it unchanged —
// because everything talks to the navmesh-agnostic NavProvider interface in @kutlaytunc/us3-core.
//
//   import { init, RecastNavProvider } from '@kutlaytunc/us3-nav-recast'
//   await init()                                   // load the recast WASM once, up front
//   const nav = RecastNavProvider.fromMeshes([groundMesh, ...obstacleMeshes])
//   // then: useNavAgent(nav, ref) / new Crowd(nav) / a BT task calling nav.findPath(...)

import { NavMeshQuery, type NavMesh } from '@recast-navigation/core';
import { threeToSoloNavMesh } from '@recast-navigation/three';
import { Vector3, type Mesh } from 'three';
import type { NavProvider, NavPoint } from '@kutlaytunc/us3-core';

/** Recast solo-navmesh generation config (cellSize, walkableRadius, walkableSlopeAngle, …). */
export type RecastNavConfig = Parameters<typeof threeToSoloNavMesh>[1];

/** Re-exported so consumers initialise the recast WASM with one import: `await init()`. */
export { init } from '@recast-navigation/core';

/**
 * A {@link NavProvider} backed by a baked recast navmesh. Points are world XZ (the provider tracks
 * the ground height internally so paths/projection sit on the mesh); height of your character is
 * still owned by your physics/controller (e.g. ecctrl).
 */
export class RecastNavProvider implements NavProvider {
  readonly navMesh: NavMesh;
  private readonly query: NavMeshQuery;
  /** Last sampled ground height — used to lift XZ queries onto the mesh. */
  private agentY = 0;

  private constructor(navMesh: NavMesh) {
    this.navMesh = navMesh;
    this.query = new NavMeshQuery(navMesh);
  }

  /**
   * Bake a navmesh from walkable + obstacle meshes (ground, ramps, walls). Requires `await init()`
   * first. Throws if generation fails (degenerate/empty input).
   */
  static fromMeshes(meshes: Mesh[], config?: RecastNavConfig): RecastNavProvider {
    const result = threeToSoloNavMesh(meshes, config);
    if (!result.success) throw new Error('[nav-recast] navmesh generation failed');
    return new RecastNavProvider(result.navMesh);
  }

  /** Wrap an already-built recast NavMesh. */
  static fromNavMesh(navMesh: NavMesh): RecastNavProvider {
    return new RecastNavProvider(navMesh);
  }

  findPath(from: NavPoint, to: NavPoint): NavPoint[] {
    const r = this.query.computePath(this.toV3(from), this.toV3(to));
    if (!r.success || r.path.length === 0) return [];
    return r.path.map((p) => [p.x, p.z] as NavPoint);
  }

  project(p: NavPoint): NavPoint | null {
    const r = this.query.findClosestPoint(this.toV3(p));
    if (!r.success) return null;
    this.agentY = r.point.y; // remember the mesh height under the agent
    return [r.point.x, r.point.z];
  }

  contains(p: NavPoint): boolean {
    const r = this.query.findClosestPoint(this.toV3(p));
    if (!r.success) return false;
    const dx = r.point.x - p[0], dz = r.point.z - p[1];
    return dx * dx + dz * dz < 1e-4; // the nearest mesh point is essentially this point → on-mesh
  }

  randomPoint(): NavPoint | null {
    const r = this.query.findRandomPoint();
    return r.success ? [r.randomPoint.x, r.randomPoint.z] : null;
  }

  isReachable(from: NavPoint, to: NavPoint): boolean {
    return this.findPath(from, to).length > 0;
  }

  /** Free the underlying recast WASM objects. Call on teardown. */
  destroy(): void {
    this.query.destroy();
    this.navMesh.destroy();
  }

  private toV3(p: NavPoint): Vector3 {
    return new Vector3(p[0], this.agentY, p[1]);
  }
}
