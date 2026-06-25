// Animation Notifies & Notify States — a clean web/TS take on Unreal's notify
// system. Point notifies fire as the play head crosses their time (loop-aware);
// notify states fire begin/tick/end while the head is inside their window. The
// runtime stays headless: it only emits named events; the app supplies effects.

export interface NotifyEvent { name: string; time: number; payload?: unknown }
export interface NotifyState { name: string; start: number; end: number; payload?: unknown }
export interface NotifyData { notifies?: NotifyEvent[]; states?: NotifyState[] }

export type NotifyHandler = (name: string, payload?: unknown) => void;
export type NotifyStateHandler = (name: string, phase: 'begin' | 'tick' | 'end', dt: number, payload?: unknown) => void;

/** True if `t` lies in the half-open interval (prev, cur], handling a loop wrap
 *  (signalled by cur < prev). */
function crossed(prev: number, cur: number, t: number): boolean {
  if (cur >= prev) return t > prev && t <= cur;
  return t > prev || t <= cur; // looped past the end this frame
}

export class NotifyTrack {
  private active = new Set<string>();
  constructor(private data: NotifyData) {}

  reset(): void { this.active.clear(); }

  /** Call each frame with the clip's previous + current play time and its loop
   *  duration. Emits point notifies crossed this frame and state begin/tick/end. */
  update(prev: number, cur: number, duration: number, onNotify?: NotifyHandler, onState?: NotifyStateHandler): void {
    // Accept absolute play time: wrap into clip space so a loop reads as cur < prev.
    if (duration > 0) { prev = ((prev % duration) + duration) % duration; cur = ((cur % duration) + duration) % duration; }
    for (const n of this.data.notifies ?? []) {
      if (crossed(prev, cur, n.time)) onNotify?.(n.name, n.payload);
    }
    for (const s of this.data.states ?? []) {
      const inside = cur >= s.start && cur < s.end;
      const was = this.active.has(s.name);
      if (inside && !was) { this.active.add(s.name); onState?.(s.name, 'begin', 0, s.payload); }
      if (inside) onState?.(s.name, 'tick', Math.max(0, cur - prev), s.payload);
      if (!inside && was) { this.active.delete(s.name); onState?.(s.name, 'end', 0, s.payload); }
    }
  }
}
