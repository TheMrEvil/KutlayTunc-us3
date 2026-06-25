# us3 quickstart — consumer usage

A plain **React + Vite + React Three Fiber** app that shows how someone *using* us3 wires
its runtimes in. Three self-contained tabs:

- **Navigation** — `useNavMesh` + `useNavAgent`: click the floor, an agent paths around obstacles.
- **Guard AI** — `useBehaviorTree` + `useBlackboard` + nav: a guard patrols, chases the player on sight.
- **Gameplay** — `useAttributes` + `useAbilities`: HP/mana/stamina pools, cooldowns, costs.

## Run it (inside this monorepo)
```bash
pnpm install
pnpm --filter @kutlaytunc/us3-example-quickstart dev
```
`vite.config.ts` aliases `@kutlaytunc/us3-*` to the package **source** so it runs the latest engine
with no build step.

## In your own project
A real consumer just installs the package — no alias needed:
```bash
npm i us3 three @react-three/fiber @react-three/drei
```
```ts
// same imports as this demo:
import { useNavMesh, useNavAgent, useBehaviorTree, useAttributes, useAbilities } from '@kutlaytunc/us3-react'
import type { NavGridData } from '@kutlaytunc/us3-core'
```

## The one pattern to learn
Every runtime is a headless class in `@kutlaytunc/us3-core`; every hook in `@kutlaytunc/us3-react` owns one
instance and ticks it in `useFrame`. You only ever **drive** it:

```tsx
const grid = useNavMesh(navData)              // bakes once
const { moveTo } = useNavAgent(grid, ref)     // follows paths each frame
// ...later, from a click / a behaviour-tree task:
moveTo([x, z])
```

```tsx
const stats = useAttributes({ health: { base: 100 }, mana: { base: 100, regen: 18 } })
stats.apply('health', -18)        // take damage (clamped, fires events)
stats.fraction('mana')            // 0..1 for a bar
```

### Animation
This demo focuses on AI + gameplay. For the **animation** runtime (blend spaces + state machine
driving a rigged glTF), see the sibling [`examples/basic`](../basic) — the shape is:
```tsx
import { AnimatedCharacter } from '@kutlaytunc/us3-react'
<AnimatedCharacter url="/Soldier.glb" asset={locomotion} params={{ speed }} />
```

> Editing side: the same data these hooks consume is what the **VS Code extension** edits visually
> (`*.scene.tsx`, `*.navmesh.json`, `*.behaviour.json`, `*.attributes.json`, …) and round-trips to
> your source. See the repo's [docs/overview.md](../../docs/overview.md).
