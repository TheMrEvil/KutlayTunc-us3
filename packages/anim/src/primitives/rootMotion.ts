// Root Motion — extract per-frame movement from the root bone so the animation
// drives the character's transform instead of sliding feet. Headless: the app
// feeds the root bone's world XZ + yaw each frame and gets back the delta to apply
// to the character (and should zero the root bone's in-place translation).

export interface RootDelta { dx: number; dz: number; dyaw: number }

export class RootMotion {
  private prev: { x: number; z: number; yaw: number } | null = null;

  reset(): void { this.prev = null; }

  /** Feed the root bone's current world X, Z and yaw; returns the delta since the
   *  last call (zero on the first frame and across loop jumps you signal by reset). */
  consume(x: number, z: number, yaw: number): RootDelta {
    if (!this.prev) { this.prev = { x, z, yaw }; return { dx: 0, dz: 0, dyaw: 0 }; }
    let dyaw = yaw - this.prev.yaw;
    // shortest angular path
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    const delta: RootDelta = { dx: x - this.prev.x, dz: z - this.prev.z, dyaw };
    this.prev = { x, z, yaw };
    return delta;
  }
}
