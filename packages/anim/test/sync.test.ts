import { describe, it, expect } from 'vitest';
import { syncedTime, pickLeader, resolveSync, type SyncMember } from '../src/primitives/sync';

describe('sync groups', () => {
  it('places a follower at the leader phase', () => {
    // leader half-way through a 1s clip → follower half-way through its 2s clip
    expect(syncedTime(0.5, 1, 2)).toBeCloseTo(1, 6);
    expect(syncedTime(0.25, 1, 4)).toBeCloseTo(1, 6);
  });

  it('picks the highest-weight eligible leader, respecting roles', () => {
    const members: SyncMember[] = [
      { id: 'walk', weight: 0.3, duration: 1 },
      { id: 'run', weight: 0.7, duration: 0.8 },
      { id: 'idle', weight: 0.9, duration: 2, role: 'follower' },
    ];
    expect(pickLeader(members)?.id).toBe('run'); // idle has higher weight but is follower-only
    expect(pickLeader([...members, { id: 'fixed', weight: 0, duration: 1, role: 'alwaysLeader' }])?.id).toBe('fixed');
  });

  it('resolveSync phase-matches every member to the leader', () => {
    const members: SyncMember[] = [
      { id: 'run', weight: 0.7, duration: 1 },
      { id: 'walk', weight: 0.3, duration: 2 },
    ];
    const times = resolveSync(members, 0.5); // leader=run @0.5 (phase 0.5)
    expect(times.run).toBeCloseTo(0.5, 6);
    expect(times.walk).toBeCloseTo(1.0, 6); // 0.5 phase of a 2s clip
  });
});
