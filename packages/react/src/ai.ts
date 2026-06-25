// React Three Fiber bindings for the us3 AI + animation runtimes. Thin hooks that own
// the runtime instance and tick it in useFrame, so any R3F project can drop in a
// behaviour tree, perception, navigation, EQS, montage, look-at or a sequence with one hook.

import { useMemo, useRef, useState, useCallback, useEffect, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, type Object3D } from 'three';
import {
  BehaviorTreeRunner, PerceptionSystem, NavGrid, PathFollower, runQuery,
  type Board, type BehaviorTreeData, type BTContext, type RaycastFn,
  type NavGridData, type NavProvider, type NavPoint, type EnvQueryData, type EqsCtx, type QueryItem,
} from '@kutlaytunc/us3-ai';
import {
  MontagePlayer, Sequence, LookAtSolver,
  type MontageData, type SequenceData, type AimLimits,
} from '@kutlaytunc/us3-anim';
import type { Vec3 } from '@kutlaytunc/us3-core';

/** Run a behaviour tree, ticking it every frame. The tree's shared memory is a plain
 *  object (`runner.board`) — perception/your code writes to it, tasks read it. */
export function useBehaviorTree(
  tree: BehaviorTreeData,
  opts?: { board?: Board; tasks?: BTContext['tasks']; decorators?: BTContext['decorators']; services?: BTContext['services']; enabled?: boolean },
): { runner: BehaviorTreeRunner } {
  const board = opts?.board;
  // Keep ONE ctx object the runner reads from; refresh closures every render so fresh
  // tasks/decorators/services are picked up live (the runner only rebuilds on a new tree/board).
  const ctxRef = useRef<BTContext>({ board, tasks: opts?.tasks, decorators: opts?.decorators, services: opts?.services });
  ctxRef.current.board = board;
  ctxRef.current.tasks = opts?.tasks;
  ctxRef.current.decorators = opts?.decorators;
  ctxRef.current.services = opts?.services;
  const runner = useMemo(() => new BehaviorTreeRunner(tree, ctxRef.current), [tree, board]);
  useFrame((_, dt) => { if (opts?.enabled !== false) runner.tick(dt); });
  return { runner };
}

/** A PerceptionSystem ticked every frame. Register sources/listeners in effects. */
export function usePerceptionSystem(opts?: { raycast?: RaycastFn; enabled?: boolean }): PerceptionSystem {
  const system = useMemo(() => new PerceptionSystem({ raycast: opts?.raycast }), [opts?.raycast]);
  useFrame((_, dt) => { if (opts?.enabled !== false) system.tick(dt); });
  return system;
}

/** A baked navigation grid memoized per data object (the dependency-free NavProvider fallback). */
export function useNavMesh(data: NavGridData): NavGrid {
  return useMemo(() => new NavGrid(data), [data]);
}

/** Steer an Object3D along nav paths over any NavProvider. Call `moveTo([x, z])`; the
 *  agent follows each frame (XZ position + facing). */
export function useNavAgent(nav: NavProvider | null, ref: RefObject<Object3D | null>, opts?: { speed?: number }) {
  const speed = opts?.speed ?? 3;
  const follower = useMemo(() => new PathFollower(), []);
  const moveTo = useCallback((target: NavPoint) => {
    const o = ref.current;
    if (!nav || !o) return false;
    const path = nav.findPath([o.position.x, o.position.z], target);
    follower.setPath(path);
    return path.length > 0;
  }, [nav, ref, follower]);
  useFrame((_, dt) => {
    const o = ref.current;
    if (!o || follower.done) return;
    const pos = { x: o.position.x, z: o.position.z };
    const h = follower.step(pos, speed, dt);
    o.position.x = pos.x;
    o.position.z = pos.z;
    if (h != null) o.rotation.y = h;
  });
  return { moveTo, follower };
}

/** Aim an Object3D's forward at a moving target each frame — clamped + eased (head/turret
 *  look-at). `getTarget` returns a world point or null (eases back to rest). By default sets
 *  the object's `YXZ` euler in the +Z-forward convention; pass `apply` for full control (e.g.
 *  layering onto an animated head bone). Returns the underlying solver. */
export function useLookAt(
  ref: RefObject<Object3D | null>,
  getTarget: () => Vec3 | null,
  opts?: { limits?: AimLimits; speed?: number; apply?: (angles: { yaw: number; pitch: number }, o: Object3D) => void },
): LookAtSolver {
  const solver = useMemo(() => new LookAtSolver(opts?.limits, opts?.speed), []);
  useEffect(() => { if (opts?.limits) solver.setLimits(opts.limits); }, [opts?.limits, solver]);
  useEffect(() => { if (opts?.speed != null) solver.setSpeed(opts.speed); }, [opts?.speed, solver]);
  const tmp = useRef(new Vector3());
  useFrame((_, dt) => {
    const o = ref.current;
    if (!o) return;
    o.getWorldPosition(tmp.current);
    const origin: Vec3 = [tmp.current.x, tmp.current.y, tmp.current.z];
    const angles = solver.update(origin, getTarget(), dt);
    if (opts?.apply) opts.apply(angles, o);
    else o.rotation.set(angles.pitch, angles.yaw, 0, 'YXZ');
  });
  return solver;
}

/** Play a keyframe Sequence, applying sampled `target.channel → value` each frame. */
export function useSequence(data: SequenceData, apply: (values: Record<string, Record<string, number>>) => void, opts?: { autoplay?: boolean }): Sequence {
  const seq = useMemo(() => new Sequence(data), [data]);
  useEffect(() => { if (opts?.autoplay !== false) seq.play(); }, [seq, opts?.autoplay]);
  useFrame((_, dt) => { seq.update(dt); apply(seq.sample()); });
  return seq;
}

/** Drive an animation montage, ticking it each frame. Call `player.play(section?)`;
 *  `section` is the live active section name. */
export function useMontage(data: MontageData, opts?: { onSection?: (name: string) => void; enabled?: boolean }): { player: MontagePlayer; section: string | null } {
  const player = useMemo(() => new MontagePlayer(data), [data]);
  const [section, setSection] = useState<string | null>(null);
  useFrame((_, dt) => {
    if (opts?.enabled === false) return;
    player.update(dt, (n) => { setSection(n); opts?.onSection?.(n); });
  });
  return { player, section };
}

/** Pull-based EQS: call `run()` (e.g. on an interval or from a BT task). */
export function useEnvQuery(data: EnvQueryData, makeCtx: () => EqsCtx): { run: () => QueryItem[]; items: QueryItem[]; best: QueryItem | null } {
  const [items, setItems] = useState<QueryItem[]>([]);
  const ctxRef = useRef(makeCtx);
  ctxRef.current = makeCtx;
  // Read `data` via a ref so a fresh query object each render doesn't churn `run`'s identity.
  const dataRef = useRef(data);
  dataRef.current = data;
  const run = useCallback(() => {
    const r = runQuery(dataRef.current, ctxRef.current());
    setItems(r);
    return r;
  }, []);
  return { run, items, best: items[0] ?? null };
}
