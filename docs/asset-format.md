# Asset format — `AnimGraphAsset`

You author (by hand or a tool), and the runtime reads, a single plain-JSON `AnimGraphAsset`. It is the contract
between the two; nothing else is needed at runtime besides the glTF that supplies the clips.

```ts
interface AnimGraphAsset {
  version: 1
  name?: string
  params: ParamDef[]
  clips: ClipDef[]
  blendSpaces: BlendSpaceDef[]
  stateMachine: StateMachineDef
  layers?: LayerDef[]
}
```

Validate any asset with `validateAsset(asset)` from `@kutlaytunc/us3-anim` — it reports dangling
references (a sample pointing at a missing clip, a transition pointing at a missing state, an axis
count that disagrees with `dimensions`, …).

---

## `ParamDef`

```ts
interface ParamDef {
  name: string
  type: 'float' | 'bool' | 'enum'
  default: number | boolean | string
  smoothing?: number     // float only — exp-damp stiffness; 0 = instant
  enumValues?: string[]  // enum only
}
```

## `ClipDef`

```ts
interface ClipDef {
  name: string           // unique id within the asset
  clip?: string          // glTF track name; defaults to `name`
  loop?: boolean         // default true; false → play once + clamp
  rateScale?: number     // playback multiplier; default 1
  additive?: boolean     // bake as an additive delta; default false
  additiveRef?: number   // reference frame (seconds) for the delta; default 0
}
```

## `BlendSpaceDef`

```ts
interface BlendSpaceDef {
  id: string
  name?: string
  dimensions: 1 | 2
  axes: BlendAxisDef[]      // length === dimensions
  samples: BlendSampleDef[]
}

interface BlendAxisDef {
  name: string              // must match a param name
  min: number
  max: number
  divisions?: number        // editor grid divisions; default 4
}

interface BlendSampleDef {
  id: string                // stable id for selection
  clip: string              // references a ClipDef.name
  position: number[]        // [x] for 1D, [x, y] for 2D
}
```

An axis `name` is a parameter name: the blend space reads `params[axis.name]` to get its query
coordinate.

## State machine

```ts
interface StateMachineDef {
  id: string
  entry: string             // initial state id
  states: StateDef[]
  transitions: TransitionDef[]
}

interface StateDef {
  id: string
  name?: string
  source: AnimSource
  position?: { x: number; y: number }  // editor graph position
}

type AnimSource =
  | { kind: 'clip'; clip: string }       // references a ClipDef.name
  | { kind: 'blendspace'; ref: string }  // references a BlendSpaceDef.id

interface TransitionDef {
  id: string
  from: string              // state id
  to: string                // state id
  rule: RuleExpr            // fires when true
  duration?: number         // crossfade seconds; default 0.2
  curve?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'  // default 'easeInOut'
  priority?: number         // lower wins when several rules fire; default 0
}
```

### `RuleExpr`

A serializable boolean expression over the parameter bag:

```ts
type RuleExpr =
  | { op: 'true' }
  | { op: 'false' }
  | { op: '>' | '<' | '>=' | '<=' | '==' | '!='; param: string; value: number | string | boolean }
  | { op: 'and' | 'or'; rules: RuleExpr[] }
  | { op: 'not'; rule: RuleExpr }
```

```ts
// speed > 0.1 AND NOT jumping
{ op: 'and', rules: [
  { op: '>', param: 'speed', value: 0.1 },
  { op: 'not', rule: { op: '==', param: 'jumping', value: true } },
]}
```

## `LayerDef`

```ts
interface LayerDef {
  id: string
  name?: string
  source: AnimSource
  weightParam?: string      // drive alpha [0,1] from this float param
  weightRule?: RuleExpr     // …or 0/1 from a boolean rule (takes precedence)
  weightSmoothing?: number  // exp-damp the alpha; default 0
}
```

---

## Example

```json
{
  "version": 1,
  "name": "Soldier Locomotion 2D",
  "params": [
    { "name": "forward", "type": "float", "default": 0, "smoothing": 6 },
    { "name": "strafe",  "type": "float", "default": 0, "smoothing": 6 }
  ],
  "clips": [{ "name": "Idle" }, { "name": "Walk" }, { "name": "Run" }],
  "blendSpaces": [{
    "id": "loco", "name": "Locomotion", "dimensions": 2,
    "axes": [
      { "name": "strafe",  "min": -1, "max": 1, "divisions": 4 },
      { "name": "forward", "min": 0,  "max": 1, "divisions": 4 }
    ],
    "samples": [
      { "id": "s_idle", "clip": "Idle", "position": [0, 0] },
      { "id": "s_walk", "clip": "Walk", "position": [0, 0.5] },
      { "id": "s_run",  "clip": "Run",  "position": [0, 1] }
    ]
  }],
  "stateMachine": {
    "id": "sm", "entry": "idle",
    "states": [
      { "id": "idle", "name": "Idle", "source": { "kind": "clip", "clip": "Idle" } },
      { "id": "move", "name": "Locomotion", "source": { "kind": "blendspace", "ref": "loco" } }
    ],
    "transitions": [
      { "id": "t_go",   "from": "idle", "to": "move", "rule": { "op": ">", "param": "forward", "value": 0.05 }, "duration": 0.18 },
      { "id": "t_stop", "from": "move", "to": "idle", "rule": { "op": "<", "param": "forward", "value": 0.05 }, "duration": 0.25 }
    ]
  }
}
```
