import { describe, it, expect } from 'vitest';
import { AnimController } from '../src/controller/controller';
import { validateAsset } from '../src/asset/factory';
import type { AnimGraphAsset } from '../src/asset/types';

function locomotionAsset(): AnimGraphAsset {
  return {
    version: 1,
    name: 'Locomotion',
    params: [
      { name: 'speed', type: 'float', default: 0, smoothing: 0 },
      { name: 'lean', type: 'float', default: 0, smoothing: 0 },
    ],
    clips: [
      { name: 'idle' },
      { name: 'walk' },
      { name: 'run' },
      { name: 'lean_r', additive: true },
    ],
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
    stateMachine: {
      id: 'sm',
      entry: 'move',
      states: [{ id: 'move', source: { kind: 'blendspace', ref: 'loco' } }],
      transitions: [],
    },
    layers: [{ id: 'leanLayer', source: { kind: 'clip', clip: 'lean_r' }, weightParam: 'lean' }],
  };
}

describe('AnimController', () => {
  it('validates the locomotion asset cleanly', () => {
    expect(validateAsset(locomotionAsset()).filter((i) => i.level === 'error')).toEqual([]);
  });

  it('blends the 1D locomotion blendspace from the speed param', () => {
    const c = new AnimController(locomotionAsset());
    c.setParam('speed', 0.25);
    c.update(1 / 60);
    expect(c.baseWeights.get('idle')).toBeCloseTo(0.5, 5);
    expect(c.baseWeights.get('walk')).toBeCloseTo(0.5, 5);
    expect(c.baseWeights.get('run') ?? 0).toBe(0);
    let total = 0;
    for (const w of c.baseWeights.values()) total += w;
    expect(total).toBeCloseTo(1, 5);
  });

  it('drives an additive layer from a param', () => {
    const c = new AnimController(locomotionAsset());
    c.setParam('lean', 0.5);
    c.update(1 / 60);
    expect(c.additiveWeights.get('lean_r')).toBeCloseTo(0.5, 5);
    // additive weights live outside the normalized base layer
    expect(c.baseWeights.has('lean_r')).toBe(false);
  });

  it('smooths float params toward their target', () => {
    const asset = locomotionAsset();
    asset.params[0].smoothing = 8;
    const c = new AnimController(asset);
    c.setParam('speed', 1);
    c.update(1 / 60);
    expect(Number(c.getParam('speed'))).toBeGreaterThan(0);
    expect(Number(c.getParam('speed'))).toBeLessThan(1);
    for (let i = 0; i < 200; i++) c.update(1 / 60);
    expect(Number(c.getParam('speed'))).toBeCloseTo(1, 3);
  });

  it('runs a state-machine transition end to end', () => {
    const asset = locomotionAsset();
    asset.clips.push({ name: 'jump', loop: false });
    asset.params.push({ name: 'jumping', type: 'bool', default: false });
    asset.stateMachine.states.push({ id: 'jump', source: { kind: 'clip', clip: 'jump' } });
    asset.stateMachine.transitions.push(
      { id: 'toJump', from: 'move', to: 'jump', rule: { op: '==', param: 'jumping', value: true }, duration: 0.1 },
    );
    const c = new AnimController(asset);
    c.setParam('jumping', true);
    c.update(0); // start crossfade
    for (let i = 0; i < 10; i++) c.update(1 / 60);
    expect(c.activeStateId).toBe('jump');
    expect(c.baseWeights.get('jump')).toBeCloseTo(1, 3);
  });
});
