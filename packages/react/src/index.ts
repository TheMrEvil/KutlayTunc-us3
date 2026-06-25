// @kutlaytunc/us3-react — React Three Fiber bindings: one hook (or component) per runtime,
// each owning its instance and ticking it in useFrame.

// ── animation ───────────────────────────────────────────────────────────────
export { AnimatedCharacter, preloadCharacter } from './AnimatedCharacter';
export type { AnimatedCharacterProps, AnimatedCharacterHandle } from './AnimatedCharacter';
export { useAnimGraph } from './useAnimGraph';
export type { UseAnimGraphOptions, AnimGraphHandle } from './useAnimGraph';
export { useAnimController } from './useAnimController';
export { applyMovement } from './movement';
export type { MovementSignals, MovementMapOptions } from './movement';

// ── AI (behaviour tree + perception + navigation + EQS) ─────────────────────
export { useBehaviorTree, usePerceptionSystem, useNavMesh, useNavAgent, useEnvQuery, useMontage, useSequence, useLookAt } from './ai';
export { NavMeshDebug, EQSDebug, PerceptionDebug } from './aiDebug';
