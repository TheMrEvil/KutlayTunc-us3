// CONSUMER USAGE — Navigation.
// `useNavMesh` bakes a grid (with obstacles) once; `useNavAgent` steers an Object3D along
// A* paths. You just call `moveTo([x, z])` — the agent follows every frame on its own.
import { useRef, useState } from 'react';
import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Grid, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { useNavMesh, useNavAgent } from '@kutlaytunc/us3-react';
import type { NavGridData } from '@kutlaytunc/us3-ai';

// Walkable bounds + a couple of box obstacles to route around. Plain JSON — author it by hand
// or in the us3 NavMesh editor (`*.navmesh.json`).
const NAV: NavGridData = {
  min: [-8, -8],
  max: [8, 8],
  cellSize: 0.5,
  agentRadius: 0.4,
  obstacles: [
    { x: -1.5, z: 0, w: 3, d: 1 },
    { x: 3, z: -3, w: 1, d: 4 },
  ],
};

function Agent() {
  const grid = useNavMesh(NAV);               // ← bake the nav grid (memoized on the data)
  const ref = useRef<THREE.Group>(null);
  const { moveTo } = useNavAgent(grid, ref, { speed: 4 }); // ← owns a PathFollower, ticks each frame
  const [target, setTarget] = useState<[number, number] | null>(null);

  // Click the floor → path there.
  const onFloor = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const x = e.point.x, z = e.point.z;
    moveTo([x, z]);          // ← that's the whole API
    setTarget([x, z]);
  };

  return (
    <>
      <mesh rotation-x={-Math.PI / 2} receiveShadow onClick={onFloor}>
        <planeGeometry args={[16, 16]} />
        <meshStandardMaterial color="#1b2230" />
      </mesh>

      {/* obstacles */}
      {NAV.obstacles!.map((o, i) => (
        <mesh key={i} position={[o.x, 0.5, o.z]} castShadow>
          <boxGeometry args={[o.w, 1, o.d]} />
          <meshStandardMaterial color="#3a4458" />
        </mesh>
      ))}

      {/* the agent */}
      <group ref={ref} position={[-6, 0, -6]}>
        <mesh castShadow position={[0, 0.5, 0]}>
          <capsuleGeometry args={[0.3, 0.6, 8, 16]} />
          <meshStandardMaterial color="#3b82f6" />
        </mesh>
        <mesh position={[0, 0.5, 0.32]}><coneGeometry args={[0.12, 0.24, 12]} /><meshBasicMaterial color="#0e1116" /></mesh>
      </group>

      {/* click marker */}
      {target && (
        <mesh position={[target[0], 0.02, target[1]]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[0.25, 0.35, 24]} /><meshBasicMaterial color="#4ade80" />
        </mesh>
      )}
    </>
  );
}

export function NavDemo() {
  return (
    <Canvas shadows camera={{ position: [0, 11, 11], fov: 45 }}>
      <color attach="background" args={['#0e1116']} />
      <hemisphereLight args={['#dfe7ff', '#181c25', 1.2]} />
      <directionalLight position={[5, 9, 5]} intensity={2} castShadow />
      <Agent />
      <ContactShadows position={[0, 0.01, 0]} opacity={0.4} scale={18} blur={2.4} far={5} />
      <Grid args={[16, 16]} cellSize={0.5} cellColor="#222936" sectionSize={2} sectionColor="#323a49" fadeDistance={34} />
      <OrbitControls makeDefault target={[0, 0, 0]} />
    </Canvas>
  );
}
