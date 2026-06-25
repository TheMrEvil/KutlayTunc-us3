<div align="center">

# us3

**Composable game-AI + animation runtime for React Three Fiber**

<sub>**us** — Turkish for *mind / reason*. ecctrl gives a character a body; **us3** gives it a mind.</sub>

[![@kutlaytunc/us3 on npm](https://img.shields.io/npm/v/@kutlaytunc/us3?logo=npm&label=%40kutlaytunc%2Fus3&color=cb3837)](https://www.npmjs.com/package/@kutlaytunc/us3)
[![@kutlaytunc/us3-ai](https://img.shields.io/npm/v/@kutlaytunc/us3-ai?label=%40kutlaytunc%2Fus3-ai&color=cb3837)](https://www.npmjs.com/package/@kutlaytunc/us3-ai)
[![@kutlaytunc/us3-anim](https://img.shields.io/npm/v/@kutlaytunc/us3-anim?label=%40kutlaytunc%2Fus3-anim&color=cb3837)](https://www.npmjs.com/package/@kutlaytunc/us3-anim)
[![license](https://img.shields.io/npm/l/us3?color=blue)](LICENSE)

Two headless, R3F-native runtimes — a **game-AI brain** (behaviour tree · perception · navmesh
path-following · EQS) and an **animation graph** (blend spaces · state machine · IK · secondary
motion) — each with a one-line hook. Built to **plug into the live pmndrs stack**: edit scenes in
[triplex](https://github.com/pmndrs/triplex), move bodies with [ecctrl](https://github.com/pmndrs/ecctrl),
bake navmeshes with [recast-navigation](https://github.com/isaac-mason/recast-navigation-js) — us3 is the brain.

[npm](https://www.npmjs.com/package/@kutlaytunc/us3) · [Why](#why) · [Packages](#packages) · [Quick start](#quick-start) · [Docs](docs/)

</div>

> ⚠️ **Pre-alpha.** APIs will change. us3 fills two gaps the live R3F ecosystem leaves open;
> everything else (scenes, bodies, physics, navmesh baking, input, UI) it composes with rather
> than rebuilds. See [ROADMAP.md](ROADMAP.md).

---

## Why

three.js + R3F give the web a great renderer, and the pmndrs ecosystem covers a lot — visual editing
(triplex), character bodies (ecctrl), physics (rapier), navmesh baking (recast-navigation), input,
in-world UI, XR. Two things have **no maintained, R3F-native home**:

- **A game-AI brain.** The one comprehensive JS AI library, [yuka](https://github.com/Mugen87/yuka),
  has been unmaintained since 2022 and isn't R3F-native. There is a maintained behaviour-tree *engine*
  ([mistreevous](https://github.com/nikkorn/mistreevous)), but no assembled runtime that wires a tree
  to **perception** (sight cone / line-of-sight), **navmesh path-following**, and **EQS** as R3F hooks.
- **An animation graph.** three's `AnimationMixer` is a great blend *mechanism* (weighted clip mixing,
  crossfade, additive) and drei's `useAnimations` wraps it — but neither gives you a **blend space**
  (parameter → weights) or a **parameter-driven state machine**. You hand-roll the weight math every time.

us3 fills exactly those two, as **headless runtimes + one-line hooks** that compose with the tools you
already use. The AI is **navmesh-agnostic** (a small `NavProvider` interface) and the animation blend
layer is **swappable** (a `WeightSolver` interface) — so swapping nav tech, or adopting a drei blend
space if one ever ships, never rewrites your game code.

| You bring (live, maintained) | us3 adds |
| --- | --- |
| [triplex](https://github.com/pmndrs/triplex) — visual scene editing | the runtimes your scene objects run |
| [ecctrl](https://github.com/pmndrs/ecctrl) — body, locomotion, physics | the **brain** that decides where it goes ([`@kutlaytunc/us3-ecctrl`](packages/ecctrl)) |
| [recast-navigation](https://github.com/isaac-mason/recast-navigation-js) — real navmesh | path-following + behaviour trees over it ([`@kutlaytunc/us3-nav-recast`](packages/nav-recast)) |
| three `AnimationMixer` — clip blend mechanism | the blend-space + state-machine **graph** on top ([`@kutlaytunc/us3-anim`](packages/anim)) |

## Packages

| Package | What it is |
| --- | --- |
| [`@kutlaytunc/us3-core`](packages/core) | Shared foundation: pure in-house math (scalar, 1D bracket, 2D Delaunay barycentric) + the two swap interfaces — `NavProvider` and `WeightSolver`. Zero deps. |
| [`@kutlaytunc/us3-ai`](packages/ai) | The brain: behaviour tree (plain-object board memory), perception (sight cone / LoS / hearing), navigation (grid fallback + path follower), EQS. Navmesh-agnostic. |
| [`@kutlaytunc/us3-anim`](packages/anim) | The animation graph over three's `AnimationMixer`: blend spaces (1D/2D), a parameter-driven state machine, additive layers, IK, foot-IK, look-at, inertialization, montage, notifies, sync. Blend layer is swappable. |
| [`@kutlaytunc/us3-react`](packages/react) | R3F bindings: `<AnimatedCharacter>` + a hook per runtime (`useBehaviorTree`, `usePerceptionSystem`, `useNavAgent`, `useEnvQuery`, `useMontage`, `useLookAt`) + debug visualizers. |
| [`@kutlaytunc/us3-nav-recast`](packages/nav-recast) | A `NavProvider` backed by [recast-navigation](https://github.com/isaac-mason/recast-navigation-js) — bake a real navmesh and feed it to the AI unchanged. |
| [`@kutlaytunc/us3-ecctrl`](packages/ecctrl) | Bridge so a behaviour tree drives a [pmndrs/ecctrl](https://github.com/pmndrs/ecctrl) character (`useEcctrlNavAgent`). |
| [`@kutlaytunc/us3`](packages/us3) | Umbrella — `npm i @kutlaytunc/us3` re-exports core + ai + anim + react. |

## Quick start

```bash
npm i @kutlaytunc/us3 three @react-three/fiber @react-three/drei
# or modular: npm i @kutlaytunc/us3-ai @kutlaytunc/us3-anim @kutlaytunc/us3-react
# real navmesh:  npm i @kutlaytunc/us3-nav-recast @recast-navigation/core @recast-navigation/three
# ecctrl bridge: npm i @kutlaytunc/us3-ecctrl ecctrl @react-three/rapier
```

**Animation** — a blend space + state machine on a rigged glTF, in one component:

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

**AI** — a guard that patrols and chases, navmesh-agnostic. The behaviour tree's shared memory is a
plain object (`runner.board`); perception writes to it, tasks read it:

```tsx
import { useNavMesh, useNavAgent, useBehaviorTree } from '@kutlaytunc/us3-react'
import type { BehaviorTreeData, TaskImpl } from '@kutlaytunc/us3-ai'

const { moveTo, follower } = useNavAgent(nav, ref)   // nav: any NavProvider
const { runner } = useBehaviorTree(tree, { tasks: {
  chase:  (b) => { if (!b.canSeePlayer) return 'failure'; moveTo(b.playerPos as [number, number]); return 'running' },
  patrol: () => { if (follower.done) moveTo(nextWaypoint()); return 'running' },
}})
// each frame, your perception writes: runner.board.canSeePlayer = ...; runner.board.playerPos = ...
```

**Real navmesh + ecctrl** — bake from geometry, let the BT drive an ecctrl body:

```tsx
import { init, RecastNavProvider } from '@kutlaytunc/us3-nav-recast'
import { useEcctrlNavAgent } from '@kutlaytunc/us3-ecctrl'

await init()                                          // load recast WASM once
const nav = RecastNavProvider.fromMeshes([ground, ...walls])
const agent = useEcctrlNavAgent(ecctrlRef, nav)       // ecctrl = legs, us3 = brain
// in a BT task: agent.moveTo(enemyXZ); return agent.moving ? 'running' : 'success'
```

See [`examples/quickstart`](examples/quickstart) for a working **follow-me** demo (an NPC that paths
to your cursor over a navmesh and blends idle→walk→run by its own speed) plus nav and guard demos.

## The two swap seams

us3 owns the *constructs* nobody maintains and stays thin where the ecosystem is strong:

- **`NavProvider`** (`@kutlaytunc/us3-core`) — the AI navigates against this interface. The built-in `NavGrid`
  is a zero-dependency fallback; `@kutlaytunc/us3-nav-recast`'s `RecastNavProvider` is a real navmesh. Your
  behaviour-tree/perception code never changes when you swap.
- **`WeightSolver`** (`@kutlaytunc/us3-core`) — the animation graph's blend layer. `BlendSpace` is the built-in
  implementation; `AnimController` depends only on the interface (`new AnimController(asset, { solverFactory })`),
  so a drei-native blend space — if the ecosystem ever ships one — drops in without touching the graph.

> Keep data props (`asset`, nav data) **referentially stable** — hoist them to module scope or `useMemo`.
> See [docs/getting-started.md](docs/getting-started.md).

## Documentation

- [Overview](docs/overview.md) · [Getting started](docs/getting-started.md) · [Concepts](docs/concepts.md) · [Asset format](docs/asset-format.md)
- [Roadmap](ROADMAP.md)

```bash
pnpm typecheck   # type-check every package
pnpm test        # unit tests (vitest) — core + ai + anim
pnpm build       # build the publishable packages
```

## Credits

The demo character is the **Soldier** model from the [three.js](https://github.com/mrdoob/three.js)
examples (MIT). Composes with [triplex](https://github.com/pmndrs/triplex),
[ecctrl](https://github.com/pmndrs/ecctrl) and
[recast-navigation](https://github.com/isaac-mason/recast-navigation-js).

## License

[MIT](LICENSE) © KutlayTunc
