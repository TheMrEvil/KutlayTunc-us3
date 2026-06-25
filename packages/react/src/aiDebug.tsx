// Drop-in R3F debug visualizers for the AI runtimes — render them inside any
// <Canvas> to see the navmesh, an EQS result heat-map, or a perception range.
import { useMemo } from 'react';
import type { NavGrid, QueryItem } from '@kutlaytunc/us3-ai';

/** Flat quads over the blocked cells of a NavGrid. */
export function NavMeshDebug({ grid, color = '#3b82f6', opacity = 0.32, y = 0.02 }: { grid: NavGrid; color?: string; opacity?: number; y?: number }) {
  const cells = useMemo(() => {
    const out: [number, number][] = [];
    for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) if (grid.isBlocked(c, r)) out.push(grid.cellToWorld(c, r));
    return out;
  }, [grid]);
  const s = grid.cellSize * 0.92;
  return (
    <group>
      {cells.map(([x, z], i) => (
        <mesh key={i} position={[x, y, z]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[s, s]} />
          <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

const scoreHue = (t: number) => `hsl(${(1 - Math.max(0, Math.min(1, t))) * 210}, 85%, 55%)`; // red (best) → blue (worst)

/** EQS result as score-colored, height-scaled spheres (Unreal testing-pawn style). */
export function EQSDebug({ items, scale = 0.5 }: { items: QueryItem[]; scale?: number }) {
  const max = useMemo(() => Math.max(1e-6, ...items.map((i) => i.score)), [items]);
  return (
    <group>
      {items.map((it, i) => {
        const t = it.score / max;
        return (
          <mesh key={i} position={[it.point[0], 0.05 + t * scale, it.point[2]]}>
            <sphereGeometry args={[0.1, 12, 12]} />
            <meshBasicMaterial color={scoreHue(t)} />
          </mesh>
        );
      })}
    </group>
  );
}

/** A wireframe sight-range sphere + a forward marker for a perception listener. */
export function PerceptionDebug({ position, forward, radius, color = '#ffd479' }: { position: [number, number, number]; forward: [number, number, number]; radius: number; color?: string }) {
  const tip: [number, number, number] = [position[0] + forward[0] * radius, position[1], position[2] + forward[2] * radius];
  return (
    <group>
      <mesh position={position}><sphereGeometry args={[radius, 20, 16]} /><meshBasicMaterial color={color} wireframe transparent opacity={0.12} /></mesh>
      <mesh position={[(position[0] + tip[0]) / 2, position[1], (position[2] + tip[2]) / 2]}><sphereGeometry args={[0.09, 8, 8]} /><meshBasicMaterial color={color} /></mesh>
    </group>
  );
}
