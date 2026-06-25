// Runtime wrapper around a `BlendSpaceDef`. Resolves a parameter coordinate to
// per-sample weights — 1D via bracketing, 2D via Delaunay barycentric weighting.
// Pure: no three, no DOM. The editor and the runtime share this exact code.

import type { BlendSpaceDef } from '../asset/types';
import type { WeightList, WeightSolver } from '@kutlaytunc/us3-core';
import { bracketWeights, BlendTriangulation, clamp } from '@kutlaytunc/us3-core';
import type { ClipWeights } from '../controller/weights';
import { addClipWeight } from '../controller/weights';

/** The built-in {@link WeightSolver}: 1D bracketing / 2D Delaunay barycentric. A drei-native
 *  blend space (if the ecosystem ever ships one) can implement WeightSolver and replace this. */
export class BlendSpace implements WeightSolver {
  readonly def: BlendSpaceDef;
  /** sample index → clip name */
  private readonly clipOf: string[];
  private readonly tri: BlendTriangulation | null = null;
  private readonly positions1d: number[] | null = null;

  constructor(def: BlendSpaceDef) {
    this.def = def;
    this.clipOf = def.samples.map((s) => s.clip);
    if (def.dimensions === 2) {
      this.tri = new BlendTriangulation(def.samples.map((s) => [s.position[0] ?? 0, s.position[1] ?? 0]));
    } else {
      this.positions1d = def.samples.map((s) => s.position[0] ?? 0);
    }
  }

  /** Clamp a query coordinate to the axis ranges. */
  private clampCoords(coords: ReadonlyArray<number>): number[] {
    return this.def.axes.map((ax, i) => clamp(coords[i] ?? 0, ax.min, ax.max));
  }

  /** Per-sample weights (index-based) for a coordinate — for editor display. */
  weightsAt(coords: ReadonlyArray<number>): WeightList {
    const c = this.clampCoords(coords);
    if (this.def.dimensions === 2 && this.tri) return this.tri.weightsAt(c[0], c[1] ?? 0);
    return bracketWeights(this.positions1d ?? [], c[0]);
  }

  /** Accumulate this blend space's clip weights (scaled) into `out` — for the runtime. */
  accumulate(coords: ReadonlyArray<number>, out: ClipWeights, scale = 1): void {
    for (const { index, weight } of this.weightsAt(coords)) {
      addClipWeight(out, this.clipOf[index], weight * scale);
    }
  }

  /** The geometry needed by the editor to draw the grid (2D only). */
  get triangulation(): BlendTriangulation | null {
    return this.tri;
  }
}
