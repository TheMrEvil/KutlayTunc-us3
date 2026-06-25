// Animation Montage — a clean web/TS take on Unreal montages: a clip split into
// named sections with flow (advance / jump / loop / stop). Headless: it tracks the
// active section + local time and emits section changes; the app drives the mixer.

export interface MontageSection {
  name: string;
  start: number;
  end: number;
  /** name = jump to it on end; null = stop; undefined = play the adjacent section. */
  next?: string | null;
}

export interface MontageData {
  version?: 1;
  clip?: string;
  playRate?: number;
  sections: MontageSection[];
}

export class MontagePlayer {
  time = 0;
  private playing = false;
  private sec: MontageSection | null = null;

  constructor(public data: MontageData) {}

  private find(name: string): MontageSection | null { return this.data.sections.find((s) => s.name === name) ?? null; }

  get section(): string | null { return this.sec?.name ?? null; }
  get isPlaying(): boolean { return this.playing; }
  get clip(): string | undefined { return this.data.clip; }

  /** Start the montage (at `sectionName`, or the first section). */
  play(sectionName?: string): void {
    this.sec = sectionName ? this.find(sectionName) : (this.data.sections[0] ?? null);
    this.time = this.sec?.start ?? 0;
    this.playing = !!this.sec;
  }
  stop(): void { this.playing = false; this.sec = null; }
  /** Jump to a section immediately (Unreal Montage_JumpToSection). */
  jumpToSection(name: string): void { const s = this.find(name); if (s) { this.sec = s; this.time = s.start; this.playing = true; } }

  /** Advance by dt, following section flow. Calls onSection when the section changes. */
  update(dt: number, onSection?: (name: string) => void): void {
    if (!this.playing || !this.sec) return;
    this.time += dt * (this.data.playRate ?? 1);
    let guard = 0;
    while (this.playing && this.sec && this.time >= this.sec.end && guard++ < 32) {
      const cur: MontageSection = this.sec;
      const over = this.time - cur.end;
      let target: MontageSection | null;
      if (cur.next === null) { this.stop(); return; }
      else if (cur.next === undefined) target = this.data.sections.find((s) => Math.abs(s.start - cur.end) < 1e-6) ?? null;
      else target = this.find(cur.next);
      if (!target) { this.stop(); return; }
      this.sec = target;
      this.time = target.start + over;
      onSection?.(target.name);
    }
  }
}
