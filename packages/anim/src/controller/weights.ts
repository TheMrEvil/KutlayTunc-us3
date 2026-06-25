// Clip-keyed weight maps — the currency the controller emits and the driver
// consumes. Kept tiny and allocation-light (mutate-in-place).

/** Clip name → weight. */
export type ClipWeights = Map<string, number>;

const EPS = 1e-6;

/** Add `w` to a clip's accumulated weight (ignores empty names and non-positive weights). */
export function addClipWeight(out: ClipWeights, clip: string, w: number): void {
  if (!clip || w <= EPS) return;
  out.set(clip, (out.get(clip) ?? 0) + w);
}

/** Scale every weight so the map sums to 1. No-op for an empty/zero map. */
export function normalizeClipWeights(out: ClipWeights): void {
  let sum = 0;
  for (const w of out.values()) sum += w;
  if (sum < EPS) return;
  for (const [clip, w] of out) out.set(clip, w / sum);
}
