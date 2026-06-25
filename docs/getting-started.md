# Getting started

```bash
npm i @kutlaytunc/us3 three @react-three/fiber @react-three/drei
# or modular: npm i @kutlaytunc/us3-ai @kutlaytunc/us3-anim @kutlaytunc/us3-react
# real navmesh:  npm i @kutlaytunc/us3-nav-recast @recast-navigation/core @recast-navigation/three
# ecctrl bridge: npm i @kutlaytunc/us3-ecctrl ecctrl @react-three/rapier
```

Every runtime is one hook (or `<AnimatedCharacter>`). The hook owns the instance and ticks it in
`useFrame`; you drive it from your own code. Data lives wherever you want — a plain object, a JSON
file, an inline literal. There is no required project structure.

## ⚠️ Keep data props referentially stable

Hooks rebuild their runtime when their **data** prop changes identity. A fresh object literal every
render silently resets state. Hoist data to module scope or memoize it:

```tsx
const ASSET: AnimGraphAsset = { /* … */ }            // module scope — best
const nav = useMemo(() => RecastNavProvider.fromMeshes(meshes), [meshes])
```

Steer hooks with *function args* (`moveTo([x, z])`) and *plain values* (`params={{ speed }}`), not by
swapping the data object.

## Animation — `<AnimatedCharacter>`

A blend space + state machine on a rigged glTF, driven by a `speed` parameter:

```tsx
import { AnimatedCharacter } from '@kutlaytunc/us3-react'
import type { AnimGraphAsset } from '@kutlaytunc/us3-anim'

const locomotion: AnimGraphAsset = {
  version: 1, name: 'Locomotion',
  params: [{ name: 'speed', type: 'float', default: 0, smoothing: 6 }],
  clips: [{ name: 'Idle' }, { name: 'Walk' }, { name: 'Run' }],
  blendSpaces: [{ id: 'loco', dimensions: 1, axes: [{ name: 'speed', min: 0, max: 1, divisions: 4 }],
    samples: [{ id: 'i', clip: 'Idle', position: [0] }, { id: 'w', clip: 'Walk', position: [0.5] }, { id: 'r', clip: 'Run', position: [1] }] }],
  stateMachine: { id: 'sm', entry: 'move', states: [{ id: 'move', source: { kind: 'blendspace', ref: 'loco' } }], transitions: [] },
}

<AnimatedCharacter url="/Soldier.glb" asset={locomotion} params={{ speed }} />
```

For low-re-render control, grab the controller and set params imperatively:

```tsx
const ctrl = useRef<AnimController | null>(null)
<AnimatedCharacter url="/Soldier.glb" asset={locomotion} onReady={(c) => (ctrl.current = c)} />
// in a useFrame: ctrl.current?.setParam('speed', v)   // no per-frame React state
```

## AI — behaviour tree + perception + nav

The tree's shared memory is a **plain object** (`runner.board`). Perception (or your code) writes to
it; tasks read it. Tasks return `'success' | 'failure' | 'running'`.

```tsx
import { useNavMesh, useNavAgent, useBehaviorTree } from '@kutlaytunc/us3-react'
import type { BehaviorTreeData, TaskImpl } from '@kutlaytunc/us3-ai'

const TREE: BehaviorTreeData = {                       // selector: chase first, else patrol
  version: 1,
  root: { id: 'root', kind: 'selector', children: [
    { id: 'chase', kind: 'task', task: 'chase' },
    { id: 'patrol', kind: 'task', task: 'patrol' },
  ] },
}

function Guard() {
  const grid = useNavMesh(NAV)
  const ref = useRef<THREE.Group>(null)
  const { moveTo, follower } = useNavAgent(grid, ref, { speed: 3 })

  const tasks = useMemo<Record<string, TaskImpl>>(() => ({
    chase:  (b) => { if (!b.canSeePlayer) return 'failure'; moveTo(b.playerPos as [number, number]); return 'running' },
    patrol: () => { if (follower.done) moveTo(nextWaypoint()); return 'running' },
  }), [moveTo, follower])

  const { runner } = useBehaviorTree(TREE, { tasks })
  useFrame(() => { runner.board.canSeePlayer = sees(); runner.board.playerPos = playerXZ() })  // perception → board
  return <group ref={ref}>{/* mesh */}</group>
}
```

`useNavMesh` is the zero-dependency grid fallback. For real geometry, swap in a recast navmesh — the
AI code is unchanged because both are `NavProvider`s.

## Real navmesh + ecctrl

```tsx
import { init, RecastNavProvider } from '@kutlaytunc/us3-nav-recast'
import { useEcctrlNavAgent } from '@kutlaytunc/us3-ecctrl'

await init()                                           // load recast WASM once, up front
const nav = RecastNavProvider.fromMeshes([ground, ...walls])
const agent = useEcctrlNavAgent(ecctrlRef, nav)        // ecctrl = body, us3 = brain
// in a BT task: agent.moveTo(enemyXZ); return agent.moving ? 'running' : 'success'
```

See [`examples/quickstart`](../examples/quickstart) for the working **follow-me** demo (an NPC that
paths to your cursor and blends idle→walk→run by its own speed), plus nav and guard demos, and
[`examples/basic`](../examples/basic) for the animation blend space alone.
