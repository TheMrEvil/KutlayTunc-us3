// Bridge between us3's AI/navmesh and pmndrs/ecctrl. Clean division of labour:
//   ecctrl = legs (locomotion + physics + animation), us3 = brain (perception/decisions/nav).
// A behaviour-tree task (or any code) calls `agent.moveTo([x, z])`; this hook paths via your
// NavProvider and feeds ecctrl's imperative `setMovement` each frame to walk the route, advancing
// waypoints on arrival. Built against ecctrl v2's EcctrlHandle (currPos + setMovement).
//
//   const ref = useRef<EcctrlHandle>(null)
//   const agent = useEcctrlNavAgent(ref, nav)        // nav: a NavProvider (e.g. RecastNavProvider)
//   // <Ecctrl ref={ref}> ... </Ecctrl>
//   // in a BT task: agent.moveTo(enemyXZ); return agent.moving ? 'running' : 'success'

import { useFrame } from '@react-three/fiber';
import { useCallback, useMemo, useRef, type RefObject } from 'react';
import type { EcctrlHandle, MovementInput } from 'ecctrl';
import type { NavProvider, NavPoint } from '@kutlaytunc/us3-core';

export interface EcctrlNavAgent {
  /** Path to a world-XZ target and start following it. Returns false if unreachable / not ready. */
  moveTo(target: NavPoint): boolean;
  /** Stop following and hand control back (clears movement). */
  stop(): void;
  /** True while a path is still being followed. */
  readonly moving: boolean;
}

export interface EcctrlNavAgentOptions {
  /** How close (world units) counts as reaching a waypoint. @default 0.4 */
  arriveRadius?: number;
  /** Use ecctrl's run speed while travelling. @default false */
  run?: boolean;
  /**
   * Map a desired world-XZ direction (unit vector) to ecctrl MovementInput. The default drives the
   * analog joystick in world space (`{ joystick: { x, y: z } }`). ecctrl interprets joystick input
   * relative to its follow-camera, so if your camera is rotated you may need to rotate this vector
   * (or switch to discrete forward/back/left/right) — override here once you've checked it live.
   */
  toInput?: (dir: { x: number; z: number }, run: boolean) => MovementInput;
}

const defaultToInput = (dir: { x: number; z: number }, run: boolean): MovementInput => ({
  joystick: { x: dir.x, y: dir.z },
  run,
});

export function useEcctrlNavAgent(
  ref: RefObject<EcctrlHandle | null>,
  nav: NavProvider | null,
  opts?: EcctrlNavAgentOptions,
): EcctrlNavAgent {
  const path = useRef<NavPoint[]>([]);
  const idx = useRef(0);
  const arrive = opts?.arriveRadius ?? 0.4;
  const run = opts?.run ?? false;
  const toInput = opts?.toInput ?? defaultToInput;

  const moveTo = useCallback((target: NavPoint): boolean => {
    const h = ref.current;
    if (!nav || !h) return false;
    const p = nav.findPath([h.currPos.x, h.currPos.z], target);
    path.current = p;
    idx.current = p.length > 1 ? 1 : 0; // skip the start node (it's where we already are)
    return p.length > 0;
  }, [nav, ref]);

  const stop = useCallback((): void => {
    path.current = [];
    idx.current = 0;
    ref.current?.setMovement({}); // release: no input → ecctrl decelerates/idles
  }, [ref]);

  const api = useMemo<EcctrlNavAgent>(() => ({
    moveTo,
    stop,
    get moving() { return idx.current < path.current.length; },
  }), [moveTo, stop]);

  useFrame(() => {
    const h = ref.current;
    const p = path.current;
    if (!h || idx.current >= p.length) return; // no active path → leave control to the caller
    const wp = p[idx.current];
    const dx = wp[0] - h.currPos.x;
    const dz = wp[1] - h.currPos.z;
    const d2 = dx * dx + dz * dz;
    if (d2 <= arrive * arrive) {
      idx.current++;
      if (idx.current >= p.length) { path.current = []; h.setMovement({}); } // arrived → stop
      return;
    }
    const len = Math.sqrt(d2) || 1;
    h.setMovement(toInput({ x: dx / len, z: dz / len }, run));
  });

  return api;
}
