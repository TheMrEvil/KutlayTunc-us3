import type { AnimGraphAsset } from '@kutlaytunc/us3-anim';

// A 1D locomotion blend space over the Soldier model's Idle / Walk / Run clips,
// driven by a single `speed` parameter (smoothed). Wrapped in a one-state machine.
export const locomotionAsset: AnimGraphAsset = {
  version: 1,
  name: 'Soldier Locomotion',
  params: [{ name: 'speed', type: 'float', default: 0, smoothing: 6 }],
  clips: [{ name: 'Idle' }, { name: 'Walk' }, { name: 'Run' }],
  blendSpaces: [
    {
      id: 'loco',
      name: 'Locomotion',
      dimensions: 1,
      axes: [{ name: 'speed', min: 0, max: 1, divisions: 4 }],
      samples: [
        { id: 's_idle', clip: 'Idle', position: [0] },
        { id: 's_walk', clip: 'Walk', position: [0.5] },
        { id: 's_run', clip: 'Run', position: [1] },
      ],
    },
  ],
  stateMachine: {
    id: 'sm',
    entry: 'move',
    states: [{ id: 'move', name: 'Move', source: { kind: 'blendspace', ref: 'loco' } }],
    transitions: [],
  },
};
