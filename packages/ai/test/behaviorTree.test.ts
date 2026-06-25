import { describe, it, expect } from 'vitest';
import { BehaviorTreeRunner, type BehaviorTreeData } from '../src/behaviorTree';

function tree(): BehaviorTreeData {
  return {
    root: {
      id: 'root', kind: 'selector', children: [
        {
          id: 'chase', kind: 'sequence',
          decorators: [{ id: 'd1', type: 'blackboard', params: { key: 'enemy', op: 'isSet' } }],
          children: [{ id: 'set-chase', kind: 'task', task: 'setKey', params: { key: 'state', value: 'chase' } }],
        },
        { id: 'patrol', kind: 'task', task: 'setKey', params: { key: 'state', value: 'patrol' } },
      ],
    },
  };
}

describe('BehaviorTreeRunner', () => {
  it('selector falls through a failed gate to the next branch', () => {
    const board: Record<string, unknown> = {};
    const r = new BehaviorTreeRunner(tree(), { board });
    r.tick(0.016);
    expect(board.state).toBe('patrol'); // gate (enemy isSet) fails → patrol
  });

  it('reactively switches branch when a higher-priority gate becomes true', () => {
    const board: Record<string, unknown> = {};
    const r = new BehaviorTreeRunner(tree(), { board });
    r.tick(0.016);
    expect(board.state).toBe('patrol');
    board.enemy = { id: 1 };
    r.tick(0.016);
    expect(board.state).toBe('chase'); // higher-priority branch now passes
  });

  it('wait task runs across frames then succeeds', () => {
    const board: Record<string, unknown> = {};
    const data: BehaviorTreeData = {
      root: { id: 'r', kind: 'sequence', children: [
        { id: 'w', kind: 'task', task: 'wait', params: { duration: 0.2 } },
        { id: 'fin', kind: 'task', task: 'setKey', params: { key: 'done', value: true } },
      ] },
    };
    const r = new BehaviorTreeRunner(data, { board });
    expect(r.tick(0.1)).toBe('running');
    expect(board.done).toBeUndefined();
    expect(r.tick(0.1)).toBe('success');
    expect(board.done).toBe(true);
    expect(r.activeNodes()).toEqual([]); // nothing running after success
  });

  it('custom task + inverter modifier', () => {
    const data: BehaviorTreeData = {
      root: { id: 'r', kind: 'task', task: 'always', decorators: [{ id: 'inv', type: 'inverter' }] },
    };
    const r = new BehaviorTreeRunner(data, { tasks: { always: () => 'success' } });
    expect(r.tick(0.016)).toBe('failure'); // inverter flips success→failure
  });

  it('exposes the board it was given (plain-object shared memory)', () => {
    const board: Record<string, unknown> = {};
    const r = new BehaviorTreeRunner(tree(), { board });
    expect(r.board).toBe(board);
  });

  it('treats a null value as unset (Unreal IsValueSet-style: null clears a key)', () => {
    const board: Record<string, unknown> = { enemy: null };
    const r = new BehaviorTreeRunner(tree(), { board });
    r.tick(0.016);
    expect(board.state).toBe('patrol'); // enemy === null → `isSet` gate fails → fall through
    board.enemy = { id: 1 };
    r.tick(0.016);
    expect(board.state).toBe('chase'); // a real value now passes the gate
  });
});
