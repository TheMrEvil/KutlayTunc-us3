// Pure scalar helpers. No three, no DOM — unit-testable in isolation.

/** Clamp `x` into the inclusive range `[min, max]`. */
export function clamp(x: number, min: number, max: number): number {
  return x < min ? min : x > max ? max : x;
}

/** Linear interpolation. `t` is not clamped. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Inverse lerp: where does `x` sit between `a` and `b`? Returns 0 when `a === b`. */
export function inverseLerp(a: number, b: number, x: number): number {
  return a === b ? 0 : (x - a) / (b - a);
}

/**
 * Framerate-independent exponential smoothing — moves `current` toward `target`
 * with a half-life-like stiffness `lambda` (larger = snappier) over `dt` seconds.
 * Equivalent to three.js' `MathUtils.damp`.
 */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

const TAU = Math.PI * 2;

/** Smallest signed angular difference `b - a`, wrapped to `(-π, π]`. */
export function shortestAngle(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  else if (d < -Math.PI) d += TAU;
  return d;
}

/** Angular damp along the shortest arc. */
export function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  return current + shortestAngle(current, target) * (1 - Math.exp(-lambda * dt));
}

/** True when `a` and `b` are within `eps`. */
export function approxEqual(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) <= eps;
}

/**
 * Critically-damped spring smoothing (Unity's Mathf.SmoothDamp) — eases `current`
 * toward `target` over roughly `smoothTime` seconds without overshoot. `vel` is a
 * mutable carrier of the current velocity (persist it across frames). Great for
 * camera follow, aim, and parameter transitions.
 */
export function smoothDamp(current: number, target: number, vel: { value: number }, smoothTime: number, dt: number, maxSpeed = Infinity): number {
  smoothTime = Math.max(0.0001, smoothTime);
  const omega = 2 / smoothTime;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  let change = current - target;
  const maxChange = maxSpeed * smoothTime;
  change = clamp(change, -maxChange, maxChange);
  const target2 = current - change;
  const temp = (vel.value + omega * change) * dt;
  vel.value = (vel.value - omega * temp) * exp;
  let output = target2 + (change + temp) * exp;
  if (target - current > 0 === output > target) {
    output = target;
    vel.value = (output - target2) / dt;
  }
  return output;
}
