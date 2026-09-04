import { describe, expect, test } from "bun:test";
import { fold } from "./fold.ts";
import { event, FIXTURE_EVENTS, RETRY_EVENTS } from "../testing/fixture.ts";

describe("fold - attempts, step, interrupted, evidence, landed", () => {
  const chunk = fold(RETRY_EVENTS).chunks.get("mbp/w1-ui")!;

  test("two attempts: initial, then gate_failed; the block does not open a third", () => {
    expect(chunk.attempts.map((a) => [a.n, a.cause])).toEqual([[1, "initial"], [2, "gate_failed"]]);
  });
  test("attempt 1 ends at its built with reported evidence; attempt 2 ends at built with asserted default", () => {
    expect(chunk.attempts[0]).toMatchObject({ started: "2026-09-03T09:02:00Z", ended: "2026-09-03T09:20:00Z", terminal: "built", evidence: "reported" });
    expect(chunk.attempts[1]).toMatchObject({ started: "2026-09-03T09:31:00Z", ended: "2026-09-03T10:00:00Z", terminal: "built", evidence: "asserted" });
    expect(chunk.attempts[1]!.pane).toBe("w1:p8");
  });
  test("step is the last step logged in the current stage and clears on a stage change without a step", () => {
    expect(chunk.step).toBeNull(); // merged event carried no step
    const mid = fold(RETRY_EVENTS.slice(0, 10)).chunks.get("mbp/w1-ui")!;
    expect(mid.stage).toBe("in_review");
    expect(mid.step).toBe("codex-review");
  });
  test("blocked remembers the interrupted stage and clears it on return", () => {
    const blocked = fold(RETRY_EVENTS.slice(0, 7)).chunks.get("mbp/w1-ui")!;
    expect(blocked.stage).toBe("blocked");
    expect(blocked.interrupted).toBe("building");
    expect(chunk.interrupted).toBeNull();
  });
  test("evidence of the last evidence-bearing stage is kept, default asserted", () => {
    expect(chunk.evidence).toBe("verified");
    expect(fold(FIXTURE_EVENTS).chunks.get("mbp/w0-prunes")!.evidence).toBe("asserted");
  });
  test("run.landed is recorded", () => {
    expect(fold(RETRY_EVENTS).landed).toEqual({ time: "2026-09-03T11:00:00Z", pr: "Necmttn/ax#801", commit: "ccc333" });
    expect(fold(FIXTURE_EVENTS).landed).toBeNull();
  });
  test("the original fixture still folds the same", () => {
    const s = fold(FIXTURE_EVENTS);
    expect(s.chunks.get("mbp/w0-prunes")?.stage).toBe("merged");
    expect(s.chunks.get("mbp/w0-ffi")?.attempts).toEqual([]);
  });
  test("a repeated building event while an attempt is open does not push a new attempt", () => {
    const s = fold([...RETRY_EVENTS.slice(0, 3), event("fleet.chunk.building", "mbp/w1-ui", { step: "tdd-green" }, "2026-09-03T09:10:00Z")]);
    const repeated = s.chunks.get("mbp/w1-ui")!;
    expect(repeated.attempts.length).toBe(1);
    expect(repeated.step).toBe("tdd-green");
  });
});
