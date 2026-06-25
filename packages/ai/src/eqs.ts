// EQS (Environment Query System) — a clean web/TS take on Unreal's EQS. A pure,
// side-effect-free spatial query: a Generator emits candidate points, ordered Tests
// filter + score them, and a run mode picks winners. Used to answer "where should
// the AI go?" (cover, flank, strafe). Consumes a small EvalCtx (querier + named
// contexts + optional raycast for line-of-sight).

export type Vec3 = [number, number, number];

export interface QueryItem {
  point: Vec3;
  score: number;
  passed: boolean;
  actorId?: string;
}

export interface EqsCtx {
  /** the asking agent's world position */
  querier: Vec3;
  /** named reference frames (e.g. { target: [[x,y,z]] }); falls back to querier */
  contexts?: Record<string, Vec3[]>;
  /** true if the segment from→to is blocked (no line of sight) */
  raycast?: (from: Vec3, to: Vec3) => boolean;
  /** nav path length from→to (e.g. via NavGrid/findPath), or null if unreachable */
  pathLength?: (from: Vec3, to: Vec3) => number | null;
}

export type GeneratorSpec =
  | { type: 'grid'; around?: string; halfExtent: number; spacing: number }
  | { type: 'circle'; around?: string; radius: number; count: number }
  | { type: 'donut'; around?: string; inner: number; outer: number; rings: number; perRing: number }
  | { type: 'actors'; context: string };

export interface TestSpec {
  type: 'distance' | 'dot' | 'trace' | 'pathfinding';
  purpose: 'filter' | 'score' | 'both';
  /** reference context for distance/dot (default 'querier') */
  context?: string;
  /** explicit direction for dot (else uses querier→context) */
  direction?: Vec3;
  filter?: { min?: number; max?: number; wantHit?: boolean };
  score?: { equation?: 'linear' | 'inverse' | 'square' | 'constant'; weight?: number; normalize?: 'absolute' | 'relative'; reference?: number };
}

export interface EnvQueryData {
  version?: 1;
  name?: string;
  runMode?: 'best' | 'bestN' | 'random';
  n?: number;
  generator: GeneratorSpec;
  tests: TestSpec[];
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const dist = (a: Vec3, b: Vec3) => len(sub(a, b));
const norm = (a: Vec3): Vec3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

function ctxPoint(ctx: EqsCtx, name?: string): Vec3 {
  if (!name || name === 'querier') return ctx.querier;
  return ctx.contexts?.[name]?.[0] ?? ctx.querier;
}

function generate(g: GeneratorSpec, ctx: EqsCtx): QueryItem[] {
  const mk = (p: Vec3, actorId?: string): QueryItem => ({ point: p, score: 0, passed: true, actorId });
  if (g.type === 'actors') return (ctx.contexts?.[g.context] ?? []).map((p, i) => mk(p, `${g.context}_${i}`));
  const c = ctxPoint(ctx, g.around);
  const out: QueryItem[] = [];
  if (g.type === 'grid') {
    for (let x = -g.halfExtent; x <= g.halfExtent + 1e-6; x += g.spacing)
      for (let z = -g.halfExtent; z <= g.halfExtent + 1e-6; z += g.spacing)
        out.push(mk([c[0] + x, c[1], c[2] + z]));
  } else if (g.type === 'circle') {
    for (let i = 0; i < g.count; i++) { const a = (i / g.count) * Math.PI * 2; out.push(mk([c[0] + Math.cos(a) * g.radius, c[1], c[2] + Math.sin(a) * g.radius])); }
  } else {
    for (let r = 0; r < g.rings; r++) {
      const radius = g.inner + (g.outer - g.inner) * (g.rings === 1 ? 0 : r / (g.rings - 1));
      for (let i = 0; i < g.perRing; i++) { const a = (i / g.perRing) * Math.PI * 2; out.push(mk([c[0] + Math.cos(a) * radius, c[1], c[2] + Math.sin(a) * radius])); }
    }
  }
  return out;
}

function rawValue(t: TestSpec, item: QueryItem, ctx: EqsCtx): number {
  if (t.type === 'distance') return dist(item.point, ctxPoint(ctx, t.context));
  if (t.type === 'dot') {
    const dir = t.direction ? norm(t.direction) : norm(sub(ctxPoint(ctx, t.context), ctx.querier));
    return dot(norm(sub(item.point, ctx.querier)), dir);
  }
  if (t.type === 'pathfinding') {
    // nav path length from the querier to the item; Infinity if unreachable
    const pl = ctx.pathLength ? ctx.pathLength(ctxPoint(ctx, t.context), item.point) : dist(item.point, ctxPoint(ctx, t.context));
    return pl == null ? Infinity : pl;
  }
  // trace: 1 if line of sight clear, 0 if blocked
  const blocked = ctx.raycast ? ctx.raycast(ctx.querier, item.point) : false;
  return blocked ? 0 : 1;
}

const equationOf = (n: number, eq?: string) => {
  switch (eq) {
    case 'inverse': return 1 - n;
    case 'square': return n * n;
    case 'constant': return 1;
    default: return n; // linear
  }
};

/** Run the query: generate → filter+score per test → sort → select by run mode. */
export function runQuery(data: EnvQueryData, ctx: EqsCtx): QueryItem[] {
  let items = generate(data.generator, ctx);

  for (const t of data.tests) {
    const raws = items.map((it) => rawValue(t, it, ctx));
    // filter
    if (t.purpose !== 'score') {
      items.forEach((it, i) => {
        if (!it.passed) return;
        const r = raws[i];
        if (t.type === 'trace') { if (t.filter) { const hit = r > 0.5; if (t.filter.wantHit !== false ? !hit : hit) it.passed = false; } }
        else {
          if (t.type === 'pathfinding' && !isFinite(r)) it.passed = false; // unreachable
          if (t.filter) { if (t.filter.min != null && r < t.filter.min) it.passed = false; if (t.filter.max != null && r > t.filter.max) it.passed = false; }
        }
      });
    }
    // score
    if (t.purpose !== 'filter' && t.score) {
      const passing = items.filter((it) => it.passed);
      const scoredRaws = passing.map((it) => raws[items.indexOf(it)]).filter((n) => isFinite(n));
      const min = Math.min(...scoredRaws, Infinity);
      const max = Math.max(...scoredRaws, -Infinity);
      const weight = t.score.weight ?? 1;
      items.forEach((it, i) => {
        if (!it.passed) return;
        const raw = raws[i];
        if (!isFinite(raw)) return;
        let n: number;
        if (t.score!.normalize === 'absolute') n = clamp01(raw / (t.score!.reference || 1));
        else n = max > min ? (raw - min) / (max - min) : 1; // relative
        it.score += equationOf(n, t.score!.equation) * weight;
      });
    }
  }

  const passed = items.filter((it) => it.passed).sort((a, b) => b.score - a.score);
  const mode = data.runMode ?? 'best';
  if (mode === 'best') return passed.slice(0, 1);
  if (mode === 'bestN') return passed.slice(0, data.n ?? 5);
  // random among the best N
  const pool = passed.slice(0, data.n ?? 5);
  return pool.length ? [pool[Math.floor(Math.random() * pool.length)]] : [];
}
