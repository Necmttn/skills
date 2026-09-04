/** In-memory `Herdr` for tests: a close removes the pane from later listings, like real herdr. */
import { Effect, Layer } from "effect";
import { Herdr, HerdrNotFound, type AgentInfo, type HerdrShape, type PaneInfo } from "./Herdr.ts";

export interface TestState {
  agents: Array<AgentInfo>;
  panes: Record<string, Array<PaneInfo>>;
  tabs: Array<string>;
  workspaces: Array<string>;
  sessions: Array<string>;
  /** Panes that accept `close` but never disappear - simulates a survivor. */
  stickyPanes: Set<string>;
}

export interface TestHerdr {
  readonly layer: Layer.Layer<Herdr>;
  readonly calls: Array<string>;
  readonly state: TestState;
}

export const make = (initial: Omit<TestState, "stickyPanes"> & { stickyPanes?: Set<string> }): TestHerdr => {
  const state: TestState = { ...initial, stickyPanes: initial.stickyPanes ?? new Set() };
  const calls: Array<string> = [];
  const record = (line: string) => Effect.sync(() => void calls.push(line));

  const removeFrom = (list: Array<string>, what: string, id: string) =>
    Effect.gen(function* () {
      const at = list.indexOf(id);
      if (at < 0) return yield* new HerdrNotFound({ what, id });
      list.splice(at, 1);
    });

  const shape: HerdrShape = {
    session: initial.sessions[0] ?? null,
    agents: {
      list: record("agents.list").pipe(Effect.map(() => [...state.agents])),
      read: (name, lines) => record(`agents.read ${name} ${lines}`).pipe(Effect.map(() => `transcript tail for ${name}\n`)),
    },
    panes: {
      list: (workspace) =>
        record(`panes.list ${workspace}`).pipe(
          Effect.flatMap(() => {
            const panes = state.panes[workspace];
            return panes ? Effect.succeed([...panes]) : new HerdrNotFound({ what: "workspace", id: workspace });
          }),
        ),
      close: (paneId) =>
        record(`panes.close ${paneId}`).pipe(
          Effect.flatMap(() =>
            Effect.gen(function* () {
              const owner = Object.keys(state.panes).find((ws) => state.panes[ws]!.some((p) => p.pane_id === paneId));
              if (!owner) return yield* new HerdrNotFound({ what: "pane", id: paneId });
              if (state.stickyPanes.has(paneId)) return;
              state.panes[owner] = state.panes[owner]!.filter((p) => p.pane_id !== paneId);
              state.agents = state.agents.filter((a) => a.pane_id !== paneId);
            }),
          ),
        ),
    },
    tabs: { close: (id) => record(`tabs.close ${id}`).pipe(Effect.flatMap(() => removeFrom(state.tabs, "tab", id))) },
    workspaces: { close: (id) => record(`workspaces.close ${id}`).pipe(Effect.flatMap(() => removeFrom(state.workspaces, "workspace", id))) },
    sessions: {
      stop: (name) => record(`sessions.stop ${name}`),
      delete: (name) => record(`sessions.delete ${name}`).pipe(Effect.flatMap(() => removeFrom(state.sessions, "session", name))),
    },
  };
  return { layer: Layer.succeed(Herdr, shape), calls, state };
};
