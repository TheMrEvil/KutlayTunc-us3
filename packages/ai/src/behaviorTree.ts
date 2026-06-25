// Behaviour Tree — a clean web/TS take on Unreal's BT. Re-tick from the root each
// frame: composites short-circuit, gate decorators block a branch, modifier
// decorators transform a result, services tick on an interval, and tasks may run
// across frames. Re-evaluation gives reactive selectors (a higher-priority branch
// whose condition becomes true naturally aborts the running lower-priority one).
//
// Shared memory is a plain object (the `Board`): perception/your code writes to it,
// tasks and gate decorators read it. No typed-blackboard class — a JS object is the
// substrate (`board.seesPlayer = true`, `board.targetXZ`, …).

export type BTStatus = 'success' | 'failure' | 'running';

/** The behaviour tree's shared memory: a plain object written by perception/your
 *  code and read by tasks + gate decorators. */
export type Board = Record<string, unknown>;

export interface BTDecorator {
  id: string;
  /** gate: 'blackboard' | 'cooldown' | 'condition' | <custom>; modifier: 'inverter' | 'forceSuccess' | 'loop' */
  type: string;
  params?: Record<string, unknown>;
}
export interface BTService {
  id: string;
  type: string;
  interval?: number;
  params?: Record<string, unknown>;
}

export type BTNode =
  | { id: string; kind: 'selector' | 'sequence' | 'parallel'; name?: string; children: BTNode[]; decorators?: BTDecorator[]; services?: BTService[] }
  | { id: string; kind: 'task'; name?: string; task: string; params?: Record<string, unknown>; decorators?: BTDecorator[]; services?: BTService[] };

/** The editable file shape (`*.behaviour.json`). */
export interface BehaviorTreeData {
  version?: 1;
  root: BTNode;
}

interface NodeState { [k: string]: unknown }
export type TaskImpl = (board: Board, params: Record<string, unknown>, dt: number, state: NodeState) => BTStatus;
export type DecoratorImpl = (board: Board, params: Record<string, unknown>) => boolean;
export type ServiceImpl = (board: Board, params: Record<string, unknown>) => void;

export interface BTContext {
  /** Shared memory — a plain object. Defaults to `{}` if omitted. */
  board?: Board;
  /** App-specific leaf tasks (moveTo, attack, …). Built-ins: succeed, fail, wait, setKey. */
  tasks?: Record<string, TaskImpl>;
  /** Custom gate decorators by name (used by type 'condition' → params.fn, or by type). */
  decorators?: Record<string, DecoratorImpl>;
  /** Custom services by type. Built-in: setKey. */
  services?: Record<string, ServiceImpl>;
}

const GATES = new Set(['blackboard', 'cooldown', 'condition']);

export class BehaviorTreeRunner {
  private states = new Map<string, NodeState>();
  private cooldowns = new Map<string, number>();
  private serviceAcc = new Map<string, number>();
  private active = new Set<string>();
  private clock = 0;
  /** The shared memory object (read/write directly: `runner.board.seesPlayer = true`). */
  readonly board: Board;

  constructor(private data: BehaviorTreeData, private ctx: BTContext = {}) {
    this.board = ctx.board ?? {};
  }

  reset(): void {
    this.states.clear(); this.cooldowns.clear(); this.serviceAcc.clear(); this.active.clear(); this.clock = 0;
  }

  /** Ids of nodes on the currently-running branch (for a live highlight). */
  activeNodes(): string[] { return [...this.active]; }

  tick(dt: number): BTStatus {
    this.clock += dt;
    const prev = new Set(this.active);
    this.active.clear();
    const status = this.tickNode(this.data.root, dt);
    // Nodes that were running last frame but weren't reached this frame are aborted.
    for (const id of prev) if (!this.active.has(id)) this.states.delete(id);
    return status;
  }

  private state(id: string): NodeState {
    let s = this.states.get(id);
    if (!s) { s = {}; this.states.set(id, s); }
    return s;
  }

  private tickNode(node: BTNode, dt: number): BTStatus {
    for (const s of node.services ?? []) this.tickService(s, dt);
    for (const d of node.decorators ?? []) {
      if (GATES.has(d.type) && !this.gatePass(d)) return 'failure';
      if (!GATES.has(d.type) && !['inverter', 'forceSuccess', 'loop'].includes(d.type)) {
        const impl = this.ctx.decorators?.[d.type];
        if (impl && !impl(this.board, d.params ?? {})) return 'failure';
      }
    }
    let status = node.kind === 'task' ? this.tickTask(node, dt) : this.tickComposite(node, dt);
    status = this.applyModifiers(node, status);
    if (status === 'success') {
      for (const d of node.decorators ?? []) {
        if (d.type === 'cooldown') this.cooldowns.set(d.id, this.clock + Number(d.params?.duration ?? 1));
      }
    }
    if (status === 'running') this.active.add(node.id);
    return status;
  }

  private tickComposite(node: BTNode, dt: number): BTStatus {
    if (node.kind === 'task') return 'failure';
    const kids = node.children;
    if (node.kind === 'selector') {
      for (const c of kids) {
        const s = this.tickNode(c, dt);
        if (s !== 'failure') return s; // success or running short-circuits
      }
      return 'failure';
    }
    if (node.kind === 'sequence') {
      for (const c of kids) {
        const s = this.tickNode(c, dt);
        if (s !== 'success') return s; // failure or running short-circuits
      }
      return 'success';
    }
    // simple parallel: first child is the main task; the rest run alongside it.
    let main: BTStatus = 'success';
    kids.forEach((c, i) => { const s = this.tickNode(c, dt); if (i === 0) main = s; });
    return main;
  }

  private tickTask(node: BTNode, dt: number): BTStatus {
    if (node.kind !== 'task') return 'failure';
    const p = node.params ?? {};
    const st = this.state(node.id);
    switch (node.task) {
      case 'succeed': return 'success';
      case 'fail': return 'failure';
      case 'wait': {
        const dur = Number(p.duration ?? 1);
        st.t = ((st.t as number) ?? 0) + dt;
        if ((st.t as number) >= dur) { st.t = 0; return 'success'; }
        return 'running';
      }
      case 'setKey': { this.board[String(p.key ?? '')] = p.value; return 'success'; }
      default: {
        const impl = this.ctx.tasks?.[node.task];
        return impl ? impl(this.board, p, dt, st) : 'failure';
      }
    }
  }

  private applyModifiers(node: BTNode, status: BTStatus): BTStatus {
    for (const d of node.decorators ?? []) {
      if (d.type === 'inverter') {
        if (status === 'success') status = 'failure';
        else if (status === 'failure') status = 'success';
      } else if (d.type === 'forceSuccess') {
        if (status === 'failure') status = 'success';
      } else if (d.type === 'loop' && status === 'success') {
        const count = Number(d.params?.count ?? Infinity);
        const st = this.state(node.id);
        const n = ((st.__loop as number) ?? 0) + 1;
        if (n < count) { st.__loop = n; status = 'running'; }
        else st.__loop = 0;
      }
    }
    return status;
  }

  private gatePass(d: BTDecorator): boolean {
    const p = d.params ?? {};
    if (d.type === 'cooldown') return this.clock >= (this.cooldowns.get(d.id) ?? 0);
    if (d.type === 'condition') {
      const impl = this.ctx.decorators?.[String(p.fn ?? '')] ?? this.ctx.decorators?.[d.id];
      return impl ? impl(this.board, p) : true;
    }
    // blackboard-style key gate against the plain board
    const key = String(p.key ?? '');
    const op = String(p.op ?? 'isSet');
    // A key "is set" when it holds a non-null value (Unreal IsValueSet-style): null clears it.
    if (op === 'isSet') return this.board[key] !== undefined && this.board[key] !== null;
    if (op === 'notSet') return this.board[key] === undefined || this.board[key] === null;
    const v = this.board[key];
    const val = p.value;
    switch (op) {
      case '==': return v === val;
      case '!=': return v !== val;
      case '>': return Number(v) > Number(val);
      case '<': return Number(v) < Number(val);
      case '>=': return Number(v) >= Number(val);
      case '<=': return Number(v) <= Number(val);
      default: return true;
    }
  }

  private tickService(s: BTService, dt: number): void {
    const interval = Number(s.interval ?? 0.5);
    const acc = (this.serviceAcc.get(s.id) ?? 0) + dt;
    if (acc < interval) { this.serviceAcc.set(s.id, acc); return; }
    this.serviceAcc.set(s.id, 0);
    const p = s.params ?? {};
    if (s.type === 'setKey') { this.board[String(p.key ?? '')] = p.value; return; }
    this.ctx.services?.[s.type]?.(this.board, p);
  }
}
