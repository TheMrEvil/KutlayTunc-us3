<div align="center">

# us3

**Game-engine-style editor & animation runtime for React Three Fiber**

[GitHub](https://github.com/KutlayTunc/us3) ·
[`@kutlaytunc/us3-core`](https://www.npmjs.com/package/@kutlaytunc/us3-core) ·
[`@kutlaytunc/us3-react`](https://www.npmjs.com/package/@kutlaytunc/us3-react) ·
[`@kutlaytunc/us3-editor-ui`](https://www.npmjs.com/package/@kutlaytunc/us3-editor-ui)

![The us3 editor](https://raw.githubusercontent.com/KutlayTunc/us3/main/docs/images/editor.png)

</div>

> ⚠️ **Pre-alpha.** APIs will change. Built in the open.

---

three.js gives the web an excellent low-level animation engine (`AnimationMixer`, clips, additive
blending) and React Three Fiber makes scenes a joy to build — but there's no **authoring layer** on
top: no blend spaces, no animation state machines, no visual scene editor. us3 is that layer.

This `us3` package is the **umbrella**: it re-exports the headless runtime
([`@kutlaytunc/us3-core`](https://www.npmjs.com/package/@kutlaytunc/us3-core)) and the React Three Fiber bindings
([`@kutlaytunc/us3-react`](https://www.npmjs.com/package/@kutlaytunc/us3-react)) so a single install gets you the
whole runtime. The visual editor ships separately as
[`@kutlaytunc/us3-editor-ui`](https://www.npmjs.com/package/@kutlaytunc/us3-editor-ui).

## Install

```bash
npm i us3 three @react-three/fiber @react-three/drei
```

`three`, `@react-three/fiber` and `@react-three/drei` are peer dependencies — you supply one deduped
copy.

## Quick start

```tsx
import { Canvas } from '@react-three/fiber'
import { AnimatedCharacter, type AnimGraphAsset } from 'us3'

const locomotion: AnimGraphAsset = {
  version: 1,
  params: [{ name: 'speed', type: 'float', default: 0, smoothing: 6 }],
  clips: [{ name: 'Idle' }, { name: 'Walk' }, { name: 'Run' }],
  blendSpaces: [{
    id: 'loco', dimensions: 1,
    axes: [{ name: 'speed', min: 0, max: 1 }],
    samples: [
      { id: 'a', clip: 'Idle', position: [0] },
      { id: 'b', clip: 'Walk', position: [0.5] },
      { id: 'c', clip: 'Run',  position: [1] },
    ],
  }],
  stateMachine: { id: 'sm', entry: 'move', states: [{ id: 'move', source: { kind: 'blendspace', ref: 'loco' } }], transitions: [] },
}

// `speed` 0 → 1 blends idle → walk → run on a rigged glTF. That's the whole runtime.
const Character = ({ speed }: { speed: number }) =>
  <AnimatedCharacter url="/Soldier.glb" asset={locomotion} params={{ speed }} />
```

The runtime never re-implements keyframe math — `AnimationMixer` is the blend engine. us3 only
computes, every frame, **how much weight each clip should have** and writes those weights via
`setEffectiveWeight`:

```
parameters ──▶ AnimStateMachine ──▶ BlendSpace ──▶ weight map ──▶ AnimationMixer ──▶ pose
```

## What's in the box

| Re-exported from | What it is |
| --- | --- |
| [`@kutlaytunc/us3-core`](https://www.npmjs.com/package/@kutlaytunc/us3-core) | Headless runtime: blend spaces (1D/2D Delaunay), state machine, controller, the `AnimationMixer` driver, the asset schema. Zero runtime deps. |
| [`@kutlaytunc/us3-react`](https://www.npmjs.com/package/@kutlaytunc/us3-react) | R3F bindings: `<AnimatedCharacter>`, `useAnimGraph`, `useAnimController`, a movement-signal bridge. |

The visual editor (live R3F viewport, outliner, 2D blend-space grid, state-machine node graph) is the
separate [`@kutlaytunc/us3-editor-ui`](https://www.npmjs.com/package/@kutlaytunc/us3-editor-ui) package, and runs
standalone or as a VS Code extension.

## Documentation

Full docs, roadmap and changelog live on [GitHub](https://github.com/KutlayTunc/us3).

## License

[MIT](https://github.com/KutlayTunc/us3/blob/main/LICENSE) © KutlayTunc
