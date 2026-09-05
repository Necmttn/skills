/** Join graph.json with the folded ledger into the run view (spec section 7.4). Pure. */
import type { Chunk, Graph } from "../graph/Graph.ts";
import { chunkById, conflictsOf } from "../graph/check.ts";
import { bareId, type ChunkState, type RunState } from "../ledger/fold.ts";
import { ACTIVE, MERGED_OR_LATER } from "../ledger/transitions.ts";

export interface ChunkView {
  readonly id: string;
  readonly subject: string | null;
  readonly spec: Chunk;
  readonly state: ChunkState | null;
  readonly stage: string | null;
  readonly blockedBy: ReadonlyArray<string>;
  readonly dependents: ReadonlyArray<string>;
  readonly conflictHolds: ReadonlyArray<string>;
  readonly depth: number;
  readonly ready: boolean;
  readonly needsAnswer: boolean;
  readonly reason: string;
  readonly holdApproved: boolean;
}

export interface RunView {
  readonly chunks: ReadonlyMap<string, ChunkView>;
  readonly frontier: ReadonlyArray<string>;
  /** Ledger subjects whose bare id is not in the graph. */
  readonly adhoc: ReadonlyArray<string>;
}

const isStarted = (stage: string | null) => stage !== null && stage !== "assigned";

export const joinRun = (graph: Graph, state: RunState): RunView => {
  const byId = chunkById(graph);
  const conflicts = conflictsOf(graph);

  const subjects = new Map<string, string>();
  const adhoc: Array<string> = [];
  for (const subject of state.chunks.keys()) {
    const id = bareId(subject);
    if (byId.has(id)) subjects.set(id, subject);
    else adhoc.push(subject);
  }
  const stateOf = (id: string): ChunkState | null => {
    const subject = subjects.get(id);
    return subject ? (state.chunks.get(subject) ?? null) : null;
  };
  const stageOf = (id: string): string | null => stateOf(id)?.stage ?? null;
  const scheduling = graph.scheduling;
  const active = [...state.chunks].filter(([subject, c]) => (c.stage === "assigned" || ACTIVE.has(c.stage)) && byId.get(bareId(subject))?.kind !== "question").length;
  const gateQueue = [...state.chunks.values()].filter((c) => ["built", "in_review", "gated"].includes(c.stage)).length;
  let slots = scheduling ? Math.max(0, scheduling.max_in_flight - active) : Infinity;
  const pause = state.policies.get("spawn-paused");
  const pilot = scheduling?.pilot;
  const pilotPassed = !pilot || stateOf(pilot)?.dogfooded === true;

  const depthMemo = new Map<string, number>();
  const depthOf = (id: string, seen: Set<string> = new Set()): number => {
    const hit = depthMemo.get(id);
    if (hit !== undefined) return hit;
    if (seen.has(id)) return 0;
    seen.add(id);
    const deps = byId.get(id)?.deps ?? [];
    const d = deps.length === 0 ? 0 : 1 + Math.max(...deps.map((dep) => (byId.has(dep) ? depthOf(dep, seen) : 0)));
    depthMemo.set(id, d);
    return d;
  };

  const dependentsOf = (id: string) => graph.chunks.filter((c) => c.deps.includes(id)).map((c) => c.id);

  const chunks = new Map<string, ChunkView>();
  const frontier: Array<string> = [];
  for (const spec of graph.chunks) {
    const st = stateOf(spec.id);
    const stage = st?.stage ?? null;
    const blockedBy = spec.deps.filter((dep) => !stateOf(dep)?.merged);
    const conflictHolds = [...(conflicts.get(spec.id) ?? [])].filter((other) => ACTIVE.has(stageOf(other) ?? ""));
    const started = isStarted(stage) || (!!scheduling && stage === "assigned");
    const done = MERGED_OR_LATER.has(stage ?? "");
    const reasons: Array<string> = [];
    if (done) reasons.push(`already ${stage}`);
    else if (started) reasons.push(`in progress (${stage})`);
    if (blockedBy.length) reasons.push(`waits on ${blockedBy.join(", ")}`);
    if (conflictHolds.length) reasons.push(`conflicts with active ${conflictHolds.join(", ")}`);
    const needsAnswer = spec.kind === "question";
    if (!needsAnswer && !started) {
      if (pause && pause !== "off") reasons.push(`spawn paused: ${pause}`);
      if (scheduling) {
        if (!pilotPassed && spec.id !== pilot) reasons.push(`pilot ${pilot} needs dogfood`);
        if (gateQueue >= scheduling.max_gate_queue) reasons.push(`gate queue full (${gateQueue}/${scheduling.max_gate_queue})`);
        if (slots === 0) reasons.push(`in-flight capacity full (${active}/${scheduling.max_in_flight})`);
        const selectedConflicts = frontier.filter((id) => conflicts.get(spec.id)?.has(id));
        if (selectedConflicts.length) reasons.push(`conflicts with selected ${selectedConflicts.join(", ")}`);
      }
    }
    const ready = reasons.length === 0;
    const view: ChunkView = {
      id: spec.id,
      subject: subjects.get(spec.id) ?? null,
      spec,
      state: st,
      stage,
      blockedBy,
      dependents: dependentsOf(spec.id),
      conflictHolds,
      depth: depthOf(spec.id),
      ready,
      needsAnswer,
      reason: ready ? (needsAnswer ? "ready - needs answer" : "ready") : reasons.join("; "),
      holdApproved: st?.data.hold === "approved",
    };
    chunks.set(spec.id, view);
    if (ready) frontier.push(spec.id);
    if (ready && !needsAnswer) slots--;
  }
  return { chunks, frontier, adhoc };
};
