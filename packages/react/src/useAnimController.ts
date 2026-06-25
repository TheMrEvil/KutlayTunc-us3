// Create (and memoize) an AnimController for an asset, without binding it to a
// model. Useful for editor previews or when you drive the mixer yourself.
import { useMemo } from 'react';
import { AnimController } from '@kutlaytunc/us3-anim';
import type { AnimGraphAsset } from '@kutlaytunc/us3-anim';

export function useAnimController(asset: AnimGraphAsset): AnimController {
  return useMemo(() => new AnimController(asset), [asset]);
}
