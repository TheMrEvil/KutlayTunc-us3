// Sequence — a clean web/TS take on Unreal Sequencer / Unity Timeline. Keyframe
// float tracks (target.channel → value) sampled over time with play/loop/seek.
// Headless: it returns values; the app writes them (camera moves, cutscenes,
// property animation). Combine with the spline for camera rails.

import { sampleCurve, type CurveKey } from './animCurves';

export interface SequenceTrack {
  /** named object/group the channel belongs to, e.g. 'Camera'. */
  target: string;
  /** the property, e.g. 'position.x', 'opacity', 'fov'. */
  channel: string;
  keys: CurveKey[];
}

export interface SequenceData {
  version?: 1;
  duration: number;
  loop?: boolean;
  tracks: SequenceTrack[];
}

const clamp = (n: number, lo: number, hi: number) => (n < lo ? lo : n > hi ? hi : n);

export class Sequence {
  time = 0;
  private playing = false;
  constructor(public data: SequenceData) {}

  get isPlaying(): boolean { return this.playing; }
  get duration(): number { return this.data.duration; }

  play(): void { this.playing = true; }
  pause(): void { this.playing = false; }
  stop(): void { this.playing = false; this.time = 0; }
  seek(t: number): void { this.time = clamp(t, 0, this.data.duration); }

  /** Advance playback (loops or stops at the end). */
  update(dt: number): void {
    if (!this.playing) return;
    const D = this.data.duration;
    this.time += dt;
    if (this.time >= D) {
      if (this.data.loop && D > 0) this.time %= D;
      else { this.time = D; this.playing = false; }
    }
  }

  /** Sample all tracks at `at` (defaults to the current time): target → channel → value. */
  sample(at: number = this.time): Record<string, Record<string, number>> {
    const out: Record<string, Record<string, number>> = {};
    for (const tr of this.data.tracks) {
      (out[tr.target] ??= {})[tr.channel] = sampleCurve({ name: tr.channel, keys: tr.keys }, at);
    }
    return out;
  }
}
