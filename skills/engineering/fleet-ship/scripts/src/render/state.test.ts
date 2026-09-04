import { describe, expect, test } from "bun:test";
import { fold } from "../ledger/fold.ts";
import { joinRun } from "../run/Run.ts";
import { FIXTURE_GRAPH } from "../testing/graphFixture.ts";
import { render } from "./state.ts";
import { FIXTURE_EVENTS, FIXTURE_LIVE } from "../testing/fixture.ts";

const NOW = new Date("2026-09-03T10:00:00Z");
const row = (text: string, chunk: string) => text.split("\n").find((l) => l.includes(chunk) && l.includes("|"))!;

describe("fold", () => {
  test("stage is the last chunk event per subject and data folds across events", () => {
    const state = fold(FIXTURE_EVENTS);
    expect(state.epic).toBe("demo");
    expect(state.session).toBe("fleet-demo");
    expect(state.chunks.get("mbp/w0-prunes")?.stage).toBe("merged");
    expect(state.chunks.get("mbp/w0-prunes")?.data).toMatchObject({ pane: "w1:p6", commit: "1390e639", pr: "Necmttn/ax#784" });
    expect([...state.resources.keys()]).toEqual(["session:fleet-demo", "tab:w1:t2", "pane:w1:p7"]);
    expect([...state.attn.keys()]).toEqual(["mbp/w0-ffi"]);
    expect(state.policies.get("routing")).toBe("mechanical -> codex");
  });
});

describe("render (ledger only)", () => {
  const text = render({ state: fold(FIXTURE_EVENTS), events: FIXTURE_EVENTS, malformed: 1, tail: 20, now: NOW });

  test("header carries epic, session and the malformed count", () => {
    expect(text).toContain("epic: demo");
    expect(text).toContain("session: fleet-demo");
    expect(text).toContain("malformed: 1");
    expect(text).toContain("mechanical -> codex");
  });

  test("chunk rows show stage and PR; live column is '-' without --live", () => {
    expect(row(text, "w0-prunes")).toContain("merged");
    expect(row(text, "w0-prunes")).toContain("Necmttn/ax#784");
    expect(row(text, "w0-ffi")).toContain("spawned");
    expect(row(text, "w0-ffi")).toContain(" - ");
  });

  test("checklist counts stages and hints the next action", () => {
    expect(text).toContain("merged: 1");
    expect(text).toContain("spawned: 1");
    expect(text).toContain("1 merged -> archive-then-close");
  });

  test("open items list attn and unclosed resources only", () => {
    expect(text).toContain("open attn");
    expect(text).toContain("needs API key");
    const open = text.split("open resources")[1]!.split("action log")[0]!;
    expect(open).toContain("pane:w1:p7");
    expect(open).not.toContain("pane:w1:p6");
  });

  test("action log tail lists the last events", () => {
    const tail = text.split("action log")[1]!;
    expect(tail).toContain("fleet.resource.closed");
  });
});

describe("render (live)", () => {
  const text = render({ state: fold(FIXTURE_EVENTS), events: FIXTURE_EVENTS, malformed: 0, tail: 5, now: NOW, live: FIXTURE_LIVE.agents });

  test("live status merges by pane id and a live pane with no chunk is an orphan", () => {
    expect(row(text, "w0-ffi")).toContain("idle");
    expect(text).toContain("orphan pane w1:p9");
  });

  test("a non-terminal chunk whose pane vanished is gone", () => {
    const events = [...FIXTURE_EVENTS.filter((e) => e.type !== "fleet.chunk.merged")];
    const t = render({ state: fold(events), events, malformed: 0, tail: 5, now: NOW, live: FIXTURE_LIVE.agents });
    expect(t).toContain("gone mbp/w0-prunes pane w1:p6");
  });
});

describe("render (epic mode)", () => {
  const state = fold(FIXTURE_EVENTS);
  const text = render({ state, events: FIXTURE_EVENTS, malformed: 0, tail: 5, now: NOW, run: joinRun(FIXTURE_GRAPH, state) });

  test("chunks are grouped by depth and unstarted graph chunks appear", () => {
    expect(text.indexOf("depth 0")).toBeLessThan(text.indexOf("depth 1"));
    expect(row(text, "w1-ui")).toContain("not started");
    expect(row(text, "w1-ui")).toContain("w0-ffi");
  });
  test("header row has step and blocked-by columns; checklist has the frontier", () => {
    expect(text).toContain("chunk | stage | step | blocked-by | pane | live | engine | pr | age | gist");
    expect(text).toContain("frontier: 2");
  });
  test("without run the legacy layout is unchanged", () => {
    const legacy = render({ state, events: FIXTURE_EVENTS, malformed: 0, tail: 5, now: NOW });
    expect(legacy).toContain("chunk | stage | pane | live | engine | pr | age | gist");
    expect(legacy).not.toContain("depth 0");
  });
});
