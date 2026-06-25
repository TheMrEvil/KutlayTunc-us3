// The only three-coupled module in core. Owns a THREE.AnimationMixer and one
// AnimationAction per asset clip, and writes the controller's per-frame weights
// onto them via setEffectiveWeight. Additive clips are baked once and run in
// AdditiveAnimationBlendMode so they sum on top of the base locomotion.

import * as THREE from 'three';
import type { AnimGraphAsset } from '../asset/types';
import type { AnimController } from '../controller/controller';
import type { ClipWeights } from '../controller/weights';

const EPS = 1e-4;

export interface MixerDriverOptions {
  /** Override the additive reference FPS used when baking additive clips. @default 30 */
  additiveFps?: number;
}

export class MixerDriver {
  readonly mixer: THREE.AnimationMixer;
  /** Source clip names referenced by the asset that weren't found in the model's animations.
   *  Surfaced (instead of only console.warn'd) so an app/editor can show a visible error. */
  readonly missingClips: string[] = [];
  /** clipDef.name → action */
  private readonly actions = new Map<string, THREE.AnimationAction>();
  /** clips this driver baked as additive copies (disposed on teardown). */
  private readonly bakedClips: THREE.AnimationClip[] = [];

  constructor(root: THREE.Object3D, asset: AnimGraphAsset, clips: ReadonlyArray<THREE.AnimationClip>, opts: MixerDriverOptions = {}) {
    this.mixer = new THREE.AnimationMixer(root);
    const byName = new Map(clips.map((c) => [c.name, c] as const));
    const fps = opts.additiveFps ?? 30;

    for (const def of asset.clips) {
      const sourceName = def.clip ?? def.name;
      const source = byName.get(sourceName);
      if (!source) {
        this.missingClips.push(sourceName);
        console.warn(`[us3] clip "${sourceName}" not found in the model's animations`);
        continue;
      }

      let clip = source;
      let blendMode: THREE.AnimationBlendMode = THREE.NormalAnimationBlendMode;
      if (def.additive) {
        clip = source.clone();
        THREE.AnimationUtils.makeClipAdditive(clip, def.additiveRef ?? 0, clip, fps);
        blendMode = THREE.AdditiveAnimationBlendMode;
        this.bakedClips.push(clip);
      }

      const action = this.mixer.clipAction(clip, root, blendMode);
      action.loop = def.loop === false ? THREE.LoopOnce : THREE.LoopRepeat;
      action.clampWhenFinished = def.loop === false;
      action.timeScale = def.rateScale ?? 1;
      action.enabled = true;
      action.setEffectiveWeight(0);
      action.play();
      this.actions.set(def.name, action);
    }
  }

  /** Apply the controller's computed weights and advance the mixer by `dt` seconds. */
  update(controller: AnimController, dt: number): void {
    this.applyWeights(controller.baseWeights, controller.additiveWeights);
    this.mixer.update(dt);
  }

  /** Apply weights without advancing the mixer (e.g. editor scrubbing). */
  applyWeights(base: ClipWeights, additive: ClipWeights): void {
    for (const [name, action] of this.actions) {
      // Read each action's weight from the map matching ITS blend mode. Previously a single
      // `base ?? additive` coalesce meant a clip present in both the base graph and an additive
      // layer silently dropped its additive weight; now an additive-baked action takes the
      // additive weight and a normal action takes the base weight, so both layers apply.
      const w = action.blendMode === THREE.AdditiveAnimationBlendMode ? (additive.get(name) ?? 0) : (base.get(name) ?? 0);
      action.setEffectiveWeight(w < EPS ? 0 : w);
    }
  }

  /** The action for an asset clip, if it exists. */
  getAction(clipDefName: string): THREE.AnimationAction | undefined {
    return this.actions.get(clipDefName);
  }

  /** Longest clip duration among the bound actions, in seconds (for a timeline). */
  maxDuration(): number {
    let max = 0;
    for (const a of this.actions.values()) max = Math.max(max, a.getClip().duration);
    return max;
  }

  /** Stop all actions and release mixer + baked-clip resources. */
  dispose(): void {
    this.mixer.stopAllAction();
    for (const action of this.actions.values()) this.mixer.uncacheAction(action.getClip());
    for (const clip of this.bakedClips) this.mixer.uncacheClip(clip);
    this.actions.clear();
    this.bakedClips.length = 0;
  }
}
