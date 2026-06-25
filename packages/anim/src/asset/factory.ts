// Builders + validation for `AnimGraphAsset`. The editor uses these to create
// and verify assets before handing them to the runtime.

import type { AnimGraphAsset, BlendSpaceDef, StateMachineDef } from './types';

/** The default crossfade for a transition that doesn't specify one, in seconds. */
export const DEFAULT_TRANSITION_DURATION = 0.2;

/** A minimal, valid, empty asset with a single empty state machine. */
export function createEmptyAsset(name = 'Untitled'): AnimGraphAsset {
  const entry: StateMachineDef = {
    id: 'sm',
    entry: 'entry',
    states: [
      { id: 'entry', name: 'Entry', source: { kind: 'clip', clip: '' }, position: { x: 0, y: 0 } },
    ],
    transitions: [],
  };
  return {
    version: 1,
    name,
    params: [],
    clips: [],
    blendSpaces: [],
    stateMachine: entry,
    layers: [],
  };
}

/** Create a blank blend space of the given dimensionality with sensible axes. */
export function createBlendSpace(id: string, dimensions: 1 | 2): BlendSpaceDef {
  const axes =
    dimensions === 1
      ? [{ name: 'speed', min: 0, max: 1, divisions: 4 }]
      : [
          { name: 'x', min: -1, max: 1, divisions: 4 },
          { name: 'y', min: -1, max: 1, divisions: 4 },
        ];
  return { id, name: id, dimensions, axes, samples: [] };
}

export interface ValidationIssue {
  level: 'error' | 'warning';
  message: string;
  /** Dotted path into the asset, e.g. `blendSpaces[0].axes`. */
  path?: string;
}

/**
 * Structurally validate an asset and surface referential problems (a sample
 * pointing at a missing clip, a transition pointing at a missing state, an axis
 * count that disagrees with `dimensions`, …). Returns an empty array when valid.
 */
export function validateAsset(asset: AnimGraphAsset): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (message: string, path?: string) => issues.push({ level: 'error', message, path });
  const warn = (message: string, path?: string) => issues.push({ level: 'warning', message, path });

  if (asset.version !== 1) err(`Unsupported asset version: ${asset.version as number}`, 'version');

  const clipNames = new Set(asset.clips.map((c) => c.name));
  const blendIds = new Set(asset.blendSpaces.map((b) => b.id));
  const paramNames = new Set(asset.params.map((p) => p.name));

  // Duplicate ids/names — these silently shadow each other in the runtime's Maps/Sets.
  dupes(asset.clips.map((c) => c.name)).forEach((n) => err(`Duplicate clip name "${n}"`, 'clips'));
  dupes(asset.blendSpaces.map((b) => b.id)).forEach((n) => err(`Duplicate blend space id "${n}"`, 'blendSpaces'));
  dupes(asset.params.map((p) => p.name)).forEach((n) => err(`Duplicate param name "${n}"`, 'params'));
  dupes(asset.stateMachine.states.map((s) => s.id)).forEach((n) => err(`Duplicate state id "${n}"`, 'stateMachine.states'));
  dupes(asset.stateMachine.transitions.map((t) => t.id)).forEach((n) => err(`Duplicate transition id "${n}"`, 'stateMachine.transitions'));

  asset.blendSpaces.forEach((bs, i) => {
    if (bs.axes.length !== bs.dimensions) {
      err(`Blend space "${bs.id}" declares ${bs.dimensions}D but has ${bs.axes.length} axes`, `blendSpaces[${i}].axes`);
    }
    bs.axes.forEach((ax, ai) => {
      if (!paramNames.has(ax.name)) warn(`Blend space axis "${ax.name}" has no matching param`, `blendSpaces[${i}].axes[${ai}]`);
      if (!Number.isFinite(ax.min) || !Number.isFinite(ax.max)) err(`Axis "${ax.name}" has a non-finite bound`, `blendSpaces[${i}].axes[${ai}]`);
      else if (ax.max <= ax.min) err(`Axis "${ax.name}" has max <= min`, `blendSpaces[${i}].axes[${ai}]`);
    });
    bs.samples.forEach((s, si) => {
      if (!clipNames.has(s.clip)) err(`Sample references unknown clip "${s.clip}"`, `blendSpaces[${i}].samples[${si}]`);
      if (s.position.length < bs.dimensions) err(`Sample position has too few coordinates`, `blendSpaces[${i}].samples[${si}]`);
      if (s.position.some((c) => !Number.isFinite(c))) err(`Sample position has a non-finite coordinate`, `blendSpaces[${i}].samples[${si}]`);
    });
    // A 2D blend space needs >= 3 non-collinear samples or its Delaunay triangulation is degenerate
    // (it falls back to a 1D/edge blend, which is rarely what the author intended).
    if (bs.dimensions === 2 && bs.samples.length > 0) {
      if (bs.samples.length < 3) warn(`2D blend space "${bs.id}" has ${bs.samples.length} sample(s); needs >= 3 to triangulate`, `blendSpaces[${i}].samples`);
      else if (allCollinear2D(bs.samples.map((s) => s.position))) warn(`2D blend space "${bs.id}" samples are collinear — triangulation will be degenerate`, `blendSpaces[${i}].samples`);
    }
  });

  const sm = asset.stateMachine;
  const stateIds = new Set(sm.states.map((s) => s.id));
  if (!stateIds.has(sm.entry)) err(`Entry state "${sm.entry}" does not exist`, 'stateMachine.entry');
  sm.states.forEach((s, i) => {
    if (s.source.kind === 'clip') {
      if (s.source.clip && !clipNames.has(s.source.clip)) err(`State "${s.id}" references unknown clip "${s.source.clip}"`, `stateMachine.states[${i}]`);
    } else if (!blendIds.has(s.source.ref)) {
      err(`State "${s.id}" references unknown blend space "${s.source.ref}"`, `stateMachine.states[${i}]`);
    }
  });
  sm.transitions.forEach((t, i) => {
    if (!stateIds.has(t.from)) err(`Transition "${t.id}" has unknown from-state "${t.from}"`, `stateMachine.transitions[${i}]`);
    if (!stateIds.has(t.to)) err(`Transition "${t.id}" has unknown to-state "${t.to}"`, `stateMachine.transitions[${i}]`);
  });

  // Reachability: a state with no path from `entry` can never play (likely an authoring mistake).
  if (stateIds.has(sm.entry)) {
    const adj = new Map<string, string[]>();
    for (const t of sm.transitions) {
      const list = adj.get(t.from) ?? [];
      list.push(t.to);
      adj.set(t.from, list);
    }
    const reached = new Set<string>([sm.entry]);
    const queue = [sm.entry];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const next of adj.get(cur) ?? []) if (!reached.has(next)) { reached.add(next); queue.push(next); }
    }
    sm.states.forEach((s, i) => { if (!reached.has(s.id)) warn(`State "${s.id}" is unreachable from the entry state`, `stateMachine.states[${i}]`); });
  }

  (asset.layers ?? []).forEach((layer, i) => {
    if (layer.source.kind === 'clip') {
      if (!clipNames.has(layer.source.clip)) err(`Layer "${layer.id}" references unknown clip "${layer.source.clip}"`, `layers[${i}]`);
    } else if (!blendIds.has(layer.source.ref)) {
      err(`Layer "${layer.id}" references unknown blend space "${layer.source.ref}"`, `layers[${i}]`);
    }
  });

  return issues;
}

/** Values that appear more than once in `names`. */
function dupes(names: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const n of names) (seen.has(n) ? dup : seen).add(n);
  return [...dup];
}

/** True when every 2D point lies on a single line (or all coincide) — a degenerate triangulation. */
function allCollinear2D(pts: ReadonlyArray<ReadonlyArray<number>>): boolean {
  if (pts.length < 3) return true;
  const [x0, y0] = pts[0];
  let bx = 0, by = 0, found = false;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - x0, dy = pts[i][1] - y0;
    if (Math.hypot(dx, dy) > 1e-7) { bx = dx; by = dy; found = true; break; }
  }
  if (!found) return true; // all coincident
  for (const [x, y] of pts) if (Math.abs((x - x0) * by - (y - y0) * bx) > 1e-7) return false;
  return true;
}
