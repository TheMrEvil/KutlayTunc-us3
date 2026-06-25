import { describe, it, expect } from 'vitest';
import { MontagePlayer, type MontageData } from '../src/primitives/montage';

const looping: MontageData = {
  clip: 'Attack',
  sections: [
    { name: 'intro', start: 0, end: 0.5, next: 'loop' },
    { name: 'loop', start: 0.5, end: 1.0, next: 'loop' },
  ],
};

describe('MontagePlayer', () => {
  it('plays the first section and advances', () => {
    const m = new MontagePlayer(looping);
    m.play();
    expect(m.section).toBe('intro');
    expect(m.isPlaying).toBe(true);
    m.update(0.2);
    expect(m.section).toBe('intro');
    expect(m.time).toBeCloseTo(0.2);
  });

  it('follows section flow (intro → loop) and loops', () => {
    const m = new MontagePlayer(looping);
    const seen: string[] = [];
    m.play();
    m.update(0.6, (s) => seen.push(s)); // crosses intro.end → loop
    expect(m.section).toBe('loop');
    expect(m.time).toBeCloseTo(0.6); // 0.5 + 0.1 overflow
    m.update(0.5, (s) => seen.push(s)); // crosses loop.end → loop again
    expect(m.section).toBe('loop');
    expect(seen).toEqual(['loop', 'loop']);
  });

  it('stops on a section with next:null', () => {
    const m = new MontagePlayer({ sections: [{ name: 'once', start: 0, end: 0.3, next: null }] });
    m.play();
    m.update(0.4);
    expect(m.isPlaying).toBe(false);
    expect(m.section).toBeNull();
  });

  it('jumpToSection switches immediately', () => {
    const m = new MontagePlayer(looping);
    m.play();
    m.jumpToSection('loop');
    expect(m.section).toBe('loop');
    expect(m.time).toBeCloseTo(0.5);
  });

  it('respects playRate', () => {
    const m = new MontagePlayer({ ...looping, playRate: 2 });
    m.play();
    m.update(0.1);
    expect(m.time).toBeCloseTo(0.2);
  });
});
