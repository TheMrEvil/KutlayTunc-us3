// Headless three.js integration: build a real AnimationMixer over synthetic
// clips and assert the controller's weights land on the actions. No DOM/WebGL —
// three's animation system runs fine in Node.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { AnimController } from '../src/controller/controller';
import { MixerDriver } from '../src/driver/mixerDriver';
import type { AnimGraphAsset } from '../src/asset/types';

function clip(name: string): THREE.AnimationClip {
  // a 1s clip that moves .position from origin to +x — enough to bind & mix
  const track = new THREE.VectorKeyframeTrack('.position', [0, 1], [0, 0, 0, 1, 0, 0]);
  return new THREE.AnimationClip(name, 1, [track]);
}

function asset(): AnimGraphAsset {
  return {
    version: 1,
    params: [{ name: 'speed', type: 'float', default: 0, smoothing: 0 }],
    clips: [{ name: 'idle' }, { name: 'walk' }, { name: 'run' }],
    blendSpaces: [
      {
        id: 'loco',
        dimensions: 1,
        axes: [{ name: 'speed', min: 0, max: 1 }],
        samples: [
          { id: 's0', clip: 'idle', position: [0] },
          { id: 's1', clip: 'walk', position: [0.5] },
          { id: 's2', clip: 'run', position: [1] },
        ],
      },
    ],
    stateMachine: { id: 'sm', entry: 'move', states: [{ id: 'move', source: { kind: 'blendspace', ref: 'loco' } }], transitions: [] },
  };
}

describe('MixerDriver', () => {
  it('applies controller weights onto AnimationActions', () => {
    const root = new THREE.Object3D();
    const clips = [clip('idle'), clip('walk'), clip('run')];
    const controller = new AnimController(asset());
    const driver = new MixerDriver(root, controller.asset, clips);

    controller.setParam('speed', 0.25);
    controller.update(1 / 60);
    driver.update(controller, 1 / 60);

    expect(driver.getAction('idle')!.getEffectiveWeight()).toBeCloseTo(0.5, 5);
    expect(driver.getAction('walk')!.getEffectiveWeight()).toBeCloseTo(0.5, 5);
    expect(driver.getAction('run')!.getEffectiveWeight()).toBeCloseTo(0, 5);

    controller.setParam('speed', 1);
    controller.update(1 / 60);
    driver.update(controller, 1 / 60);
    expect(driver.getAction('run')!.getEffectiveWeight()).toBeCloseTo(1, 5);

    driver.dispose();
  });

  it('bakes additive clips and runs them in additive blend mode', () => {
    const root = new THREE.Object3D();
    const a: AnimGraphAsset = {
      ...asset(),
      clips: [...asset().clips, { name: 'lean_r', additive: true }],
      params: [{ name: 'speed', type: 'float', default: 0 }, { name: 'lean', type: 'float', default: 0 }],
      layers: [{ id: 'lean', source: { kind: 'clip', clip: 'lean_r' }, weightParam: 'lean' }],
    };
    const clips = [clip('idle'), clip('walk'), clip('run'), clip('lean_r')];
    const controller = new AnimController(a);
    const driver = new MixerDriver(root, a, clips);

    expect(driver.getAction('lean_r')!.blendMode).toBe(THREE.AdditiveAnimationBlendMode);
    controller.setParam('lean', 0.7);
    controller.update(1 / 60);
    driver.update(controller, 1 / 60);
    expect(driver.getAction('lean_r')!.getEffectiveWeight()).toBeCloseTo(0.7, 5);
    driver.dispose();
  });

  it('records clips missing from the model in missingClips', () => {
    const root = new THREE.Object3D();
    const driver = new MixerDriver(root, asset(), [clip('idle'), clip('walk')]); // 'run' absent
    expect(driver.missingClips).toContain('run');
    expect(driver.getAction('run')).toBeUndefined();
    driver.dispose();
  });
});
