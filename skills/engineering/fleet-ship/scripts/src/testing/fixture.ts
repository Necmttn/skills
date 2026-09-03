/** Shared test fixture: one small fleet run as CloudEvents records. Test-only. */
import type { FleetEvent } from "../ledger/Event.ts";

export const event = (
  type: string,
  subject: string,
  data: Record<string, unknown> = {},
  time = "2026-09-03T10:00:00Z",
): FleetEvent =>
  ({
    specversion: "1.0",
    id: `id-${type}-${subject}-${time}`,
    source: "fleet/demo/mbp",
    type: type as FleetEvent["type"],
    time,
    subject,
    data,
  });

export const FIXTURE_EVENTS: ReadonlyArray<FleetEvent> = [
  event("fleet.run.started", "demo", { session: "fleet-demo", runmap: "Necmttn/ax#1" }, "2026-09-03T09:00:00Z"),
  event("fleet.policy.set", "routing", { text: "mechanical -> codex" }, "2026-09-03T09:00:01Z"),
  event("fleet.resource.minted", "session:fleet-demo", { label: "fleet-demo" }, "2026-09-03T09:00:02Z"),
  event("fleet.resource.minted", "tab:w1:t2", { label: "fleet:demo" }, "2026-09-03T09:00:03Z"),
  event("fleet.resource.minted", "pane:w1:p6", { label: "w0-prunes" }, "2026-09-03T09:00:04Z"),
  event("fleet.resource.minted", "pane:w1:p7", { label: "w0-ffi" }, "2026-09-03T09:00:05Z"),
  event("fleet.chunk.spawned", "mbp/w0-prunes", { pane: "w1:p6", engine: "codex" }, "2026-09-03T09:01:00Z"),
  event("fleet.chunk.spawned", "mbp/w0-ffi", { pane: "w1:p7", engine: "claude" }, "2026-09-03T09:01:01Z"),
  event("fleet.chunk.built", "mbp/w0-prunes", { commit: "1390e639" }, "2026-09-03T09:30:00Z"),
  event("fleet.attn.opened", "mbp/w0-ffi", { ask: "needs API key" }, "2026-09-03T09:31:00Z"),
  event("fleet.chunk.merged", "mbp/w0-prunes", { pr: "Necmttn/ax#784", gist: "gate PASSED" }, "2026-09-03T09:45:00Z"),
  event("fleet.resource.closed", "pane:w1:p6", {}, "2026-09-03T09:46:00Z"),
];

/** The fixture as a ledger file body, with one malformed line at the end. */
export const FIXTURE_TEXT = FIXTURE_EVENTS.map((e) => JSON.stringify(e)).join("\n") + "\nthis line is not json\n";

/** Live herdr state that matches the fixture: w0-ffi still running, plus a stray pane. */
export const FIXTURE_LIVE = {
  agents: [
    { name: "w0-ffi", pane_id: "w1:p7", agent_status: "idle", tab_id: "w1:t2", workspace_id: "w1" },
    { name: "stray", pane_id: "w1:p9", agent_status: "working", tab_id: "w1:t2", workspace_id: "w1" },
  ],
  panes: { w1: [{ pane_id: "w1:p7" }, { pane_id: "w1:p9" }] },
  tabs: ["w1:t2"],
  workspaces: ["w1"],
  sessions: ["fleet-demo"],
};
