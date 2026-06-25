// Foot IK grounding — plant feet on uneven ground and drop the pelvis so the lowest
// foot can reach, without lifting the body off a slope. A clean take on Unreal's foot
// placement / Unity Animation Rigging grounding. Headless: feed the animated ankle
// positions + a ground-height query; get back grounded ankle targets + a pelvis offset.
// The R3F hook supplies the raycast and runs `solveTwoBone` on each leg with these targets.

import { clamp, damp } from '@kutlaytunc/us3-core';
import type { Vec3 } from '@kutlaytunc/us3-core';

export interface FootSample {
  /** Animated ankle world position. */
  pos: Vec3;
  /** Ground height under this foot (world Y), or null if no hit (foot floats free). */
  groundY: number | null;
}

export interface GroundOptions {
  /** Ankle height above the sole — the ankle rests this far above the ground. Default 0.1. */
  ankleHeight?: number;
  /** Max distance the pelvis may drop on a slope. Default 0.5. */
  maxPelvisDrop?: number;
}

export interface GroundResult {
  /** World-Y offset to apply to the pelvis (≤ 0 — grounding only ever drops). */
  pelvisOffset: number;
  /** Grounded ankle targets (same order as input), pelvis offset already folded in. */
  feet: Vec3[];
}

/** Instant (un-smoothed) grounding solve. */
export function groundFeet(feet: FootSample[], opts: GroundOptions = {}): GroundResult {
  const ankle = opts.ankleHeight ?? 0.1;
  const maxDrop = opts.maxPelvisDrop ?? 0.5;

  // Per-foot vertical delta to reach the ground. Negative → ground is below the animated
  // foot (downhill), so the body must drop for the foot to reach it.
  let lowest = 0; // most-negative delta
  for (const f of feet) {
    if (f.groundY == null) continue;
    const delta = f.groundY + ankle - f.pos[1];
    if (delta < lowest) lowest = delta;
  }
  const pelvisOffset = clamp(lowest, -maxDrop, 0);

  const out: Vec3[] = feet.map((f) => {
    const y = f.pos[1] + pelvisOffset;
    // Never let a foot sink below its ground; lift it up onto ground above.
    const grounded = f.groundY != null ? Math.max(y, f.groundY + ankle) : y;
    return [f.pos[0], grounded, f.pos[2]];
  });
  return { pelvisOffset, feet: out };
}

/**
 * Stateful grounder that smooths the pelvis offset across frames so the body settles
 * onto slopes/steps instead of snapping. Feet are re-grounded against the smoothed pelvis.
 */
export class FootGrounder {
  pelvisOffset = 0;
  constructor(private opts: GroundOptions = {}, private speed = 12) {}

  setOptions(opts: GroundOptions): void { this.opts = opts; }

  update(feet: FootSample[], dt: number): GroundResult {
    const target = groundFeet(feet, this.opts).pelvisOffset;
    this.pelvisOffset = damp(this.pelvisOffset, target, this.speed, dt);
    const ankle = this.opts.ankleHeight ?? 0.1;
    const out: Vec3[] = feet.map((f) => {
      const y = f.pos[1] + this.pelvisOffset;
      const grounded = f.groundY != null ? Math.max(y, f.groundY + ankle) : y;
      return [f.pos[0], grounded, f.pos[2]];
    });
    return { pelvisOffset: this.pelvisOffset, feet: out };
  }
}
