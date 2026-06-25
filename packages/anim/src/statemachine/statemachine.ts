// The animation state machine. States are evaluated for their outgoing
// transitions; a firing rule starts a crossfade that the controller realises by
// blending the two states' sources. Mirrors Unreal's AnimGraph state machine
// (directional transitions, boolean rules, blend duration + curve, priority).

import type { ParamBag, StateMachineDef, TransitionDef } from '../asset/types';
import { DEFAULT_TRANSITION_DURATION } from '../asset/factory';
import { evalRule } from './rules';
import { applyCurve } from './curves';

/** An active state and how much it contributes this frame. */
export interface StateBlend {
  stateId: string;
  weight: number;
}

interface Crossfade {
  fromId: string;
  toId: string;
  t: number;
  duration: number;
  transition: TransitionDef;
}

export class AnimStateMachine {
  readonly def: StateMachineDef;
  private currentId: string;
  private cross: Crossfade | null = null;
  /** Cached outgoing transitions per state, in priority order. */
  private readonly outgoing: Map<string, TransitionDef[]>;

  constructor(def: StateMachineDef) {
    this.def = def;
    this.currentId = def.entry;
    this.outgoing = new Map();
    for (const s of def.states) this.outgoing.set(s.id, []);
    for (const t of def.transitions) {
      const list = this.outgoing.get(t.from);
      if (list) list.push(t);
    }
    for (const list of this.outgoing.values()) {
      list.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    }
  }

  /** The currently dominant (or, mid-blend, the incoming) state id. */
  get activeStateId(): string {
    return this.cross ? this.cross.toId : this.currentId;
  }

  /** True while a transition crossfade is in progress. */
  get isTransitioning(): boolean {
    return this.cross !== null;
  }

  /** Snap back to the entry state. */
  reset(): void {
    this.currentId = this.def.entry;
    this.cross = null;
  }

  /** Advance the machine; returns the active states with weights summing to 1. */
  update(dt: number, params: ParamBag): StateBlend[] {
    // 1. Progress an in-flight crossfade.
    if (this.cross) {
      this.cross.t += dt;
      if (this.cross.t >= this.cross.duration) {
        this.currentId = this.cross.toId;
        this.cross = null;
      }
    }

    // 2. While settled, look for a transition to start.
    if (!this.cross) {
      const next = this.pickTransition(params);
      if (next) {
        const duration = next.duration ?? DEFAULT_TRANSITION_DURATION;
        if (duration <= 1e-4) {
          this.currentId = next.to;
        } else {
          this.cross = { fromId: this.currentId, toId: next.to, t: 0, duration, transition: next };
        }
      }
    }

    // 3. Emit the blend.
    if (this.cross) {
      const a = applyCurve(this.cross.transition.curve ?? 'easeInOut', this.cross.t / this.cross.duration);
      return [
        { stateId: this.cross.fromId, weight: 1 - a },
        { stateId: this.cross.toId, weight: a },
      ];
    }
    return [{ stateId: this.currentId, weight: 1 }];
  }

  private pickTransition(params: ParamBag): TransitionDef | null {
    const list = this.outgoing.get(this.currentId);
    if (!list) return null;
    for (const t of list) {
      if (t.to === this.currentId) continue;
      if (evalRule(t.rule, params)) return t; // list is priority-sorted
    }
    return null;
  }
}
