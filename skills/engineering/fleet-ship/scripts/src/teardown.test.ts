import { describe, expect, test } from "bun:test";
import { BunFileSystem } from "@effect/platform-bun";
import { Cause, Effect, Exit } from "effect";

const failure = (exit: Exit.Exit<unknown, unknown>): any => (Exit.isFailure(exit) ? Cause.squash(exit.cause) : null);
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as HerdrTest from "./herdr/HerdrTest.ts";
import { layer as ledgerLayer } from "./ledger/Ledger.ts";
import { teardown } from "./teardown.ts";
import { event, FIXTURE_LIVE, FIXTURE_TEXT } from "./testing/fixture.ts";

const setup = (text: string) => {
  const dir = mkdtempSync(join(tmpdir(), "fleet-teardown-"));
  const ledger = join(dir, "demo.jsonl");
  writeFileSync(ledger, text);
  const herdr = HerdrTest.make(structuredClone(FIXTURE_LIVE));
  const run = (opts: { execute: boolean }) =>
    Effect.runPromiseExit(
      teardown({ epic: "demo", session: "fleet-demo", archiveDir: join(dir, "runs"), execute: opts.execute }).pipe(
        Effect.provide(ledgerLayer(ledger)),
        Effect.provide(herdr.layer),
        Effect.provide(BunFileSystem.layer),
      ),
    );
  const events = () =>
    readFileSync(ledger, "utf8")
      .split("\n")
      .filter((l) => l.startsWith("{"))
      .map((l) => JSON.parse(l));
  return { dir, ledger, herdr, run, events };
};

describe("teardown dry-run", () => {
  test("plans every open resource, marks closed ones, and never calls herdr", async () => {
    const t = setup(FIXTURE_TEXT);
    const exit = await t.run({ execute: false });
    if (!Exit.isSuccess(exit)) throw new Error(JSON.stringify(failure(exit)));
    const rows = new Map(exit.value.plan.map((r) => [r.id, r]));
    expect(rows.get("w1:p6")?.action).toBe("already-closed");
    expect(rows.get("w1:p7")?.action).toBe("would-capture-and-close");
    expect(rows.get("w1:t2")?.action).toBe("would-close");
    expect(rows.get("fleet-demo")?.action).toBe("would-stop-session");
    expect(exit.value.output).toContain("would-stop-session");
    expect(t.herdr.calls).toHaveLength(0);
  });

  test("rejects a minted subject with an empty id", async () => {
    const t = setup(JSON.stringify(event("fleet.resource.minted", "workspace:", { label: "oops" })) + "\n");
    const exit = await t.run({ execute: false });
    expect(Exit.isFailure(exit)).toBe(true);
    expect(failure(exit)?.message).toContain("empty resource id");
  });
});

describe("teardown execute", () => {
  test("captures, closes panes then tabs then workspaces, stops the session last, and logs it all", async () => {
    const t = setup(FIXTURE_TEXT);
    const exit = await t.run({ execute: true });
    if (!Exit.isSuccess(exit)) throw new Error(JSON.stringify(failure(exit)));
    expect(exit.value.closed).toBe(3);

    const calls = t.herdr.calls;
    expect(calls).toContain("panes.close w1:p7");
    expect(calls).not.toContain("panes.close w1:p6");
    expect(calls.indexOf("panes.close w1:p7")).toBeLessThan(calls.indexOf("tabs.close w1:t2"));
    expect(calls.at(-2)).toBe("sessions.stop fleet-demo");
    expect(calls.at(-1)).toBe("sessions.delete fleet-demo");

    expect(readFileSync(join(t.dir, "runs", "demo.md"), "utf8")).toContain("transcript tail for w0-ffi");

    const closed = new Set(t.events().filter((e) => e.type === "fleet.resource.closed").map((e) => e.subject));
    expect(closed).toEqual(new Set(["pane:w1:p6", "pane:w1:p7", "tab:w1:t2", "session:fleet-demo"]));
    const last = t.events().at(-1);
    expect(last.type).toBe("fleet.run.teardown");
    expect(last.data.closed).toBe(3);
  });

  test("a pane in a workspace herdr no longer knows is gone, not an error", async () => {
    const text = [
      event("fleet.resource.minted", "pane:w9:p1", { label: "w0-lost" }),
      event("fleet.resource.minted", "tab:w1:t2", { label: "fleet:demo" }),
    ]
      .map((e) => JSON.stringify(e))
      .join("\n") + "\n";
    const t = setup(text);
    const exit = await t.run({ execute: true });
    if (!Exit.isSuccess(exit)) throw new Error(JSON.stringify(failure(exit)));
    expect(exit.value.output).toContain("gone   pane       w9:p1");
    const closed = t.events().filter((e) => e.type === "fleet.resource.closed").map((e) => e.subject);
    expect(closed).toContain("pane:w9:p1");
  });

  test("fails with SurvivorsRemain when a recorded pane refuses to die", async () => {
    const t = setup(FIXTURE_TEXT);
    t.herdr.state.stickyPanes.add("w1:p7");
    const exit = await t.run({ execute: true });
    expect(Exit.isFailure(exit)).toBe(true);
    expect(failure(exit)?._tag).toBe("SurvivorsRemain");
    expect(t.herdr.calls).not.toContain("sessions.stop fleet-demo");
  });
});
