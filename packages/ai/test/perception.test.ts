import { describe, it, expect } from 'vitest';
import { PerceptionSystem, type Pose } from '../src/perception';

const facingX: Pose = { position: [0, 0, 0], forward: [1, 0, 0] };

describe('PerceptionSystem', () => {
  it('sees a source in range, in cone, with line of sight', () => {
    const sys = new PerceptionSystem();
    sys.registerListener('L', { sight: { enabled: true, radius: 10, peripheralHalfAngleDeg: 90 } }, () => facingX);
    sys.registerSource('S', ['sight'], () => [5, 0, 0]);
    sys.tick(0.1);
    const seen = sys.getPerceived('L', 'sight');
    expect(seen).toHaveLength(1);
    expect(seen[0].sensed).toBe(true);
    expect(seen[0].strength).toBeCloseTo(0.5, 1);
  });

  it('does not see a source behind it (outside cone)', () => {
    const sys = new PerceptionSystem();
    sys.registerListener('L', { sight: { enabled: true, radius: 10, peripheralHalfAngleDeg: 90 } }, () => facingX);
    sys.registerSource('S', ['sight'], () => [-5, 0, 0]);
    sys.tick(0.1);
    expect(sys.getPerceived('L', 'sight')).toHaveLength(0);
  });

  it('does not see an occluded source (raycast blocked)', () => {
    const sys = new PerceptionSystem({ raycast: () => true });
    sys.registerListener('L', { sight: { enabled: true, radius: 10 } }, () => facingX);
    sys.registerSource('S', ['sight'], () => [5, 0, 0]);
    sys.tick(0.1);
    expect(sys.getPerceived('L', 'sight')).toHaveLength(0);
  });

  it('hears a reported noise within range', () => {
    const sys = new PerceptionSystem();
    sys.registerListener('L', { hearing: { enabled: true, range: 8 } }, () => facingX);
    sys.reportNoise({ location: [3, 0, 0], loudness: 1, sourceId: 'gun' });
    const heard = sys.getPerceived('L', 'hearing');
    expect(heard).toHaveLength(1);
    expect(heard[0].sourceId).toBe('gun');
    // out of range
    sys.reportNoise({ location: [50, 0, 0], sourceId: 'far' });
    expect(sys.getPerceived('L', 'hearing')).toHaveLength(1);
  });

  it('forgets a stimulus after maxAge once it is no longer sensed', () => {
    const sys = new PerceptionSystem();
    let pos: [number, number, number] = [5, 0, 0];
    sys.registerListener('L', { sight: { enabled: true, radius: 10 }, maxAge: 0.5 }, () => facingX);
    sys.registerSource('S', ['sight'], () => pos);
    sys.tick(0.1);
    expect(sys.getPerceived('L', 'sight')[0].sensed).toBe(true);
    pos = [100, 0, 0]; // walked away — out of range
    sys.tick(0.1);
    expect(sys.getPerceived('L', 'sight')[0].sensed).toBe(false); // lost but remembered
    sys.tick(0.6); // age exceeds maxAge
    expect(sys.getPerceived('L', 'sight')).toHaveLength(0); // forgotten
  });
});
