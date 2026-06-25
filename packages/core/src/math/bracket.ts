// 1D bracketing weights, shared by Blend Space 1D and the collinear fallback of
// the 2D triangulation. Pure — operates on sample indices, not clips.

/** A single sample's contribution: `weight` is in `[0, 1]`. */
export interface WeightEntry {
  /** Index into the sample array this weight refers to. */
  index: number;
  weight: number;
}

/** A sparse list of sample weights. The non-zero weights sum to 1. */
export type WeightList = WeightEntry[];

const EPS = 1e-6;

/**
 * Blend across scalar sample positions. Returns the (1 or 2) samples that
 * bracket `query` with their interpolation weights. Queries outside the range
 * clamp to the nearest end sample (Unreal's blendspace edge behaviour).
 */
export function bracketWeights(positions: ReadonlyArray<number>, query: number): WeightList {
  const n = positions.length;
  if (n === 0) return [];
  if (n === 1) return [{ index: 0, weight: 1 }];

  // Order sample indices left-to-right by position (samples may be unsorted).
  const order = positions.map((_, i) => i).sort((a, b) => positions[a] - positions[b]);
  const first = order[0];
  const last = order[n - 1];

  if (query <= positions[first]) return [{ index: first, weight: 1 }];
  if (query >= positions[last]) return [{ index: last, weight: 1 }];

  for (let k = 0; k < n - 1; k++) {
    const lo = order[k];
    const hi = order[k + 1];
    const plo = positions[lo];
    const phi = positions[hi];
    if (query >= plo && query <= phi) {
      if (phi - plo < EPS) return [{ index: lo, weight: 1 }];
      const t = (query - plo) / (phi - plo);
      const out: WeightList = [];
      if (1 - t > EPS) out.push({ index: lo, weight: 1 - t });
      if (t > EPS) out.push({ index: hi, weight: t });
      return out;
    }
  }
  return [{ index: last, weight: 1 }];
}
