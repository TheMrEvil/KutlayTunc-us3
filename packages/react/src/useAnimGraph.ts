// Low-level hook: bind an AnimController + MixerDriver to a loaded model and tick
// them every frame. The model/clips come from the caller (e.g. useGLTF). Per-frame
// state lives on the controller/driver (refs), never in React state.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { AnimController, MixerDriver } from '@kutlaytunc/us3-anim';
import type { AnimGraphAsset } from '@kutlaytunc/us3-anim';

export interface UseAnimGraphOptions {
  /** Freeze evaluation (e.g. while the editor is paused). */
  paused?: boolean;
  /** Set parameters here right before each `controller.update`. */
  onFrame?: (controller: AnimController, dt: number) => void;
  /** R3F `useFrame` render priority. */
  priority?: number;
}

export interface AnimGraphHandle {
  controller: AnimController;
  driver: MixerDriver | null;
}

export function useAnimGraph(
  root: THREE.Object3D | null | undefined,
  asset: AnimGraphAsset,
  clips: ReadonlyArray<THREE.AnimationClip>,
  options: UseAnimGraphOptions = {},
): AnimGraphHandle {
  const controller = useMemo(() => new AnimController(asset), [asset]);

  // The driver owns a real resource (mixer + bound actions). It must live in an
  // effect, not useMemo: under React StrictMode the dev remount runs the cleanup
  // (dispose) but reuses the memoized instance, leaving a dead, action-less mixer.
  const [driver, setDriver] = useState<MixerDriver | null>(null);
  useEffect(() => {
    if (!root) {
      setDriver(null);
      return;
    }
    const d = new MixerDriver(root, asset, clips);
    setDriver(d);
    return () => d.dispose();
  }, [root, asset, clips]);

  const optsRef = useRef(options);
  optsRef.current = options;

  useFrame((_, dt) => {
    const o = optsRef.current;
    if (o.paused || !driver) return;
    o.onFrame?.(controller, dt);
    controller.update(dt);
    driver.update(controller, dt);
  }, options.priority);

  return { controller, driver };
}
