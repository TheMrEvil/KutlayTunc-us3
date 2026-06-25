// The controller — us3's "AnimGraph". Every frame it: smooths input
// parameters, advances the state machine, evaluates the active state(s) and any
// additive layers into clip-weight maps, and normalizes the base layer. It holds
// NO three/react state; a driver applies the resulting weights to an AnimationMixer.

import type { AnimGraphAsset, AnimSource, BlendSpaceDef, LayerDef, ParamBag, ParamValue, StateDef } from '../asset/types';
import { BlendSpace } from '../blendspace/blendspace';
import { AnimStateMachine } from '../statemachine/statemachine';
import { evalRule } from '../statemachine/rules';
import { clamp, damp } from '@kutlaytunc/us3-core';
import type { WeightSolver } from '@kutlaytunc/us3-core';
import type { ClipWeights } from './weights';
import { addClipWeight, normalizeClipWeights } from './weights';

/** Build a custom blend backend (e.g. a future drei-native solver) for a blend-space
 *  def instead of the built-in {@link BlendSpace}. Pass via `new AnimController(asset, { solverFactory })`. */
export type WeightSolverFactory = (def: BlendSpaceDef) => WeightSolver;

export class AnimController {
  readonly asset: AnimGraphAsset;
  private readonly sm: AnimStateMachine;
  /** Per-blend-space weight solvers (swappable via the constructor's `solverFactory`). */
  private readonly solvers = new Map<string, WeightSolver>();
  /** The blend-space defs (axes + sample→clip mapping the controller applies the weights through). */
  private readonly bsDefs = new Map<string, BlendSpaceDef>();
  private readonly statesById = new Map<string, StateDef>();

  /** Smoothed live parameter values. */
  private readonly params: ParamBag = {};
  /** Targets the smoothed values chase. */
  private readonly targets: ParamBag = {};
  /** Smoothed layer alphas, keyed by layer id. */
  private readonly layerAlpha = new Map<string, number>();

  /** Base-layer (normal-mode) clip weights, normalized to sum 1. */
  readonly baseWeights: ClipWeights = new Map();
  /** Additive-layer clip weights. */
  readonly additiveWeights: ClipWeights = new Map();

  constructor(asset: AnimGraphAsset, opts?: { solverFactory?: WeightSolverFactory }) {
    this.asset = asset;
    const makeSolver = opts?.solverFactory ?? ((def: BlendSpaceDef) => new BlendSpace(def));
    for (const bs of asset.blendSpaces) {
      this.solvers.set(bs.id, makeSolver(bs));
      this.bsDefs.set(bs.id, bs);
    }
    for (const s of asset.stateMachine.states) this.statesById.set(s.id, s);
    this.sm = new AnimStateMachine(asset.stateMachine);
    for (const p of asset.params) {
      this.params[p.name] = p.default;
      this.targets[p.name] = p.default;
    }
    for (const layer of asset.layers ?? []) this.layerAlpha.set(layer.id, 0);
  }

  /** Set a parameter's target value (float params ease toward it). */
  setParam(name: string, value: ParamValue): this {
    this.targets[name] = value;
    return this;
  }

  /** Read a parameter's current (smoothed) value. */
  getParam(name: string): ParamValue | undefined {
    return this.params[name];
  }

  /** The id of the currently active state. */
  get activeStateId(): string {
    return this.sm.activeStateId;
  }

  /** Restart the state machine at its entry state. */
  reset(): void {
    this.sm.reset();
  }

  /** Tick the graph. Call once per frame, before the mixer updates. */
  update(dt: number): void {
    this.smoothParams(dt);

    // Base layer: the state machine's active state(s).
    this.baseWeights.clear();
    const blend = this.sm.update(dt, this.params);
    for (const sb of blend) {
      const state = this.statesById.get(sb.stateId);
      if (state) this.evalSource(state.source, sb.weight, this.baseWeights);
    }
    normalizeClipWeights(this.baseWeights);

    // Additive layers.
    this.additiveWeights.clear();
    for (const layer of this.asset.layers ?? []) {
      const alpha = this.smoothLayerAlpha(layer, dt);
      if (alpha > 1e-4) this.evalSource(layer.source, alpha, this.additiveWeights);
    }
  }

  private smoothParams(dt: number): void {
    for (const p of this.asset.params) {
      if (p.type === 'float' && p.smoothing && p.smoothing > 0) {
        this.params[p.name] = damp(Number(this.params[p.name]), Number(this.targets[p.name]), p.smoothing, dt);
      } else {
        this.params[p.name] = this.targets[p.name];
      }
    }
  }

  private evalSource(source: AnimSource, scale: number, out: ClipWeights): void {
    if (source.kind === 'clip') {
      addClipWeight(out, source.clip, scale);
      return;
    }
    const solver = this.solvers.get(source.ref);
    const def = this.bsDefs.get(source.ref);
    if (!solver || !def) return;
    const coords = def.axes.map((ax) => Number(this.params[ax.name] ?? 0));
    for (const { index, weight } of solver.weightsAt(coords)) {
      const sample = def.samples[index]; // tolerate out-of-range indices from a custom WeightSolver
      if (sample) addClipWeight(out, sample.clip, weight * scale);
    }
  }

  private smoothLayerAlpha(layer: LayerDef, dt: number): number {
    let target: number;
    if (layer.weightRule) target = evalRule(layer.weightRule, this.params) ? 1 : 0;
    else if (layer.weightParam) target = clamp(Number(this.params[layer.weightParam] ?? 0), 0, 1);
    else target = 1;

    const prev = this.layerAlpha.get(layer.id) ?? 0;
    const next = layer.weightSmoothing && layer.weightSmoothing > 0 ? damp(prev, target, layer.weightSmoothing, dt) : target;
    this.layerAlpha.set(layer.id, next);
    return next;
  }
}
