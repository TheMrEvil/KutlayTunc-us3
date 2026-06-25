// Blend (easing) curves for transition crossfades.
import type { BlendCurve } from '../asset/types';
import { clamp } from '@kutlaytunc/us3-core';

/** Map a linear `t ∈ [0,1]` through the named easing curve. */
export function applyCurve(curve: BlendCurve, t: number): number {
  const x = clamp(t, 0, 1);
  switch (curve) {
    case 'linear':
      return x;
    case 'easeIn':
      return x * x;
    case 'easeOut':
      return 1 - (1 - x) * (1 - x);
    case 'easeInOut':
      return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    default: {
      const _never: never = curve;
      void _never;
      return x;
    }
  }
}
