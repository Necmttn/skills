/**
 * Ledger-driven teardown: capture and close every pane the run minted, then tabs, then
 * workspaces, verify nothing recorded survives, then stop and delete the fleet session.
 * Every close appends fleet.resource.closed; the end appends fleet.run.teardown.
 */
import { Data, Effect, FileSystem } from "effect";
import type { PlatformError } from "effect/PlatformError";
import { hostname } from "node:os";
import { join } from "node:path";
import { Herdr, type HerdrCommandFailed } from "./herdr/Herdr.ts";
import { makeEvent, type FleetEvent } from "./ledger/Event.ts";
import { Ledger } from "./ledger/Ledger.ts";

export type ResourceType = "session" | "workspace" | "tab" | "pane" | "agent";
const RESOURCE_TYPES: ReadonlyArray<string> = ["session", "workspace", "tab", "pane", "agent"];

export interface PlanRow {
  readonly type: ResourceType;
  readonly id: string;
  readonly label: string;
  readonly state: "open" | "closed";
  readonly action: "already-closed" | "would-stop-session" | "would-capture-and-close" | "would-close";
}

export class LedgerInvalid extends Data.TaggedError("LedgerInvalid")<{ readonly message: string }> {}
export class SurvivorsRemain extends Data.TaggedError("SurvivorsRemain")<{ readonly survivors: ReadonlyArray<string> }> {}
export class CloseFailed extends Data.TaggedError("CloseFailed")<{ readonly type: string; readonly id: string; readonly cause: HerdrCommandFailed }> {}

export interface TeardownOptions {
  readonly epic: string;
  readonly session: string | null;
  readonly archiveDir: string;
  readonly execute: boolean;
}

export interface TeardownResult {
  readonly plan: ReadonlyArray<PlanRow>;
  readonly output: string;
  readonly closed: number;
}

const actionFor = (type: ResourceType, state: "open" | "closed"): PlanRow["action"] =>
  state === "closed" ? "already-closed"
    : type === "session" ? "would-stop-session"
    : type === "pane" || type === "agent" ? "would-capture-and-close"
    : "would-close";

/** minted minus closed, in first-minted order. Validation failures are LedgerInvalid. */
export const plan = (events: ReadonlyArray<FleetEvent>): Effect.Effect<ReadonlyArray<PlanRow>, LedgerInvalid> =>
  Effect.gen(function* () {
    const rows = new Map<string, { type: ResourceType; id: string; label: string; state: "open" | "closed" }>();
    for (const event of events) {
      if (event.type === "fleet.resource.minted") {
        const at = event.subject.indexOf(":");
        if (at < 0) return yield* new LedgerInvalid({ message: `malformed resource subject: ${event.subject}` });
        const type = event.subject.slice(0, at);
        const id = event.subject.slice(at + 1);
        if (!id) return yield* new LedgerInvalid({ message: `empty resource id: ${event.subject}` });
        if (!RESOURCE_TYPES.includes(type)) return yield* new LedgerInvalid({ message: `unknown resource type: ${type}` });
        const label = String(event.data.label ?? "").replace(/\t/g, " ");
        const existing = rows.get(event.subject);
        rows.set(event.subject, { type: type as ResourceType, id, label, state: existing?.state ?? "open" });
      } else if (event.type === "fleet.resource.closed") {
        const row = rows.get(event.subject);
        if (row) row.state = "closed";
      }
    }
    if (rows.size === 0) return yield* new LedgerInvalid({ message: "ledger contains no fleet.resource.minted events" });
    return [...rows.values()].map((r) => ({ ...r, action: actionFor(r.type, r.state) }));
  });

const pad = (s: string, n: number) => s.padEnd(n);
export const renderPlan = (rows: ReadonlyArray<PlanRow>): string =>
  [`${pad("type", 10)} ${pad("id", 20)} ${pad("label", 28)} action`, ...rows.map((r) => `${pad(r.type, 10)} ${pad(r.id, 20)} ${pad(r.label, 28)} ${r.action}`)].join("\n") + "\n";

export const teardown = (
  opts: TeardownOptions,
): Effect.Effect<TeardownResult, LedgerInvalid | SurvivorsRemain | CloseFailed | HerdrCommandFailed | PlatformError, Herdr | Ledger | FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const ledger = yield* Ledger;
    const herdr = yield* Herdr;
    const fs = yield* FileSystem.FileSystem;
    const { events } = yield* ledger.readAll;
    const rows = yield* plan(events);

    if (!opts.execute) return { plan: rows, output: renderPlan(rows), closed: 0 };

    const out: Array<string> = [];
    const say = (line: string) => out.push(line);
    const source = `fleet/${opts.epic}/${hostname().split(".")[0]}`;
    const log = (type: FleetEvent["type"], subject: string, data: Record<string, unknown> = {}) =>
      ledger.append(makeEvent({ type, subject, data, source }));
    const closedEvent = (type: string, id: string) => log("fleet.resource.closed", `${type}:${id}`);
    let closedCount = 0;

    const capture = (name: string | null, label: string) =>
      Effect.gen(function* () {
        if (!name) return say(`capture skipped: pane has no unique agent name (${label})`);
        const text = yield* herdr.agents.read(name, 400).pipe(Effect.catchTag("HerdrCommandFailed", () => Effect.succeed(null)));
        if (text === null) return say(`capture failed (continuing): ${name}`);
        yield* fs.makeDirectory(opts.archiveDir, { recursive: true });
        yield* fs.writeFileString(join(opts.archiveDir, `${opts.epic}.md`), `## ${label} (teardown capture)\n\n${text}\n\n`, { flag: "a" });
      });

    /** Close by exact id. "closed" | "gone"; any other herdr failure is CloseFailed. */
    const closeExact = (type: Exclude<ResourceType, "session" | "agent">, id: string) =>
      Effect.gen(function* () {
        const call = type === "pane" ? herdr.panes.close(id) : type === "tab" ? herdr.tabs.close(id) : herdr.workspaces.close(id);
        const result = yield* call.pipe(
          Effect.map(() => "closed" as const),
          Effect.catchTag("HerdrNotFound", () => Effect.succeed("gone" as const)),
          Effect.catchTag("HerdrCommandFailed", (cause) => new CloseFailed({ type, id, cause })),
        );
        say(`${result === "closed" ? "closed" : "gone  "} ${pad(type, 10)} ${id}`);
        if (result === "closed") closedCount += 1;
      });

    // 1. panes and agents: resolve, capture, close.
    for (const row of rows.filter((r) => r.type === "pane" || r.type === "agent")) {
      if (row.state === "closed") { say(`skip   ${pad(row.type, 10)} ${row.id} (already closed)`); continue; }
      const agents = yield* herdr.agents.list;
      let paneId: string | null = null;
      let name: string | null = null;
      if (row.type === "agent") {
        const agent = agents.find((a) => a.name === row.id);
        if (agent) { paneId = agent.pane_id; name = agent.name; }
      } else {
        const workspace = row.id.split(":")[0]!;
        const panes = yield* herdr.panes.list(workspace).pipe(Effect.catchTag("HerdrNotFound", () => Effect.succeed([] as ReadonlyArray<{ pane_id: string }>)));
        if (panes.some((p) => p.pane_id === row.id)) {
          paneId = row.id;
          name = agents.find((a) => a.pane_id === row.id)?.name ?? null;
        }
      }
      if (!paneId) { say(`gone   ${pad(row.type, 10)} ${row.id}`); yield* closedEvent(row.type, row.id); continue; }
      yield* capture(name, row.label);
      yield* closeExact("pane", paneId);
      yield* closedEvent(row.type, row.id);
    }

    // 2. containers.
    for (const type of ["tab", "workspace"] as const) {
      for (const row of rows.filter((r) => r.type === type)) {
        if (row.state === "closed") { say(`skip   ${pad(row.type, 10)} ${row.id} (already closed)`); continue; }
        yield* closeExact(type, row.id);
        yield* closedEvent(type, row.id);
      }
    }

    // 3. survivors, checked while the server is still up.
    const agents = yield* herdr.agents.list;
    const livePanes = new Set(agents.map((a) => a.pane_id));
    const liveNames = new Set(agents.map((a) => a.name).filter((n): n is string => !!n));
    const survivors: Array<string> = [];
    for (const row of rows) {
      if (row.type === "pane" && livePanes.has(row.id)) survivors.push(`pane ${row.id}`);
      if (row.type === "agent" && liveNames.has(row.id)) survivors.push(`agent ${row.id}`);
      if (row.type === "pane") {
        const panes = yield* herdr.panes.list(row.id.split(":")[0]!).pipe(Effect.catchTag("HerdrNotFound", () => Effect.succeed([] as ReadonlyArray<{ pane_id: string }>)));
        if (panes.some((p) => p.pane_id === row.id) && !survivors.includes(`pane ${row.id}`)) survivors.push(`pane ${row.id}`);
      }
    }
    if (survivors.length > 0) return yield* new SurvivorsRemain({ survivors });

    // 4. the session goes last: stopping it kills every remaining surface at once.
    for (const row of rows.filter((r) => r.type === "session")) {
      if (row.state === "closed") { say(`skip   ${pad(row.type, 10)} ${row.id} (already closed)`); continue; }
      yield* herdr.sessions.stop(row.id).pipe(
        Effect.catchTag("HerdrNotFound", () => Effect.void),
        Effect.catchTag("HerdrCommandFailed", (cause) => new CloseFailed({ type: "session", id: row.id, cause })),
      );
      yield* herdr.sessions.delete(row.id).pipe(Effect.catch(() => Effect.sync(() => say(`session delete failed (continuing): ${row.id}`))));
      say(`closed ${pad("session", 10)} ${row.id}`);
      yield* closedEvent("session", row.id);
      closedCount += 1;
    }

    yield* log("fleet.run.teardown", opts.epic, { closed: closedCount });
    say(`teardown complete: ${closedCount} closed`);
    return { plan: rows, output: out.join("\n") + "\n", closed: closedCount };
  });
