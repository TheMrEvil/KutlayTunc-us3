import { describe, it, expect } from 'vitest';
import { validateAsset, createEmptyAsset } from '../src/asset/factory';
import type { AnimGraphAsset } from '../src/asset/types';

const base = (): AnimGraphAsset => ({
  version: 1,
  name: 't',
  params: [],
  clips: [{ name: 'a' }],
  blendSpaces: [],
  stateMachine: { id: 'sm', entry: 'i', states: [{ id: 'i', source: { kind: 'clip', clip: 'a' } }], transitions: [] },
  layers: [],
});

describe('validateAsset', () => {
  it('passes a clean (empty) asset', () => {
    expect(validateAsset(createEmptyAsset())).toHaveLength(0);
  });

  it('flags duplicate clip names', () => {
    const a = base();
    a.clips = [{ name: 'a' }, { name: 'a' }];
    expect(validateAsset(a).some((x) => x.level === 'error' && /Duplicate clip name "a"/.test(x.message))).toBe(true);
  });

  it('warns on a state unreachable from the entry', () => {
    const a = base();
    a.stateMachine.states.push({ id: 'orphan', source: { kind: 'clip', clip: 'a' } });
    expect(validateAsset(a).some((x) => x.level === 'warning' && /unreachable/.test(x.message))).toBe(true);
  });

  it('warns on a collinear 2D blend space and errors on non-finite sample positions', () => {
    const a = base();
    a.params = [{ name: 'x', type: 'float', default: 0 }, { name: 'y', type: 'float', default: 0 }];
    a.blendSpaces = [{
      id: 'bs', dimensions: 2,
      axes: [{ name: 'x', min: -1, max: 1 }, { name: 'y', min: -1, max: 1 }],
      samples: [
        { id: 's0', clip: 'a', position: [0, 0] },
        { id: 's1', clip: 'a', position: [0.5, 0] },
        { id: 's2', clip: 'a', position: [1, 0] }, // all on y=0 → degenerate triangulation
      ],
    }];
    expect(validateAsset(a).some((x) => x.level === 'warning' && /collinear/.test(x.message))).toBe(true);

    a.blendSpaces[0].samples[0].position = [NaN, 0];
    expect(validateAsset(a).some((x) => x.level === 'error' && /non-finite/.test(x.message))).toBe(true);
  });
});
