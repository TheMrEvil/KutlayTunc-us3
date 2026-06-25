// AI Perception — a clean web/TS take on Unreal's stimulus/listener perception.
// Listeners have senses (sight/hearing/damage); sources emit stimuli. Sight is
// continuous (radius + lose-sight hysteresis + peripheral cone + line-of-sight
// raycast); hearing/damage are reported events. Stimuli age and are forgotten.

type Vec3 = [number, number, number];
export type SenseType = 'sight' | 'hearing' | 'damage';

export interface SightConfig { enabled?: boolean; radius: number; loseSightRadius?: number; peripheralHalfAngleDeg?: number }
export interface PerceptionConfig {
  sight?: SightConfig;
  hearing?: { enabled?: boolean; range: number };
  damage?: { enabled?: boolean };
  /** forget a stimulus this many seconds after it stops being sensed (0 = never) */
  maxAge?: number;
}

export interface Pose { position: Vec3; forward: Vec3 }
export interface Stimulus { sourceId: string; sense: SenseType; location: Vec3; strength: number; age: number; sensed: boolean }
export type RaycastFn = (from: Vec3, to: Vec3) => boolean; // true == blocked (no line of sight)

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: Vec3): Vec3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

interface Source { senses: Set<SenseType>; getPos: () => Vec3 }
interface Listener { config: PerceptionConfig; getPose: () => Pose; perceived: Map<string, Stimulus>; onUpdate?: (s: Stimulus) => void }

export class PerceptionSystem {
  private sources = new Map<string, Source>();
  private listeners = new Map<string, Listener>();
  private raycast?: RaycastFn;

  constructor(opts?: { raycast?: RaycastFn }) { this.raycast = opts?.raycast; }

  registerSource(id: string, senses: SenseType[], getPos: () => Vec3): () => void {
    this.sources.set(id, { senses: new Set(senses), getPos });
    return () => { this.sources.delete(id); };
  }
  registerListener(id: string, config: PerceptionConfig, getPose: () => Pose, onUpdate?: (s: Stimulus) => void): () => void {
    this.listeners.set(id, { config, getPose, perceived: new Map(), onUpdate });
    return () => { this.listeners.delete(id); };
  }

  /** All currently-known stimuli for a listener (optionally one sense). */
  getPerceived(listenerId: string, sense?: SenseType): Stimulus[] {
    const l = this.listeners.get(listenerId);
    if (!l) return [];
    return [...l.perceived.values()].filter((s) => !sense || s.sense === sense);
  }

  reportNoise(ev: { location: Vec3; loudness?: number; sourceId?: string }): void {
    for (const [, l] of this.listeners) {
      const h = l.config.hearing;
      if (!h?.enabled || h.range == null) continue;
      const d = len(sub(ev.location, l.getPose().position));
      if (d > h.range) continue;
      this.write(l, { sourceId: ev.sourceId ?? `noise@${ev.location.join(',')}`, sense: 'hearing', location: ev.location, strength: ev.loudness ?? 1, age: 0, sensed: true });
    }
  }

  reportDamage(targetId: string, instigatorId: string, location: Vec3): void {
    const l = this.listeners.get(targetId);
    if (!l?.config.damage?.enabled) return;
    this.write(l, { sourceId: instigatorId, sense: 'damage', location, strength: 1, age: 0, sensed: true });
  }

  /** Advance continuous senses (sight), age stimuli, and forget stale ones. */
  tick(dt: number): void {
    for (const [, l] of this.listeners) {
      const sight = l.config.sight;
      if (sight?.enabled && sight.radius > 0) this.updateSight(l, sight);
      // age + forget
      for (const [key, s] of l.perceived) {
        s.age += dt;
        const maxAge = l.config.maxAge ?? 0;
        if (!s.sensed && maxAge > 0 && s.age > maxAge) {
          l.perceived.delete(key);
          l.onUpdate?.({ ...s, sensed: false });
        }
      }
    }
  }

  private updateSight(l: Listener, cfg: SightConfig): void {
    const pose = l.getPose();
    const cosHalf = Math.cos(((cfg.peripheralHalfAngleDeg ?? 90) * Math.PI) / 180);
    const fwd = norm(pose.forward);
    for (const [id, src] of this.sources) {
      if (!src.senses.has('sight')) continue;
      const key = `sight:${id}`;
      const prev = l.perceived.get(key);
      const wasSensed = prev?.sensed ?? false;
      const pos = src.getPos();
      const to = sub(pos, pose.position);
      const d = len(to);
      const effRadius = wasSensed ? (cfg.loseSightRadius ?? cfg.radius) : cfg.radius;
      const inRange = d <= effRadius;
      const inCone = d < 1e-4 || dot(fwd, norm(to)) >= cosHalf;
      const losClear = !this.raycast || !this.raycast(pose.position, pos);
      const sensed = inRange && inCone && losClear;
      if (sensed) {
        const stim: Stimulus = { sourceId: id, sense: 'sight', location: pos, strength: Math.max(0, 1 - d / cfg.radius), age: 0, sensed: true };
        l.perceived.set(key, stim);
        if (!wasSensed) l.onUpdate?.(stim);
      } else if (prev && wasSensed) {
        prev.sensed = false; prev.age = 0;
        l.onUpdate?.({ ...prev });
      }
    }
  }

  private write(l: Listener, stim: Stimulus): void {
    const key = `${stim.sense}:${stim.sourceId}`;
    l.perceived.set(key, stim);
    l.onUpdate?.(stim);
  }
}
