import { describe, expect, test } from "bun:test";
import { fold } from "../ledger/fold.ts";
import { FIXTURE_EVENTS, event } from "../testing/fixture.ts";
import { FIXTURE_GRAPH } from "../testing/graphFixture.ts";
import { joinRun } from "./Run.ts";

describe("joinRun", () => {
  const view = joinRun(FIXTURE_GRAPH, fold(FIXTURE_EVENTS));

  test("stage comes from the ledger by bare id; unknown chunks are absent from the ledger", () => {
    expect(view.chunks.get("w0-prunes")!.stage).toBe("merged");
    expect(view.chunks.get("w0-prunes")!.subject).toBe("mbp/w0-prunes");
    expect(view.chunks.get("w1-ui")!.stage).toBeNull();
  });
  test("blockedBy lists deps that are not merged; dependents are reverse deps", () => {
    expect(view.chunks.get("w1-ui")!.blockedBy).toEqual(["w0-ffi"]);
    expect(view.chunks.get("w0-prunes")!.dependents).toEqual(["w1-ui", "w1-docs"]);
  });
  test("frontier = unblocked, unstarted, unconflicted; questions are on it but need an answer", () => {
    expect(view.frontier).toEqual(["w1-docs", "q1-name"]);
    expect(view.chunks.get("q1-name")!.needsAnswer).toBe(true);
    expect(view.chunks.get("w1-ui")!.ready).toBe(false);
    expect(view.chunks.get("w1-ui")!.reason).toContain("w0-ffi");
  });
  test("an active conflicting chunk holds the frontier", () => {
    const events = [...FIXTURE_EVENTS, event("fleet.chunk.merged", "mbp/w0-ffi", {}, "2026-09-03T09:50:00Z"), event("fleet.chunk.building", "mbp/w1-docs", { pane: "w1:p3" }, "2026-09-03T09:51:00Z")];
    const v = joinRun(FIXTURE_GRAPH, fold(events));
    expect(v.chunks.get("w1-ui")!.blockedBy).toEqual([]);
    expect(v.chunks.get("w1-ui")!.conflictHolds).toEqual(["w1-docs"]);
    expect(v.chunks.get("w1-ui")!.ready).toBe(false);
    expect(v.frontier).toEqual(["q1-name"]);
  });
  test("a held chunk is still spawnable; holdApproved reflects data", () => {
    const v = joinRun(FIXTURE_GRAPH, fold([...FIXTURE_EVENTS, event("fleet.chunk.merged", "mbp/w0-ffi", {}, "2026-09-03T09:50:00Z")]));
    expect(v.chunks.get("w1-ui")!.ready).toBe(true);
    expect(v.chunks.get("w1-ui")!.holdApproved).toBe(false);
  });
  test("depth is the longest dep path", () => {
    expect(view.chunks.get("w0-prunes")!.depth).toBe(0);
    expect(view.chunks.get("w1-ui")!.depth).toBe(1);
  });
  test("ledger chunks missing from the graph are reported as adhoc", () => {
    const v = joinRun(FIXTURE_GRAPH, fold([...FIXTURE_EVENTS, event("fleet.chunk.building", "mbp/hotfix-1", { adhoc: true })]));
    expect(v.adhoc).toEqual(["mbp/hotfix-1"]);
  });
});
