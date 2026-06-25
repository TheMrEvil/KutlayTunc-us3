// @kutlaytunc/us3-ai — headless, R3F-native game-AI runtime. The brain: a behaviour tree
// orchestrating perception (sight cone / line-of-sight), navmesh path-following,
// and EQS. Navmesh-agnostic — everything talks to @kutlaytunc/us3-core's NavProvider, so the
// built-in grid or a recast navmesh (@kutlaytunc/us3-nav-recast) are interchangeable.

// ── behaviour tree (plain-object board memory) ──────────────────────────────
export { BehaviorTreeRunner } from './behaviorTree';
export type { Board, BTStatus, BTNode, BTDecorator, BTService, BehaviorTreeData, BTContext, TaskImpl, DecoratorImpl, ServiceImpl } from './behaviorTree';

// ── navigation (grid fallback + path follower) ──────────────────────────────
export { NavGrid, findPath, isReachable, PathFollower } from './navigation';
export type { NavObstacle, NavGridData } from './navigation';

// ── perception (sight / line-of-sight / hearing) ────────────────────────────
export { PerceptionSystem } from './perception';
export type { SenseType, SightConfig, PerceptionConfig, Pose, Stimulus, RaycastFn } from './perception';

// ── EQS (scored environment queries) ────────────────────────────────────────
export { runQuery } from './eqs';
export type { QueryItem, EqsCtx, GeneratorSpec, TestSpec, EnvQueryData } from './eqs';

// ── the navmesh interface + shared types (re-exported from core) ────────────
export type { NavProvider, NavPoint, Vec3 } from '@kutlaytunc/us3-core';
