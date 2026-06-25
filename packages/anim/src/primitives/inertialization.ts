// Inertialization — Unreal-style transition smoothing. Instead of cross-fading,
// the difference (offset) between the old and new pose decays to zero over a
// duration via a quintic that lands with zero value, velocity AND acceleration —
// so blends are smooth and overshoot-free. This is the 1D core; apply it per bone
// channel / per parameter.

/**
 * Value of a decaying offset at time `t` into a blend of length `t1`, given the
 * offset `x0` and its rate `v0` at t=0. Quintic with p(0)=x0, p'(0)=v0,
 * p''(0)=0 and p(t1)=p'(t1)=p''(t1)=0. Returns 0 once `t >= t1`.
 */
export function calcInertialFloat(x0: number, v0: number, t: number, t1: number): number {
  if (t1 <= 0 || t >= t1) return 0;
  const V = v0 * t1; // velocity in normalized-time units
  const s = t / t1;
  const s2 = s * s, s3 = s2 * s, s4 = s3 * s, s5 = s4 * s;
  return x0 + V * s + (-10 * x0 - 6 * V) * s3 + (15 * x0 + 8 * V) * s4 + (-6 * x0 - 3 * V) * s5;
}

/**
 * Tracks one scalar that inertializes toward a moving target on demand. Call
 * `inertialize(duration)` at a transition (snapshots the current offset+velocity),
 * then `update(target, dt)` each frame to get a smooth, overshoot-free value.
 */
export class Inertializer {
  private value: number;
  private prevValue: number;
  private x0 = 0;
  private v0 = 0;
  private t = 0;
  private t1 = 0;
  private lastDt = 1 / 60;

  constructor(initial = 0) { this.value = initial; this.prevValue = initial; }

  get current(): number { return this.value; }

  /** Begin an inertialized blend of `duration` seconds from the current state. */
  inertialize(duration: number, target = this.value): void {
    this.x0 = this.value - target;
    this.v0 = (this.value - this.prevValue) / this.lastDt;
    this.t = 0;
    this.t1 = Math.max(0, duration);
  }

  /** Advance toward `target`; returns the smoothed value. */
  update(target: number, dt: number): number {
    this.prevValue = this.value;
    this.lastDt = dt > 0 ? dt : this.lastDt;
    if (this.t1 > 0 && this.t < this.t1) {
      this.t += dt;
      this.value = target + calcInertialFloat(this.x0, this.v0, this.t, this.t1);
    } else {
      this.value = target;
    }
    return this.value;
  }
}
