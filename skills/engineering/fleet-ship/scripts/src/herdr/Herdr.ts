/**
 * The herdr seam. Shaped like the upcoming `@herdr/sdk` service (agents.*, panes.*, ...),
 * restricted to what the fleet tooling needs. `HerdrCli` implements it over the `herdr`
 * binary today; a `HerdrSdk` layer replaces that without touching anything above.
 */
import { Context, Data, type Effect } from "effect";

export class HerdrNotFound extends Data.TaggedError("HerdrNotFound")<{
  readonly what: string;
  readonly id: string;
}> {}

export class HerdrCommandFailed extends Data.TaggedError("HerdrCommandFailed")<{
  readonly args: ReadonlyArray<string>;
  readonly exitCode: number;
  readonly output: string;
}> {}

export type HerdrError = HerdrNotFound | HerdrCommandFailed;

export interface AgentInfo {
  readonly name: string | null;
  readonly pane_id: string;
  readonly agent_status?: string | undefined;
  readonly tab_id?: string | undefined;
  readonly workspace_id?: string | undefined;
}

export interface PaneInfo {
  readonly pane_id: string;
}

export interface HerdrShape {
  /** The herdr session every call is scoped to; null = the default session. */
  readonly session: string | null;
  readonly agents: {
    readonly list: Effect.Effect<ReadonlyArray<AgentInfo>, HerdrCommandFailed>;
    readonly read: (name: string, lines: number) => Effect.Effect<string, HerdrCommandFailed>;
  };
  readonly panes: {
    readonly list: (workspace: string) => Effect.Effect<ReadonlyArray<PaneInfo>, HerdrError>;
    readonly close: (paneId: string) => Effect.Effect<void, HerdrError>;
  };
  readonly tabs: { readonly close: (tabId: string) => Effect.Effect<void, HerdrError> };
  readonly workspaces: { readonly close: (workspaceId: string) => Effect.Effect<void, HerdrError> };
  readonly sessions: {
    readonly stop: (name: string) => Effect.Effect<void, HerdrError>;
    readonly delete: (name: string) => Effect.Effect<void, HerdrError>;
  };
}

export class Herdr extends Context.Service<Herdr, HerdrShape>()("fleet/Herdr") {}
