// Animation Curves — named float curves sampled by play time (Unreal's anim
// curves: float / morph-target / material params). Headless: returns values; the
// app routes them to morph influences or material uniforms.

export interface CurveKey { t: number; v: number; interp?: 'linear' | 'step' }
export interface AnimCurve { name: string; keys: CurveKey[] }

/** Sample one curve at time `t` (keys assumed sorted by t; clamps at the ends). */
export function sampleCurve(curve: AnimCurve, t: number): number {
  const k = curve.keys;
  if (k.length === 0) return 0;
  if (t <= k[0].t) return k[0].v;
  if (t >= k[k.length - 1].t) return k[k.length - 1].v;
  let i = 0;
  while (i < k.length - 1 && k[i + 1].t <= t) i++;
  const a = k[i], b = k[i + 1];
  if (a.interp === 'step') return a.v;
  const f = (t - a.t) / (b.t - a.t || 1);
  return a.v + (b.v - a.v) * f;
}

export class CurveSet {
  private map = new Map<string, AnimCurve>();
  constructor(curves: AnimCurve[] = []) { for (const c of curves) this.map.set(c.name, c); }
  names(): string[] { return [...this.map.keys()]; }
  value(name: string, t: number): number { const c = this.map.get(name); return c ? sampleCurve(c, t) : 0; }
  /** Sample every curve at `t` into a name→value record. */
  sample(t: number): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [name, c] of this.map) out[name] = sampleCurve(c, t);
    return out;
  }
}
