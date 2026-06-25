import { describe, it, expect } from 'vitest';
import { evalRule } from '../src/statemachine/rules';
import { applyCurve } from '../src/statemachine/curves';
import { AnimStateMachine } from '../src/statemachine/statemachine';
import type { StateMachineDef } from '../src/asset/types';

describe('evalRule', () => {
  const p = { speed: 0.5, jumping: true, mood: 'happy' as const };
  it('compares numbers', () => {
    expect(evalRule({ op: '>', param: 'speed', value: 0.1 }, p)).toBe(true);
    expect(evalRule({ op: '<', param: 'speed', value: 0.1 }, p)).toBe(false);
  });
  it('compares equality on bool/string', () => {
    expect(evalRule({ op: '==', param: 'jumping', value: true }, p)).toBe(true);
    expect(evalRule({ op: '==', param: 'mood', value: 'happy' }, p)).toBe(true);
    expect(evalRule({ op: '!=', param: 'mood', value: 'sad' }, p)).toBe(true);
  });
  it('matches a numeric param against a numeric-string rule value', () => {
    expect(evalRule({ op: '==', param: 'speed', value: '0.5' }, p)).toBe(true);  // 0.5 (number) == "0.5"
    expect(evalRule({ op: '!=', param: 'speed', value: '0.5' }, p)).toBe(false);
  });
  it('uses an epsilon for float equality', () => {
    expect(evalRule({ op: '==', param: 'speed', value: 0.5 + 1e-9 }, p)).toBe(true);
  });
  it('combines with and/or/not', () => {
    expect(
      evalRule(
        { op: 'and', rules: [{ op: '>', param: 'speed', value: 0.1 }, { op: '==', param: 'jumping', value: true }] },
        p,
      ),
    ).toBe(true);
    expect(evalRule({ op: 'not', rule: { op: 'true' } }, p)).toBe(false);
  });
});

describe('applyCurve', () => {
  it('is clamped to [0,1] and monotone at the ends', () => {
    for (const c of ['linear', 'easeIn', 'easeOut', 'easeInOut'] as const) {
      expect(applyCurve(c, -1)).toBeCloseTo(0, 6);
      expect(applyCurve(c, 2)).toBeCloseTo(1, 6);
    }
  });
});

describe('AnimStateMachine', () => {
  const def: StateMachineDef = {
    id: 'sm',
    entry: 'idle',
    states: [
      { id: 'idle', source: { kind: 'clip', clip: 'idle' } },
      { id: 'run', source: { kind: 'clip', clip: 'run' } },
    ],
    transitions: [
      { id: 't1', from: 'idle', to: 'run', rule: { op: '>', param: 'speed', value: 0.1 }, duration: 0.2 },
      { id: 't2', from: 'run', to: 'idle', rule: { op: '<=', param: 'speed', value: 0.1 }, duration: 0.2 },
    ],
  };

  it('starts at the entry state', () => {
    const sm = new AnimStateMachine(def);
    const blend = sm.update(0, { speed: 0 });
    expect(blend).toEqual([{ stateId: 'idle', weight: 1 }]);
  });

  it('crossfades when a rule fires and lands on the target', () => {
    const sm = new AnimStateMachine(def);
    sm.update(0, { speed: 1 }); // starts the crossfade (t=0)
    const mid = sm.update(0.1, { speed: 1 });
    expect(mid).toHaveLength(2);
    const idleW = mid.find((b) => b.stateId === 'idle')!.weight;
    const runW = mid.find((b) => b.stateId === 'run')!.weight;
    expect(idleW + runW).toBeCloseTo(1, 6);
    expect(runW).toBeGreaterThan(0);
    // finish the crossfade
    sm.update(0.2, { speed: 1 });
    const done = sm.update(0, { speed: 1 });
    expect(done).toEqual([{ stateId: 'run', weight: 1 }]);
    expect(sm.activeStateId).toBe('run');
  });

  it('does not re-evaluate transitions mid-crossfade', () => {
    const sm = new AnimStateMachine(def);
    sm.update(0, { speed: 1 });
    // flip the param mid-blend; the machine should keep finishing the current blend
    const blend = sm.update(0.05, { speed: 0 });
    expect(blend).toHaveLength(2);
  });

  it('instant transition when duration is 0', () => {
    const instant: StateMachineDef = {
      ...def,
      transitions: [{ id: 't', from: 'idle', to: 'run', rule: { op: 'true' }, duration: 0 }],
    };
    const sm = new AnimStateMachine(instant);
    const blend = sm.update(0, { speed: 0 });
    expect(blend).toEqual([{ stateId: 'run', weight: 1 }]);
  });
});
