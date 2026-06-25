// Look-at / aim solver — the runtime half of an aim offset. Computes the clamped,
// eased yaw/pitch that turns a transform's forward axis toward a world target:
// head tracking, eye look-at, turret/gun aim. Headless math (no three) so it unit-tests
// in isolation; an R3F hook applies the angles to a bone or Object3D each frame.
//
// Convention: rest forward is +Z, up is +Y. `yaw` rotates about +Y (right-handed:
// positive yaw turns toward +X), `pitch` rotates about +X (positive pitch looks down).
// Most three setups face -Z, so the hook negates as needed — the math here is the
// canonical +Z form and stays self-consistent for tests.

import { clamp, damp } from '@kutlaytunc/us3-core';
import type { Vec3 } from '@kutlaytunc/us3-core';

const HALF_PI = Math.PI / 2;
const THIRD_PI = Math.PI / 3;

export interface AimLimits {
  /** Yaw clamp in radians, relative to rest forward. Default ±90°. */
  yaw?: [number, number];
  /** Pitch clamp in radians. Default ±60°. */
  pitch?: [number, number];
}

/** Yaw + pitch (radians) that aim the +Z axis from `origin` toward `target`. */
export function aimYawPitch(origin: Vec3, target: Vec3): { yaw: number; pitch: number } {
  const dx = target[0] - origin[0];
  const dy = target[1] - origin[1];
  const dz = target[2] - origin[2];
  const yaw = Math.atan2(dx, dz); // 0 when target is straight ahead (+Z)
  const horiz = Math.hypot(dx, dz);
  const pitch = -Math.atan2(dy, horiz); // target above → look up → negative pitch
  return { yaw, pitch };
}

/**
 * Stateful aim solver: each `update` eases the current yaw/pitch toward the angles
 * needed to aim `origin → target`, clamped to `limits`. With `target = null` it
 * eases back to rest (0,0) — a head returning to neutral when it loses its mark.
 */
export class LookAtSolver {
  yaw = 0;
  pitch = 0;

  /** @param speed framerate-independent stiffness (larger = snappier). */
  constructor(private limits: AimLimits = {}, private speed = 8) {}

  setLimits(limits: AimLimits): void { this.limits = limits; }
  setSpeed(speed: number): void { this.speed = speed; }

  /** Target yaw/pitch for a target, clamped to limits (no easing) — useful for tests/snap. */
  solve(origin: Vec3, target: Vec3): { yaw: number; pitch: number } {
    const a = aimYawPitch(origin, target);
    const [ymin, ymax] = this.limits.yaw ?? [-HALF_PI, HALF_PI];
    const [pmin, pmax] = this.limits.pitch ?? [-THIRD_PI, THIRD_PI];
    return { yaw: clamp(a.yaw, ymin, ymax), pitch: clamp(a.pitch, pmin, pmax) };
  }

  /** Ease toward the target (or rest if null) over `dt` seconds; returns the new angles. */
  update(origin: Vec3, target: Vec3 | null, dt: number): { yaw: number; pitch: number } {
    const goal = target ? this.solve(origin, target) : { yaw: 0, pitch: 0 };
    this.yaw = damp(this.yaw, goal.yaw, this.speed, dt);
    this.pitch = damp(this.pitch, goal.pitch, this.speed, dt);
    return { yaw: this.yaw, pitch: this.pitch };
  }
}
