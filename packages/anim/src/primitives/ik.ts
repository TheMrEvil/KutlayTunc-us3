// Inverse Kinematics — clean, headless, position-based solvers (no three.js
// dependency). FABRIK for N-joint chains and an analytic two-bone solver, both
// returning joint world positions you then map onto bone rotations. (Binding to a
// specific skeleton's bone axes is the app/visual step.)

type V3 = [number, number, number];

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const dist = (a: V3, b: V3) => len(sub(a, b));
const norm = (a: V3): V3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const clamp = (n: number, lo: number, hi: number) => (n < lo ? lo : n > hi ? hi : n);

/** Rodrigues rotation of `v` around unit `axis` by `ang` radians. */
function rotateAxis(v: V3, axis: V3, ang: number): V3 {
  const c = Math.cos(ang), s = Math.sin(ang);
  const kv = cross(axis, v);
  const kkv = scale(axis, dot(axis, v));
  return add(add(scale(v, c), scale(kv, s)), scale(kkv, 1 - c));
}

/** FABRIK: iteratively solve a chain (root pinned) so the tip reaches `target`.
 *  Returns new joint positions; if unreachable the chain stretches toward target. */
export function solveFabrik(joints: V3[], target: V3, opts?: { iterations?: number; tolerance?: number }): V3[] {
  const n = joints.length;
  const p = joints.map((j) => [...j] as V3);
  if (n < 2) return p;
  const lengths: number[] = [];
  for (let i = 0; i < n - 1; i++) lengths.push(dist(joints[i], joints[i + 1]));
  const total = lengths.reduce((a, b) => a + b, 0);
  const root: V3 = [...joints[0]] as V3;

  if (dist(root, target) >= total) {
    const dir = norm(sub(target, root));
    for (let i = 0; i < n - 1; i++) p[i + 1] = add(p[i], scale(dir, lengths[i]));
    return p;
  }

  const iterations = opts?.iterations ?? 12;
  const tol = opts?.tolerance ?? 1e-3;
  for (let it = 0; it < iterations; it++) {
    p[n - 1] = [...target] as V3;
    for (let i = n - 2; i >= 0; i--) p[i] = add(p[i + 1], scale(norm(sub(p[i], p[i + 1])), lengths[i]));
    p[0] = [...root] as V3;
    for (let i = 0; i < n - 1; i++) p[i + 1] = add(p[i], scale(norm(sub(p[i + 1], p[i])), lengths[i]));
    if (dist(p[n - 1], target) < tol) break;
  }
  return p;
}

/** Analytic two-bone IK (law of cosines + pole). Returns the new mid + tip world
 *  positions; tip reaches `target` when in range, else the chain stretches. */
export function solveTwoBone(root: V3, mid: V3, tip: V3, target: V3, pole?: V3): { mid: V3; tip: V3 } {
  const lab = dist(root, mid);
  const lcb = dist(mid, tip);
  const maxReach = lab + lcb;
  const toTarget = sub(target, root);
  const lat = len(toTarget);
  const dir = norm(toTarget);

  if (lat >= maxReach || lat < 1e-5) {
    return { mid: add(root, scale(dir, lab)), tip: add(root, scale(dir, Math.min(lat, maxReach))) };
  }

  // interior angle at the root from the law of cosines
  const cosRoot = clamp((lab * lab + lat * lat - lcb * lcb) / (2 * lab * lat), -1, 1);
  const rootAngle = Math.acos(cosRoot);

  // bend-plane normal: from the pole vector, else the current configuration
  let normal = pole ? cross(toTarget, sub(pole, root)) : cross(sub(mid, root), sub(tip, root));
  if (len(normal) < 1e-6) normal = cross(toTarget, Math.abs(dir[1]) < 0.99 ? [0, 1, 0] : [1, 0, 0]);
  normal = norm(normal);

  const newMid = add(root, scale(rotateAxis(dir, normal, rootAngle), lab));
  return { mid: newMid, tip: [...target] as V3 };
}
