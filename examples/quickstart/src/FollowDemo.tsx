// THE us3 STORY IN ONE SCENE — an NPC that follows your cursor and animates itself.
// Move the mouse over the ground: that's "you". Perception writes your position to the
// board, the behaviour tree paths there over the navmesh (useNavAgent), and the
// animation graph blends idle→walk→run from the NPC's own measured speed. Swap NavGrid
// for @kutlaytunc/us3-nav-recast (real navmesh) or the body for @kutlaytunc/us3-ecctrl — the brain is unchanged.
import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Grid, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { AnimatedCharacter, preloadCharacter, useNavMesh, useNavAgent, useBehaviorTree } from '@kutlaytunc/us3-react';
import type { NavGridData, BehaviorTreeData, TaskImpl } from '@kutlaytunc/us3-ai';
import type { AnimGraphAsset, AnimController } from '@kutlaytunc/us3-anim';

const MODEL = '/models/Soldier.glb';
preloadCharacter(MODEL);

const NAV: NavGridData = { min: [-8, -8], max: [8, 8], cellSize: 0.5 };
const MAX_SPEED = 2.4;

// idle → walk → run over a single smoothed `speed` param (the animation graph).
const LOCO: AnimGraphAsset = {
  version: 1, name: 'Locomotion',
  params: [{ name: 'speed', type: 'float', default: 0, smoothing: 6 }],
  clips: [{ name: 'Idle' }, { name: 'Walk' }, { name: 'Run' }],
  blendSpaces: [{
    id: 'loco', name: 'Locomotion', dimensions: 1,
    axes: [{ name: 'speed', min: 0, max: 1, divisions: 4 }],
    samples: [
      { id: 's_idle', clip: 'Idle', position: [0] },
      { id: 's_walk', clip: 'Walk', position: [0.5] },
      { id: 's_run', clip: 'Run', position: [1] },
    ],
  }],
  stateMachine: { id: 'sm', entry: 'move', states: [{ id: 'move', name: 'Move', source: { kind: 'blendspace', ref: 'loco' } }], transitions: [] },
};

// One task: walk to wherever the board says "you" are.
const TREE: BehaviorTreeData = {
  version: 1,
  root: { id: 'root', kind: 'selector', children: [{ id: 'follow', kind: 'task', task: 'follow' }] },
};

function Npc({ target }: { target: { current: [number, number] } }) {
  const grid = useNavMesh(NAV);
  const groupRef = useRef<THREE.Group>(null);
  const ctrl = useRef<AnimController | null>(null);
  const { moveTo, follower } = useNavAgent(grid, groupRef, { speed: MAX_SPEED });
  const prevPos = useRef(new THREE.Vector3(-6, 0, -6));
  const lastTarget = useRef<[number, number]>([0, 0]);

  const tasks = useMemo<Record<string, TaskImpl>>(() => ({
    follow: (board) => {
      const p = board.targetXZ as [number, number] | undefined;
      if (!p) return 'failure';
      const g = groupRef.current;
      const targetMoved = Math.hypot(p[0] - lastTarget.current[0], p[1] - lastTarget.current[1]);
      const atTarget = g ? Math.hypot(p[0] - g.position.x, p[1] - g.position.z) < 0.5 : false;
      // Re-path when the target moves or our path ran out — but never while we're already standing on it
      // (otherwise an idle NPC re-runs A* every frame).
      if (!atTarget && (targetMoved > 0.6 || follower.done)) { moveTo(p); lastTarget.current = [p[0], p[1]]; }
      return 'running';
    },
  }), [moveTo, follower]);

  const { runner } = useBehaviorTree(TREE, { tasks });

  useFrame((_, dt) => {
    runner.board.targetXZ = target.current; // "perception" → board
    const g = groupRef.current;
    if (!g) return;
    // The NPC's own speed (0..1) drives the blend space, imperatively (no per-frame React state).
    const moved = g.position.distanceTo(prevPos.current);
    prevPos.current.copy(g.position);
    const v = Math.min(1, moved / Math.max(dt, 1e-4) / MAX_SPEED);
    ctrl.current?.setParam('speed', v);
  });

  return (
    <group ref={groupRef} position={[-6, 0, -6]}>
      <Suspense fallback={null}>
        <AnimatedCharacter url={MODEL} asset={LOCO} onReady={(c) => (ctrl.current = c)} />
      </Suspense>
    </group>
  );
}

export function FollowDemo() {
  const target = useRef<[number, number]>([0, 0]);
  const markerRef = useRef<THREE.Mesh>(null);
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    target.current = [e.point.x, e.point.z];
    markerRef.current?.position.set(e.point.x, 0.02, e.point.z);
  };
  return (
    <Canvas shadows camera={{ position: [0, 11, 12], fov: 45 }}>
      <color attach="background" args={['#0e1116']} />
      <hemisphereLight args={['#dfe7ff', '#181c25', 1.2]} />
      <directionalLight position={[5, 9, 5]} intensity={2} castShadow />
      <mesh rotation-x={-Math.PI / 2} receiveShadow onPointerMove={onMove}>
        <planeGeometry args={[16, 16]} />
        <meshStandardMaterial color="#1b2230" />
      </mesh>
      {/* the "you" marker the NPC chases */}
      <mesh ref={markerRef} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.25, 0.35, 24]} /><meshBasicMaterial color="#4ade80" />
      </mesh>
      <Npc target={target} />
      <ContactShadows position={[0, 0.01, 0]} opacity={0.4} scale={18} blur={2.4} far={5} />
      <Grid args={[16, 16]} cellSize={0.5} cellColor="#222936" sectionSize={2} sectionColor="#323a49" fadeDistance={34} />
      <OrbitControls makeDefault target={[0, 0, 0]} />
    </Canvas>
  );
}
