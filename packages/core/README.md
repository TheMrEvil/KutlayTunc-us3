# @kutlaytunc/us3-core

> Headless animation runtime for [us3](https://github.com/KutlayTunc/us3).

Blend spaces (1D/2D), an animation state machine, a controller and the three.js `AnimationMixer`
driver — plus the asset schema they share. Framework-agnostic: the only runtime dependency is
`three` (a peer), and the weighting math is pure and unit-tested in isolation.

```bash
npm i @kutlaytunc/us3-core three
```

## What's in the box

| Export | Role |
| --- | --- |
| `AnimController` | The "AnimGraph": smooths parameters, runs the state machine, evaluates blend spaces + additive layers into clip-weight maps. |
| `MixerDriver` | Applies those weights onto `THREE.AnimationAction`s (`setEffectiveWeight`), bakes additive clips, advances the mixer. |
| `AnimStateMachine` | States, directional transitions, boolean rules, priority, crossfades. |
| `BlendSpace` | 1D bracket / 2D Delaunay-barycentric weighting for a `BlendSpaceDef`. |
| `BlendTriangulation` | The reusable triangulation + barycentric weighter (also used by the editor's grid). |
| `createEmptyAsset`, `createBlendSpace`, `validateAsset` | Asset builders + structural validation. |
| Types | `AnimGraphAsset`, `BlendSpaceDef`, `StateMachineDef`, `RuleExpr`, `ParamDef`, … |

## Usage

```ts
import { AnimController, MixerDriver } from '@kutlaytunc/us3-core'
import * as THREE from 'three'

// `asset` is an AnimGraphAsset (see docs/asset-format.md);
// `clips` are THREE.AnimationClip[] from your glTF (gltf.animations).
const controller = new AnimController(asset)
const driver = new MixerDriver(root, asset, clips)

// every frame:
controller.setParam('speed', velocity / maxSpeed)
controller.update(dt)          // params → state machine → blend space → weight maps
driver.update(controller, dt)  // weights → AnimationActions → mixer.update(dt)
```

`AnimController` holds no three/react state — it only computes weight maps
(`controller.baseWeights`, `controller.additiveWeights`). `MixerDriver` is the one piece that
touches three. You can use the controller entirely headless (tests, servers) and apply its weights
however you like.

## Design notes

- **three is the blend engine.** us3 never evaluates keyframes; it computes per-clip weights
  and calls `setEffectiveWeight`. Base-layer weights are normalized to sum to 1; additive clips are
  baked with `AnimationUtils.makeClipAdditive` and run in `AdditiveAnimationBlendMode`.
- **Blend Space 2D** triangulates its samples (Delaunay) and returns barycentric weights for the
  containing triangle; queries outside the convex hull clamp to the nearest edge, and collinear or
  degenerate layouts fall back to 1D bracketing — so weights are always non-negative and sum to 1.
- **The state machine** evaluates a state's outgoing transitions in priority order; a firing rule
  starts a crossfade the controller realises by blending the two states' sources.

See the [concepts guide](https://github.com/KutlayTunc/us3/blob/main/docs/concepts.md) and the
[asset format](https://github.com/KutlayTunc/us3/blob/main/docs/asset-format.md).

## License

MIT © KutlayTunc
