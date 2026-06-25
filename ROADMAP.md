# us3 — Roadmap & Working State

> Living source-of-truth. us3 is a composable, **R3F-native game-AI + animation runtime** that plugs
> into the live pmndrs stack instead of competing with it.

## Identity

us3 owns the two constructs the R3F ecosystem has **no maintained, native home** for, and composes
with everything else:

- **`@kutlaytunc/us3-ai`** — behaviour tree (plain-object board memory) + perception (sight cone / LoS / hearing)
  + navigation (grid fallback + path follower) + EQS. Navmesh-agnostic via `NavProvider`.
- **`@kutlaytunc/us3-anim`** — an animation graph over three's `AnimationMixer`: blend spaces (1D bracket / 2D
  Delaunay barycentric) + a parameter-driven state machine + additive layers + secondary motion (IK,
  foot-IK, look-at, inertialization, montage, notifies, sync). Blend layer swappable via `WeightSolver`.
- **`@kutlaytunc/us3-core`** — shared math + the two swap interfaces (`NavProvider`, `WeightSolver`). Zero deps.
- **`@kutlaytunc/us3-react`** — one hook per runtime + `<AnimatedCharacter>` + debug visualizers.
- **`@kutlaytunc/us3-nav-recast`** — a `RecastNavProvider` (real navmesh) over recast-navigation.
- **`@kutlaytunc/us3-ecctrl`** — drive an ecctrl body from a behaviour tree.

**Principle:** headless runtime + one-line R3F hook + composes with a maintained pmndrs library.
Never reimplement what the live ecosystem maintains — wrap it behind a small interface.

## Compose, don't rebuild

These are covered and maintained — us3 composes with them, never rebuilds them: visual scene editor
(**triplex**), body/locomotion/physics (**ecctrl** / **rapier**), navmesh baking + crowd
(**recast-navigation**), input + camera (**drei**), in-world UI (**uikit**), XR (**@react-three/xr**),
ECS/state (**koota** / **zustand**), sequencer/cutscene (**Theatre.js** / **@react-three/timeline**),
glTF loading (**drei**).

## State — done

- [x] Modular split: `@kutlaytunc/us3-core` (math + interfaces) · `@kutlaytunc/us3-ai` · `@kutlaytunc/us3-anim` · `@kutlaytunc/us3-react` ·
      `@kutlaytunc/us3-nav-recast` · `@kutlaytunc/us3-ecctrl` · `us3` umbrella.
- [x] AI: behaviour tree (plain-object board, no typed-blackboard class), perception, NavGrid +
      `PathFollower`, EQS. `NavProvider` interface; `RecastNavProvider` adapter.
- [x] Animation graph: blend spaces, state machine, additive layers, IK / foot-IK / look-at /
      inertialization / montage / notifies / sync / curves / root motion. `WeightSolver` swap seam.
- [x] `<AnimatedCharacter>` + hooks. `useEcctrlNavAgent` bridge.
- [x] 92 unit tests green (core 16 · ai 21 · anim 55); every package typechecks + builds.
- [x] `examples/quickstart`: **follow-me** flagship (NPC paths to your cursor + blends idle/walk/run),
      plus nav + guard demos. `examples/basic`: animation blend-space demo.

## Next

- [ ] **Dynamic navmesh.** `RecastNavProvider` wraps `threeToSoloNavMesh` today (a static bake).
      recast also ships `threeToTileCache` + `TileCache.addBoxObstacle/removeObstacle/update()` for
      runtime obstacles (doors, destructibles) — wrap it behind `NavProvider` + a `useNavObstacle` hook.
- [ ] **`useCrowd` over recast.** Drive `@recast-navigation/core`'s ORCA `Crowd` for many agents
      (us3's own crowd/steering were dropped; recast's Detour crowd is the maintained answer).
- [ ] **triplex-compose helpers.** A `<Waypoint>` marker + `useWaypoints()` collector, and a
      `useNavMeshFromScene()` that bakes recast from authored scene meshes — thin glue between
      triplex-authored positions/geometry and the us3 brain.
- [ ] **ecctrl joystick→world axis** live-verify in `useEcctrlNavAgent` (override hook exists).
- [ ] **Animation v2.** Interruptible transitions, clip-end triggers, quaternion inertialization, IK
      joint constraints, foot-IK surface normals, per-bone (avatar mask) layered blending.

## Non-goals (compose / lean on the ecosystem)

Visual scene editor (triplex) · physics + ragdoll (rapier) · navmesh baking + crowd internals (recast)
· camera/input (drei) · in-world UI (uikit) · XR · ECS (koota) · sequencer (Theatre) · skeleton
retargeting (three `SkeletonUtils`) · a typed-blackboard class (a plain object is the board) ·
gameplay systems (attributes/abilities/factions/damage — commodity, out of scope).
