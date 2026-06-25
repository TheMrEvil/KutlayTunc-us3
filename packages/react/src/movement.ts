// A standalone movement-signal bridge. us3 never hard-depends on any NPC or
// character-controller package; instead a caller maps its per-frame movement into
// these plain signals. Works out of the box with @activatebilisim/npc's `Movement`
// (which already exposes speed / turnRate / lean / anim).

import type { AnimController } from '@kutlaytunc/us3-anim';

/** Plain per-frame locomotion signals — a structural superset-compatible shape. */
export interface MovementSignals {
  /** World-space speed in units/second. */
  speed: number;
  /** Signed angular speed of the heading (rad/s) — turn-in-place / turn blend. */
  turnRate?: number;
  /** Banking lean into turns, roughly [-1, 1]. */
  lean?: number;
  /** Free-form one-shot/overlay animation tag. */
  anim?: string | null;
}

export interface MovementMapOptions {
  /** Normalize `speed` into a 0..1 locomotion axis by dividing by this. @default 1 */
  maxSpeed?: number;
  /** Param names to write (override to match your asset). */
  speedParam?: string;
  turnParam?: string;
  leanParam?: string;
  movingParam?: string;
  overlayParam?: string;
  /** Speed below which `moving` is false. @default 0.05 */
  idleThreshold?: number;
}

/**
 * Map movement signals onto an AnimController's parameters. Call once per frame
 * (typically inside `useAnimGraph`'s `onFrame`).
 */
export function applyMovement(controller: AnimController, m: MovementSignals, opts: MovementMapOptions = {}): void {
  const maxSpeed = opts.maxSpeed ?? 1;
  const idle = opts.idleThreshold ?? 0.05;
  controller.setParam(opts.speedParam ?? 'speed', maxSpeed > 0 ? m.speed / maxSpeed : m.speed);
  if (m.turnRate !== undefined) controller.setParam(opts.turnParam ?? 'turnRate', m.turnRate);
  if (m.lean !== undefined) controller.setParam(opts.leanParam ?? 'lean', m.lean);
  controller.setParam(opts.movingParam ?? 'moving', m.speed > idle);
  if (m.anim != null) controller.setParam(opts.overlayParam ?? 'overlay', m.anim);
}
