import { describe, it, expect } from 'vitest';
import { Sequence, type SequenceData } from '../src/primitives/sequence';

const data: SequenceData = {
  duration: 2,
  tracks: [
    { target: 'Camera', channel: 'position.x', keys: [{ t: 0, v: 0 }, { t: 2, v: 10 }] },
    { target: 'Camera', channel: 'fov', keys: [{ t: 0, v: 60 }, { t: 1, v: 30 }, { t: 2, v: 60 }] },
  ],
};

describe('Sequence', () => {
  it('samples tracks (target → channel → value) with interpolation', () => {
    const s = new Sequence(data);
    const at1 = s.sample(1);
    expect(at1.Camera['position.x']).toBeCloseTo(5);
    expect(at1.Camera.fov).toBeCloseTo(30);
  });

  it('plays and stops at the end', () => {
    const s = new Sequence(data);
    s.play();
    s.update(1.5);
    expect(s.time).toBeCloseTo(1.5);
    expect(s.isPlaying).toBe(true);
    s.update(1);
    expect(s.time).toBe(2);
    expect(s.isPlaying).toBe(false); // reached the end (no loop)
  });

  it('loops when loop=true', () => {
    const s = new Sequence({ ...data, loop: true });
    s.play();
    s.update(2.5);
    expect(s.time).toBeCloseTo(0.5);
    expect(s.isPlaying).toBe(true);
  });

  it('seek clamps to [0, duration]', () => {
    const s = new Sequence(data);
    s.seek(99);
    expect(s.time).toBe(2);
    s.seek(-5);
    expect(s.time).toBe(0);
  });
});
