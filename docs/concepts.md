# Concepts

## Animation graph (`@kutlaytunc/us3-anim`)

- **Blend space** — clips placed at coordinates in a parameter space; a live coordinate produces clip
  weights that always sum to 1. **1D** uses edge-clamped bracketing; **2D** uses a Delaunay
  triangulation + barycentric weights. The `WeightSolver` interface is exactly this map
  (coordinate → weights); `BlendSpace` is the built-in implementation.
- **State machine** — a priority-ordered FSM whose transitions are gated by rules over the parameter
  bag, with eased crossfades. Each active state contributes a blend (the blends sum to 1).
- **Controller (AnimGraph)** — `AnimController` ties it together: it smooths parameters, ticks the
  state machine, evaluates active states + additive layers into clip-weight maps, and normalizes the
  base layer. It holds no three state. Pass `{ solverFactory }` to swap the blend backend.
- **MixerDriver** — the one three-touching module: writes the controller's weights onto
  `AnimationMixer` actions (`setEffectiveWeight`), bakes additive clips. **us3 computes weights; three
  blends keyframes.**
- **Secondary motion** — IK (two-bone / FABRIK), foot-IK, look-at / aim, inertialization (quintic,
  overshoot-free pose blend), montage (sectioned clips), notifies (loop-aware timeline events), sync
  groups (phase-matched loops), root motion, animation curves. Each is a pure function + an optional
  stateful class.

## AI (`@kutlaytunc/us3-ai`)

- **Behaviour tree** — re-ticked from the root every frame: composites (selector / sequence /
  parallel) short-circuit, **gate** decorators (`blackboard` / `cooldown` / `condition`) block a
  branch, **modifier** decorators (`inverter` / `forceSuccess` / `loop`) transform a result, services
  tick on an interval, and tasks may run across frames. Re-evaluation gives reactive selectors: a
  higher-priority branch whose gate becomes true naturally aborts a running lower-priority one.
- **Board** — the tree's shared memory is a **plain object** (`runner.board`), not a typed-blackboard
  class. Perception (or your code) writes keys; tasks and gate decorators read them
  (`board.seesPlayer = true`). A JS object is the substrate.
- **Perception** — sight (range + lose-sight hysteresis + a vision cone via `dot ≥ cos(halfAngle)` +
  optional line-of-sight raycast), hearing/damage stimuli, with stimulus aging/forgetting.
- **Navigation** — `NavGrid` bakes obstacle boxes into an occupancy bitmap and runs 8-way A* + octile
  heuristic + line-of-sight string-pulling; `PathFollower` advances waypoints and yields a heading.
  This is the zero-dependency fallback. `findPath` results are world `[x, z]` points.
- **EQS** — a pure `generate → filter + score → sort → select` pipeline for tactical positions
  (cover / flank): generators (grid / circle / donut / actors), tests (distance / dot / trace /
  pathfinding), run modes (best / bestN / random).

## The swap seams (`@kutlaytunc/us3-core`)

- **`NavProvider`** — `{ findPath, project, contains?, randomPoint?, isReachable? }` over world `[x, z]`
  points. `NavGrid` (fallback) and `RecastNavProvider` (real navmesh) both implement it; AI/path-follow
  code never marries a navmesh implementation.
- **`WeightSolver`** — `{ weightsAt(coords): WeightList }`. `BlendSpace` implements it; `AnimController`
  depends only on the interface, so a future drei-native blend space drops in via `solverFactory`.

Both interfaces exist so the parts the ecosystem *does* maintain (recast navmesh; a hypothetical drei
blend space) can replace us3's built-ins without rewriting your game code.
