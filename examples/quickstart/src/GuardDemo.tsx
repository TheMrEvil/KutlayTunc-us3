// CONSUMER USAGE — AI (behaviour tree + navigation + a plain-object board, composed).
// A guard patrols 4 waypoints. A "player" orbits; when it enters the guard's sight radius the
// behaviour tree's selector picks `chase` over `patrol`. Each runtime is one hook; they share
// state through `runner.board` — a plain object. This is the whole NPC brain in ~40 lines.
import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { useNavMesh, useNavAgent, useBehaviorTree } from '@kutlaytunc/us3-react';
import type { NavGridData, BehaviorTreeData, TaskImpl } from '@kutlaytunc/us3-ai';

const NAV: NavGridData = { min: [-7, -7], max: [7, 7], cellSize: 0.5 };
const WAYPOINTS: [number, number][] = [[-5, -5], [5, -5], [5, 5], [-5, 5]];
const SIGHT = 6;

// A selector tries `chase` first; it fails when the player is out of sight, so `patrol` runs.
const TREE: BehaviorTreeData = {
  version: 1,
  root: {
    id: 'root', kind: 'selector', children: [
      { id: 'chase', kind: 'task', task: 'chase' },
      { id: 'patrol', kind: 'task', task: 'patrol' },
    ],
  },
};

function Guard({ onStatus }: { onStatus: (s: string) => void }) {
  const grid = useNavMesh(NAV);
  const guardRef = useRef<THREE.Group>(null);
  const playerRef = useRef<THREE.Mesh>(null);
  const { moveTo, follower } = useNavAgent(grid, guardRef, { speed: 3.2 });
  const wp = useRef(0);
  const seenRef = useRef(false);

  // Leaf tasks read/write the board and drive the nav agent. Built-ins (succeed/fail/wait)
  // exist too; these are the app-specific ones.
  const tasks = useMemo<Record<string, TaskImpl>>(() => ({
    chase: (board) => {
      if (!board.canSeePlayer) return 'failure';                 // → selector falls through to patrol
      const p = board.playerPos as [number, number] | undefined;
      if (p) moveTo(p);                                          // re-path toward the player
      return 'running';
    },
    patrol: () => {
      if (follower.done) { moveTo(WAYPOINTS[wp.current]); wp.current = (wp.current + 1) % WAYPOINTS.length; }
      return 'running';
    },
  }), [moveTo, follower]);

  const { runner } = useBehaviorTree(TREE, { tasks });           // ← plain board, ticks the tree every frame

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const px = Math.cos(t * 0.8) * 5, pz = Math.sin(t * 0.8) * 5; // laps faster than the guard → sight cycles in and out
    playerRef.current?.position.set(px, 0.5, pz);

    const g = guardRef.current;
    if (g) {
      const seen = Math.hypot(px - g.position.x, pz - g.position.z) < SIGHT;
      runner.board.playerPos = [px, pz];                         // perception → board
      runner.board.canSeePlayer = seen;
      if (seen !== seenRef.current) { seenRef.current = seen; onStatus(seen ? 'CHASE' : 'PATROL'); }
    }
  });

  return (
    <>
      {/* the guard + a sight ring */}
      <group ref={guardRef} position={[-5, 0, -5]}>
        <mesh castShadow position={[0, 0.6, 0]}><capsuleGeometry args={[0.32, 0.7, 8, 16]} /><meshStandardMaterial color="#ef4444" /></mesh>
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}><ringGeometry args={[SIGHT - 0.06, SIGHT, 48]} /><meshBasicMaterial color="#ef4444" transparent opacity={0.25} /></mesh>
      </group>

      {/* the player it watches */}
      <mesh ref={playerRef} castShadow><sphereGeometry args={[0.4, 24, 24]} /><meshStandardMaterial color="#4ade80" /></mesh>

      {/* patrol waypoints */}
      {WAYPOINTS.map((w, i) => (
        <mesh key={i} position={[w[0], 0.02, w[1]]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[0.2, 0.3, 20]} /><meshBasicMaterial color="#3b82f6" />
        </mesh>
      ))}
    </>
  );
}

export function GuardDemo() {
  const [status, setStatus] = useState('PATROL');
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas shadows camera={{ position: [0, 12, 12], fov: 45 }}>
        <color attach="background" args={['#0e1116']} />
        <hemisphereLight args={['#dfe7ff', '#181c25', 1.2]} />
        <directionalLight position={[5, 9, 5]} intensity={2} castShadow />
        <Guard onStatus={setStatus} />
        <ContactShadows position={[0, 0.01, 0]} opacity={0.4} scale={16} blur={2.4} far={5} />
        <Grid args={[14, 14]} cellSize={0.5} cellColor="#222936" sectionSize={2} sectionColor="#323a49" fadeDistance={30} />
        <OrbitControls makeDefault target={[0, 0, 0]} />
      </Canvas>
      <div className="overlay">
        behaviour tree → <b style={{ color: status === 'CHASE' ? '#ef4444' : '#3b82f6' }}>{status}</b>
      </div>
    </div>
  );
}
