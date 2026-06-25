// The serialized `AnimGraphAsset` — the on-disk JSON the editor writes and the
// runtime loads. This is the single source of truth shared by `@kutlaytunc/us3-core`,
// `@kutlaytunc/us3-react` and the editor. Keep it plain, JSON-serializable and stable.

/** A named animation source backed by a clip inside the rigged glTF. */
export interface ClipDef {
  /** Unique name within the asset; referenced by samples, states and layers. */
  name: string;
  /** Name of the clip inside the source glTF (`gltf.animations[].name`). Defaults to `name`. */
  clip?: string;
  /** Loop the clip (`THREE.LoopRepeat`) vs play once and clamp. @default true */
  loop?: boolean;
  /** Playback-rate multiplier. @default 1 */
  rateScale?: number;
  /** Pre-bake this clip as an additive delta (for aim/lean/overlay layers). @default false */
  additive?: boolean;
  /** Reference frame for the additive delta, in seconds. @default 0 */
  additiveRef?: number;
}

/** One named axis of a blend space. */
export interface BlendAxisDef {
  name: string;
  min: number;
  max: number;
  /** Editor grid subdivisions for snapping/visuals. @default 4 */
  divisions?: number;
}

/** A clip placed at a coordinate in a blend space's parameter space. */
export interface BlendSampleDef {
  /** Stable id for editor selection. */
  id: string;
  /** Referenced `ClipDef.name`. */
  clip: string;
  /** `[x]` for 1D, `[x, y]` for 2D. */
  position: number[];
}

export interface BlendSpaceDef {
  id: string;
  name?: string;
  dimensions: 1 | 2;
  /** One axis for 1D, two for 2D — `axes.length === dimensions`. */
  axes: BlendAxisDef[];
  samples: BlendSampleDef[];
}

/** A serializable boolean predicate over the parameter bag ("Can Enter Transition"). */
export type RuleExpr =
  | { op: 'true' }
  | { op: 'false' }
  | { op: '>' | '<' | '>=' | '<=' | '==' | '!='; param: string; value: number | string | boolean }
  | { op: 'and' | 'or'; rules: RuleExpr[] }
  | { op: 'not'; rule: RuleExpr };

/** What an animation state (or layer) plays. */
export type AnimSource =
  | { kind: 'clip'; clip: string }
  | { kind: 'blendspace'; ref: string };

export interface StateDef {
  id: string;
  name?: string;
  source: AnimSource;
  /** Editor-only canvas position for the graph node. */
  position?: { x: number; y: number };
}

export type BlendCurve = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';

export interface TransitionDef {
  id: string;
  from: string;
  to: string;
  /** Fires the transition when this evaluates true. */
  rule: RuleExpr;
  /** Crossfade length in seconds. @default 0.2 */
  duration?: number;
  /** @default 'easeInOut' */
  curve?: BlendCurve;
  /** Lower wins when several rules fire at once. @default 0 */
  priority?: number;
}

export interface StateMachineDef {
  id: string;
  /** Initial state id. */
  entry: string;
  states: StateDef[];
  transitions: TransitionDef[];
}

/** An additive/overlay layer applied on top of the base state-machine output. */
export interface LayerDef {
  id: string;
  name?: string;
  source: AnimSource;
  /** Drive the layer alpha [0,1] from this float param. */
  weightParam?: string;
  /** Or drive alpha as a 0/1 from a boolean rule (takes precedence over `weightParam`). */
  weightRule?: RuleExpr;
  /** Exp-damp stiffness for the layer alpha. @default 0 (instant) */
  weightSmoothing?: number;
}

export type ParamType = 'float' | 'bool' | 'enum';

export interface ParamDef {
  name: string;
  type: ParamType;
  default: number | boolean | string;
  /** Exp-damp stiffness for float params (Unreal "interp"). 0 = no smoothing. @default 0 */
  smoothing?: number;
  /** Allowed values for `enum` params. */
  enumValues?: string[];
}

/** The complete animation graph asset. */
export interface AnimGraphAsset {
  version: 1;
  /** Stable unique id — used to reference a graph (e.g. a character's assigned graph) and to
   *  sync edits, independent of the mutable display name. The editor assigns/backfills it. */
  id?: string;
  name?: string;
  params: ParamDef[];
  clips: ClipDef[];
  blendSpaces: BlendSpaceDef[];
  stateMachine: StateMachineDef;
  layers?: LayerDef[];
}

/** A live parameter value. */
export type ParamValue = number | boolean | string;

/** A bag of parameter values keyed by name. */
export type ParamBag = Record<string, ParamValue>;
