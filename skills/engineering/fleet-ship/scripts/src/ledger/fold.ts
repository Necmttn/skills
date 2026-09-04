/** Fold a ledger's events into the run's current state. Pure. */
import type { FleetData, FleetEvent } from "./Event.ts";

export interface ChunkState {
  stage: string;
  time: string | null;
  data: Record<string, unknown>;
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
}

const str = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);

export const fold = (events: ReadonlyArray<FleetEvent>): RunState => {
  const state: RunState = {
    epic: null, session: null, runmap: null, kanban: null,
    policies: new Map(), cursor: null, chunks: new Map(), attn: new Map(), resources: new Map(),
    last: null, teardown: null,
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
      const chunk = state.chunks.get(subject) ?? { stage: "?", time: null, data: {} };
      chunk.stage = type.slice("fleet.chunk.".length);
      chunk.time = when;
      Object.assign(chunk.data, data);
      state.chunks.set(subject, chunk);
    }
  }
  return state;
};
