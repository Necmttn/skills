import { describe, expect, test } from "bun:test";
import { Result } from "effect";
import { parseGraph, holdOf } from "./Graph.ts";

const MIN = {
  version: 1, epic: "demo", repo: "Necmttn/ax",
  plan: { path: "docs/superpowers/plans/demo.md", sha: "abc1234" },
  integration_branch: "epic/demo",
  chunks: [
    { id: "a1", title: "A1", kind: "impl", lane: "mechanical", deps: [], acceptance: "tests green" },
    { id: "b1", title: "B1", kind: "impl", lane: "judgment", deps: ["a1"], conflicts: ["a1"], hold: "human", areas: ["web"], acceptance: "x", plan_ref: "Task B1" },
  ],
};

describe("parseGraph", () => {
  test("decodes a minimal graph and defaults optional fields", () => {
    const r = parseGraph(JSON.stringify(MIN));
    expect(Result.isSuccess(r)).toBe(true);
    if (!Result.isSuccess(r)) return;
    expect(r.success.chunks).toHaveLength(2);
    expect(holdOf(r.success.chunks[0]!)).toBeNull();
    expect(holdOf(r.success.chunks[1]!)).toBe("human");
  });

  test("rejects non-JSON with a reason", () => {
    const r = parseGraph("{not json");
    expect(Result.isFailure(r)).toBe(true);
    if (Result.isFailure(r)) expect(r.failure).toContain("not JSON");
  });

  test("rejects an unknown kind", () => {
    const bad = { ...MIN, chunks: [{ ...MIN.chunks[0], kind: "feature" }] };
    const r = parseGraph(JSON.stringify(bad));
    expect(Result.isFailure(r)).toBe(true);
    if (Result.isFailure(r)) expect(r.failure).toContain("kind");
  });

  test("rejects version 2", () => {
    const r = parseGraph(JSON.stringify({ ...MIN, version: 2 }));
    expect(Result.isFailure(r)).toBe(true);
  });

  test("accepts design-plan, copy, and computer-use lanes and rejects unknown lanes", () => {
    const extended = {
      ...MIN,
      chunks: [
        { id: "p1", title: "Plan", kind: "impl", lane: "design-plan", deps: [], acceptance: "approved" },
        { id: "c1", title: "Copy", kind: "impl", lane: "copy", deps: ["p1"], acceptance: "reviewed" },
        { id: "u1", title: "Sim QA", kind: "verify", lane: "computer-use", deps: ["c1"], acceptance: "smoke green" },
      ],
    };
    expect(Result.isSuccess(parseGraph(JSON.stringify(extended)))).toBe(true);
    const badLane = { ...MIN, chunks: [{ ...MIN.chunks[0], lane: "grok" }] };
    expect(Result.isFailure(parseGraph(JSON.stringify(badLane)))).toBe(true);
  });
});
