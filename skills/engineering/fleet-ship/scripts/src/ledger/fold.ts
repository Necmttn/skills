/** Fold a ledger's events into the run's current state. Pure. */
import type { FleetData, FleetEvent } from "./Event.ts";
import { causeFor, EVIDENCE_STAGES, RETURNS_TO_BUILDING, type Cause } from "./transitions.ts";

export interface Attempt {
  n: number;
  cause: Cause;
  pane: string | null;
  engine: string | null;
  started: string | null;
  ended: string | null;
  /** The stage that ended the attempt: built or error. */
  terminal: string | null;
  evidence: string | null;
}

export interface ChunkState {
  stage: string;
  time: string | null;
  data: Record<string, unknown>;
  step: string | null;
  interrupted: string | null;
  attempts: Array<Attempt>;
  evidence: string | null;
}

export interface RunState {
  epic: string | null;
  session: string | null;
  runmap: string | null;
  kanban: string | null;
  policies: Map<string, string>;
  cursor: FleetData | null;
  chunks: Map<string, ChunkState>;
  attn: Map<string, { ask: string; time: string | null }>;
  resources: Map<string, { label: string; time: string | null }>;
  last: string | null;
  teardown: string | null;
  landed: { time: string | null; pr: string | null; commit: string | null } | null;
}

const str = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
const SIDE = new Set(["blocked", "error"]);

const newChunk = (): ChunkState => ({ stage: "?", time: null, data: {}, step: null, interrupted: null, attempts: [], evidence: null });

const applyChunkEvent = (chunk: ChunkState, stage: string, data: FleetData, when: string | null): void => {
  const prev = chunk.stage === "?" ? null : chunk.stage;
  const effectiveFrom = prev && SIDE.has(prev) ? chunk.interrupted : prev;
  const prevData = { ...chunk.data };

  // interrupted bookkeeping
  if (SIDE.has(stage)) {
    if (!(prev && SIDE.has(prev))) chunk.interrupted = prev;
  } else {
    chunk.interrupted = null;
  }

  // attempts
  const open = chunk.attempts.at(-1);
  const isOpen = open !== undefined && open.ended === null;
  if (stage === "building" && !isOpen) {
    const cause: Cause = effectiveFrom && RETURNS_TO_BUILDING.has(effectiveFrom) ? causeFor(effectiveFrom, prevData, data) : causeFor(null, prevData, data);
    chunk.attempts.push({
      n: chunk.attempts.length + 1,
      cause,
      pane: str(data.pane) ?? str(chunk.data.pane),
      engine: str(data.engine) ?? str(chunk.data.engine),
      started: when,
      ended: null,
      terminal: null,
      evidence: null,
    });
  } else if ((stage === "built" || stage === "error") && isOpen && open) {
    open.ended = when;
    open.terminal = stage;
    open.evidence = stage === "built" ? (str(data.evidence) ?? "asserted") : null;
    if (!open.pane) open.pane = str(chunk.data.pane);
    if (!open.engine) open.engine = str(chunk.data.engine);
  }

  // evidence
  if (EVIDENCE_STAGES.has(stage)) {
    const evidence = str(data.evidence) ?? "asserted";
    chunk.evidence = evidence;
    if (!("evidence" in data)) data = { ...data, evidence };
  }

  // step: explicit wins; a stage change without a step clears it
  if (str(data.step)) chunk.step = str(data.step);
  else if (stage !== prev) chunk.step = null;

  chunk.stage = stage;
  chunk.time = when;
  Object.assign(chunk.data, data);
};

export const fold = (events: ReadonlyArray<FleetEvent>): RunState => {
  const state: RunState = {
    epic: null, session: null, runmap: null, kanban: null,
    policies: new Map(), cursor: null, chunks: new Map(), attn: new Map(), resources: new Map(),
    last: null, teardown: null, landed: null,
  };
  for (const event of events) {
    const { type, subject, data } = event;
    const when = event.time || null;
    state.last = when ?? state.last;
    if (type === "fleet.run.started") {
      state.epic = subject || state.epic;
      state.session = str(data.session) ?? state.session;
      state.runmap = str(data.runmap) ?? state.runmap;
      state.kanban = str(data.kanban) ?? state.kanban;
    } else if (type === "fleet.run.teardown") {
      state.teardown = when;
    } else if (type === "fleet.run.landed") {
      state.landed = { time: when, pr: str(data.pr), commit: str(data.commit) };
    } else if (type === "fleet.policy.set") {
      state.policies.set(subject, str(data.text) ?? JSON.stringify(data));
    } else if (type === "fleet.cursor.advanced") {
      state.cursor = data;
    } else if (type === "fleet.resource.minted") {
      state.resources.set(subject, { label: str(data.label) ?? "", time: when });
      if (subject.startsWith("session:") && !state.session) state.session = subject.slice("session:".length);
    } else if (type === "fleet.resource.closed") {
      state.resources.delete(subject);
    } else if (type === "fleet.attn.opened") {
      state.attn.set(subject, { ask: str(data.ask) ?? "", time: when });
    } else if (type === "fleet.attn.closed") {
      state.attn.delete(subject);
    } else if (type.startsWith("fleet.chunk.")) {
      const chunk = state.chunks.get(subject) ?? newChunk();
      applyChunkEvent(chunk, type.slice("fleet.chunk.".length), data, when);
      state.chunks.set(subject, chunk);
    }
  }
  return state;
};

/** The bare chunk id of a ledger subject `<slug>/<id>`. */
export const bareId = (subject: string): string => subject.split("/").at(-1) ?? subject;
