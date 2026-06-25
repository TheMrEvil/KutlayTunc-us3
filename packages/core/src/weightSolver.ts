// The swap-seam for the animation graph's blend layer.
//
// A WeightSolver maps a coordinate in parameter space to per-sample blend weights
// (summing to 1). `@kutlaytunc/us3-anim`'s `BlendSpace` is the built-in implementation. The
// `AnimController` depends only on this interface, so a different blend backend —
// e.g. a future drei-native blend space, if the ecosystem ships one — can be dropped
// in via the controller's `solverFactory` without touching the graph/state-machine.

import type { WeightList } from './math/bracket';

export interface WeightSolver {
  /** Per-sample weights (index-based, summing to 1) for a parameter coordinate. */
  weightsAt(coords: ReadonlyArray<number>): WeightList;
}
