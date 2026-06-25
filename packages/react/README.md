# @kutlaytunc/us3-react

> React Three Fiber bindings for [us3](https://github.com/KutlayTunc/us3).

```bash
npm i @kutlaytunc/us3-react @kutlaytunc/us3-core three @react-three/fiber @react-three/drei
```

## Exports

### `<AnimatedCharacter>`

Loads a rigged glTF, clones it (skeleton-safe), and drives an `AnimController` over its clips.

```tsx
import { AnimatedCharacter } from '@kutlaytunc/us3-react'

<AnimatedCharacter
  url="/Soldier.glb"        // rigged glTF whose animations back the asset's clips
  asset={locomotionAsset}   // an AnimGraphAsset
  params={{ speed }}        // applied every frame
  paused={isEditor}         // freeze the controller + mixer
  position={[0, 0, 0]}      // …plus any <group> props
/>
```

### `useAnimGraph(root, asset, clips, options?)`

The lower-level hook behind `<AnimatedCharacter>`: binds an `AnimController` + `MixerDriver` to a
model you've already loaded and ticks them each frame. Returns `{ controller, driver }`.

```tsx
const { scene, animations } = useGLTF(url)
const { controller } = useAnimGraph(scene, asset, animations, {
  paused,
  onFrame: (c) => c.setParam('speed', speed),
})
```

### `applyMovement(controller, signals, options?)`

A standalone bridge that maps per-frame locomotion signals onto controller parameters. It works
out of the box with `@activatebilisim/npc`'s `Movement` (which exposes `speed` / `turnRate` /
`lean` / `anim`), but takes any object of that shape — us3 never hard-depends on an NPC lib.

```tsx
useAnimGraph(model, asset, clips, {
  onFrame: (c) => applyMovement(c, npc.movement, { maxSpeed: npc.agent.maxSpeed }),
})
```

### `useAnimController(asset)`

Create + memoize an `AnimController` without binding it to a model (for custom rigs / previews).

## License

MIT © KutlayTunc
