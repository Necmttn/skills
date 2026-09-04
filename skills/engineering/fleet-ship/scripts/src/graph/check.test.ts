import { describe, expect, test } from "bun:test";
import type { Graph } from "./Graph.ts";
import { checkGraph, conflictsOf, hasErrors } from "./check.ts";

const g = (chunks: Graph["chunks"]): Graph => ({
  version: 1, epic: "demo", repo: "r", plan: { path: "p", sha: "s" }, integration_branch: "epic/demo", chunks,
});
const c = (id: string, deps: Array<string> = [], extra: Partial<Graph["chunks"][number]> = {}) =>
  ({ id, title: id, kind: "impl" as const, lane: "mechanical" as const, deps, acceptance: "ok", ...extra });

describe("checkGraph", () => {
  test("a clean diamond has no findings", () => {
    expect(checkGraph(g([c("a"), c("b", ["a"]), c("c", ["a"]), c("d", ["b", "c"])]))).toEqual([]);
  });
  test("duplicate id is G100", () => {
    const codes = checkGraph(g([c("a"), c("a")])).map((f) => f.code);
    expect(codes).toContain("G100");
  });
  test("bad id charset is G101", () => {
    expect(checkGraph(g([c("A_1")])).map((f) => f.code)).toContain("G101");
  });
  test("dangling dep is G110, dangling conflict is G111, self-conflict is G112", () => {
    const codes = checkGraph(g([c("a", ["zz"], { conflicts: ["yy", "a"] })])).map((f) => f.code);
    expect(codes).toEqual(expect.arrayContaining(["G110", "G111", "G112"]));
  });
  test("a cycle is G120 and names a chunk on the cycle", () => {
    const f = checkGraph(g([c("a", ["c"]), c("b", ["a"]), c("c", ["b"])]));
    expect(f.map((x) => x.code)).toContain("G120");
    expect(["a", "b", "c"] as Array<string | null>).toContain(f.find((x) => x.code === "G120")!.chunk);
  });
  test("a question with impl dependents is warning W200, not an error", () => {
    const f = checkGraph(g([c("q", [], { kind: "question" }), c("a", ["q"])]));
    expect(f).toEqual([{ level: "warning", code: "W200", chunk: "q", message: expect.stringContaining("a") }]);
    expect(hasErrors(f)).toBe(false);
  });
});

describe("conflictsOf", () => {
  test("is symmetric", () => {
    const m = conflictsOf(g([c("a", [], { conflicts: ["b"] }), c("b")]));
    expect([...m.get("a")!]).toEqual(["b"]);
    expect([...m.get("b")!]).toEqual(["a"]);
  });
});
