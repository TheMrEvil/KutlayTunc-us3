// Batteries-included character: loads a rigged glTF, clones it (skeleton-safe),
// and drives an us3 AnimController over its clips. Pass `params` to steer
// the blendspaces / state machine; pass `paused` to freeze it in an editor.

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import type { ThreeElements } from '@react-three/fiber';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { AnimController } from '@kutlaytunc/us3-anim';
import type { AnimGraphAsset, ParamBag } from '@kutlaytunc/us3-anim';
import { useAnimGraph } from './useAnimGraph';

type GroupProps = ThreeElements['group'];

export interface AnimatedCharacterProps extends Omit<GroupProps, 'ref'> {
  /** URL of a rigged glTF/GLB whose `animations` back the asset's clips. */
  url: string;
  /** The animation graph asset driving the character. */
  asset: AnimGraphAsset;
  /** Controlled parameter values, applied every frame. */
  params?: ParamBag;
  /** Freeze the controller + mixer (editor preview). */
  paused?: boolean;
  /** Called once the controller exists. */
  onReady?: (controller: AnimController) => void;
}

/** Imperative handle: the live AnimController. */
export interface AnimatedCharacterHandle {
  controller: AnimController;
}

export const AnimatedCharacter = forwardRef<AnimatedCharacterHandle, AnimatedCharacterProps>(
  function AnimatedCharacter({ url, asset, params, paused, onReady, children, ...groupProps }, ref) {
    const { scene, animations } = useGLTF(url);
    const model = useMemo(() => cloneSkeleton(scene), [scene]);

    const { controller } = useAnimGraph(model, asset, animations, {
      paused,
      onFrame: (c) => {
        if (!params) return;
        for (const key in params) c.setParam(key, params[key]);
      },
    });

    // Fire onReady once per controller (read the latest callback via a ref), not on
    // every parent re-render — an inline `onReady={...}` must not re-trigger it.
    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;
    useEffect(() => {
      onReadyRef.current?.(controller);
    }, [controller]);
    useImperativeHandle(ref, () => ({ controller }), [controller]);

    return (
      <group {...groupProps}>
        <primitive object={model} />
        {children}
      </group>
    );
  },
);

/** Preload a character glTF so it's ready before mount. */
AnimatedCharacter.displayName = 'AnimatedCharacter';
export const preloadCharacter = (url: string): void => useGLTF.preload(url);
