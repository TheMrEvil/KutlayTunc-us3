# Overview

us3 is a **composable, R3F-native game-AI + animation runtime**. It owns the two constructs the
React-Three-Fiber ecosystem has no maintained native home for, and composes with everything else.

## The two pillars

- **The brain — [`@kutlaytunc/us3-ai`](../packages/ai).** A behaviour tree (with plain-object *board* memory) that
  orchestrates **perception** (sight cone / line-of-sight / hearing), **navmesh path-following**, and
  **EQS** (scored environment queries). Navmesh-agnostic: everything talks to a `NavProvider`.
- **The animation graph — [`@kutlaytunc/us3-anim`](../packages/anim).** A graph over three's `AnimationMixer`:
  **blend spaces** (1D bracketing / 2D Delaunay barycentric), a **parameter-driven state machine**,
  additive layers, and secondary motion (IK, foot-IK, look-at, inertialization, montage, notifies,
  sync). The blend layer sits behind a `WeightSolver` so it can be swapped.

## Layer model

```
@kutlaytunc/us3-core      pure math + the swap interfaces (NavProvider, WeightSolver) — zero deps
   ├── @kutlaytunc/us3-ai      behaviour tree · perception · navigation · EQS        (no three)
   └── @kutlaytunc/us3-anim    blend space · state machine · IK · montage · …        (three peer)
@kutlaytunc/us3-react     one hook per runtime + <AnimatedCharacter> + debug viz
@kutlaytunc/us3-nav-recast    RecastNavProvider — a real navmesh behind NavProvider
@kutlaytunc/us3-ecctrl        useEcctrlNavAgent — drive an ecctrl body from a BT
us3                umbrella: core + ai + anim + react
```

Every runtime is a plain class/function you can unit-test headlessly; the R3F hook just owns the
instance and ticks it in `useFrame`. The same code runs in tests and in production.

## What us3 does *not* do (compose instead)

| Need | Use |
| --- | --- |
| Visual scene editing | [triplex](https://github.com/pmndrs/triplex) |
| Body, locomotion, physics | [ecctrl](https://github.com/pmndrs/ecctrl) · [@react-three/rapier](https://github.com/pmndrs/react-three-rapier) |
| Navmesh baking + crowd | [recast-navigation](https://github.com/isaac-mason/recast-navigation-js) (wrapped by `@kutlaytunc/us3-nav-recast`) |
| Input, camera, glTF loading | [drei](https://github.com/pmndrs/drei) |
| In-world UI / XR / ECS / cutscene | [uikit](https://github.com/pmndrs/uikit) · [@react-three/xr](https://github.com/pmndrs/xr) · [koota](https://github.com/pmndrs/koota) · [Theatre.js](https://www.theatrejs.com/) |

See [concepts](concepts.md) for the model, [getting started](getting-started.md) for code, and the
[asset format](asset-format.md) for the `AnimGraphAsset` schema.
