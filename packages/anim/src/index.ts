// @kutlaytunc/us3-anim — headless, R3F-native animation graph over three's AnimationMixer.
// Blend spaces (1D bracket / 2D Delaunay barycentric), a parameter-driven state
// machine, additive layers, and secondary-motion primitives. The blend layer is
// swappable behind @kutlaytunc/us3-core's WeightSolver, so a future drei-native blend space
// can replace BlendSpace without touching the graph.

// ── asset schema (the editable AnimGraphAsset) ──────────────────────────────
export type * from './asset/types';
export { createEmptyAsset, createBlendSpace, validateAsset, DEFAULT_TRANSITION_DURATION } from './asset/factory';
export type { ValidationIssue } from './asset/factory';

// ── blend space (built-in WeightSolver) ─────────────────────────────────────
export { BlendSpace } from './blendspace/blendspace';

// ── state machine ───────────────────────────────────────────────────────────
export { AnimStateMachine } from './statemachine/statemachine';
export type { StateBlend } from './statemachine/statemachine';
export { evalRule } from './statemachine/rules';
export { applyCurve } from './statemachine/curves';

// ── controller (the "AnimGraph") ─────────────────────────────────────────────
export { AnimController } from './controller/controller';
export type { WeightSolverFactory } from './controller/controller';
export type { ClipWeights } from './controller/weights';
export { addClipWeight, normalizeClipWeights } from './controller/weights';

// ── driver (three.js AnimationMixer) ─────────────────────────────────────────
export { MixerDriver } from './driver/mixerDriver';
export type { MixerDriverOptions } from './driver/mixerDriver';

// ── secondary motion ─────────────────────────────────────────────────────────
export { NotifyTrack } from './primitives/notifies';
export type { NotifyEvent, NotifyState, NotifyData, NotifyHandler, NotifyStateHandler } from './primitives/notifies';
export { sampleCurve, CurveSet } from './primitives/animCurves';
export type { CurveKey, AnimCurve } from './primitives/animCurves';
export { solveFabrik, solveTwoBone } from './primitives/ik';
export { RootMotion } from './primitives/rootMotion';
export type { RootDelta } from './primitives/rootMotion';
export { MontagePlayer } from './primitives/montage';
export type { MontageSection, MontageData } from './primitives/montage';
export { calcInertialFloat, Inertializer } from './primitives/inertialization';
export { syncedTime, pickLeader, resolveSync } from './primitives/sync';
export type { SyncRole, SyncMember } from './primitives/sync';
export { Sequence } from './primitives/sequence';
export type { SequenceTrack, SequenceData } from './primitives/sequence';
export { aimYawPitch, LookAtSolver } from './primitives/aim';
export type { AimLimits } from './primitives/aim';
export { groundFeet, FootGrounder } from './primitives/footIK';
export type { FootSample, GroundOptions, GroundResult } from './primitives/footIK';

// ── the swap interface + shared types (re-exported from core) ────────────────
export type { WeightSolver, WeightList, Vec3 } from '@kutlaytunc/us3-core';
