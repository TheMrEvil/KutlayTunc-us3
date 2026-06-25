# Changelog

All notable changes to us3 are documented here. This project is **pre-alpha**; APIs may change
between any two versions until 1.0.

## [Unreleased]

us3 began life as *edithree*, a visual editor experiment. After auditing the live React-Three-Fiber
ecosystem it was refocused into a **composable, R3F-native game-AI + animation runtime** that plugs
into the pmndrs stack (triplex, ecctrl, recast-navigation) instead of competing with it, and split
into focused packages.

### Packages

- **`@kutlaytunc/us3-core`** — shared math (scalar, 1D bracket, 2D Delaunay barycentric) + the two swap
  interfaces, `NavProvider` and `WeightSolver`. Zero runtime dependencies.
- **`@kutlaytunc/us3-ai`** — behaviour tree (plain-object *board* memory), perception (sight cone / LoS /
  hearing), navigation (`NavGrid` fallback + `PathFollower`), EQS. Navmesh-agnostic.
- **`@kutlaytunc/us3-anim`** — animation graph over three's `AnimationMixer`: blend spaces (1D/2D), a
  parameter-driven state machine, additive layers, IK, foot-IK, look-at, inertialization, montage,
  notifies, sync, root motion. Blend layer swappable via `WeightSolver`.
- **`@kutlaytunc/us3-react`** — `<AnimatedCharacter>` + one hook per runtime + debug visualizers.
- **`@kutlaytunc/us3-nav-recast`** — `RecastNavProvider`, a real navmesh over recast-navigation.
- **`@kutlaytunc/us3-ecctrl`** — `useEcctrlNavAgent`, drive an ecctrl body from a behaviour tree.
- **`us3`** — umbrella re-exporting core + ai + anim + react.

### Notes

- The behaviour tree's shared memory is a plain object (`runner.board`); the typed-blackboard class
  was removed.
- Steering, crowd, gameplay systems (attributes/abilities/factions/damage), spline/volume geometry,
  and the visual editor were dropped — covered by the ecosystem or out of scope.
- 92 unit tests (core 16 · ai 21 · anim 55); every package type-checks and builds.
