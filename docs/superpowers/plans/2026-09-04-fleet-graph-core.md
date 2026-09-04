# Fleet Graph Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the fleet's dependency graph and per-chunk state machine data that `fleet.ts` validates, folds, and renders, so `fleet next`, `fleet status`, `fleet state`, and `fleet stats` answer "what is done, what is next, what is stuck" from an epic directory.

**Architecture:** A plan-only `graph.json` per epic plus the existing JSONL CloudEvents ledger are joined by one pure fold into a run view. `fleet log` gains a transition guard driven by a static table and a workflow template. Every command takes an epic directory under the fleet home; the old single-ledger-file form keeps working unchanged for the `forge-web` run in flight. No git, no GitHub, no herdr calls are added in this chunk.

**Tech Stack:** Bun, TypeScript 5.9 strict, `effect` 4.0.0-rc.112 (`Schema`, `FileSystem`, `effect/unstable/cli`), `@effect/platform-bun`, `bun:test`.

**Spec:** `docs/specs/2026-09-04-fleet-graph-visibility-design.md` - sections 4, 5, 6, 7, 16 (rollout chunk 1). Read it first. This plan implements chunk 1 only; chunks 2 to 4 get their own plans.

## Global Constraints

- All work happens in the worktree `.claude/worktrees/fleet-graph-visibility` on branch `spec/fleet-graph-visibility`. An ax hook blocks writes on `main`.
- Scripts root: `skills/engineering/fleet-ship/scripts`. Run tests with `bun run --cwd skills/engineering/fleet-ship/scripts test` and typecheck with `bun run --cwd skills/engineering/fleet-ship/scripts typecheck`. **Never** `bun --cwd <dir> run test` (flag before `run`): it prints usage and exits 0 without running anything. Never bare `bun test` from another package's cwd.
- Baseline before Task 1: 35 tests pass across 7 files, `tsc --noEmit` clean. Every task ends with both green.
- Effect v4 style as in the existing files: `Context.Service`, `Layer`, `Effect.gen`, `Result` for pure parsing, `Schema.decodeUnknownResult`. Pure modules never import `node:fs` or `Bun`. Runtime globals (`process.env`, `hostname`) only in `fleet.ts` and `src/cli/epic.ts`.
- `tsconfig` has `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`. Use `Schema.optionalKey` for optional JSON fields and `!`-free index access with `?? ` fallbacks.
- Exit codes: 0 ok, 1 external failure, 2 usage or invalid input. `UsageError` maps to 2.
- Subjects in the ledger are `<slug>/<chunk-id>`. Graph ids are bare `[a-z0-9-]+`. Join by the bare id: `subject.split("/").at(-1)`.
- Stage vocabulary, exact: `assigned spawned planned building built in_review gated merged dogfooded archived closed` plus side states `blocked error`.
- Evidence vocabulary, exact: `verified reported asserted`. Missing on `built`, `gated`, `merged` means `asserted`.
- Commit after every task with a conventional message. Do not push.

---

## File structure

Create:

- `scripts/workflow.json` - the per-chunk step template (spec 7.3), data only.
- `scripts/src/graph/Graph.ts` - Schema + `parseGraph` for `graph.json`; the `Chunk` and `Graph` types.
- `scripts/src/graph/check.ts` - pure structural checks; `Finding` type; `conflictsOf`.
- `scripts/src/graph/Graph.test.ts`, `scripts/src/graph/check.test.ts`.
- `scripts/src/workflow/Workflow.ts` - Schema + `parseWorkflow`, `stepsFor`, `hasStep`.
- `scripts/src/workflow/Workflow.test.ts`.
- `scripts/src/ledger/transitions.ts` - the stage table, `allowedTargets`, `isAllowed`, `causeFor`, stage sets.
- `scripts/src/ledger/transitions.test.ts`.
- `scripts/src/cli/epic.ts` - epic directory resolution and the machine slug.
- `scripts/src/run/Run.ts` - `joinRun(graph, state)` → `RunView` (readiness, frontier, depth, blockers, dependents, conflicts).
- `scripts/src/run/Run.test.ts`.
- `scripts/src/run/stats.ts` - `computeStats(graph, events)` pure.
- `scripts/src/run/stats.test.ts`.
- `scripts/src/render/next.ts`, `scripts/src/render/status.ts`, `scripts/src/render/stats.ts`.
- `scripts/src/render/next.test.ts`, `scripts/src/render/status.test.ts`.
- `scripts/src/testing/graphFixture.ts` - the demo graph and an epic-dir writer for tests.

Modify:

- `scripts/src/ledger/fold.ts` - `step`, `interrupted`, attempts, evidence default, `landed`.
- `scripts/src/ledger/Ledger.ts` - `layerDir(dir, slug)` reading every `ledger.*.jsonl`.
- `scripts/src/ledger/Event.ts` - `MalformedLine.file`.
- `scripts/src/render/state.ts` - optional `run` input: blocked-by column, depth grouping, frontier count.
- `scripts/fleet.ts` - new commands `init`, `graph check`, `next`, `status`, `stats`; guard in `log`; epic mode in `state`.
- `scripts/fleet.test.ts` - CLI tests for all of the above.
- `docs/specs/2026-09-04-fleet-graph-visibility-design.md` - two in-place retractions (Task 12).
- `skills/engineering/fleet-ship/SKILL.md` - one short "Epic mode" paragraph in the ledger section (Task 12).

---

### Task 1: Graph schema and parser

**Files:**
- Create: `skills/engineering/fleet-ship/scripts/src/graph/Graph.ts`
- Test: `skills/engineering/fleet-ship/scripts/src/graph/Graph.test.ts`

**Interfaces:**
- Produces: `type Chunk`, `type Graph`, `parseGraph(text: string): Result.Result<Graph, string>`, `holdOf(chunk): "human" | null`, `conflictsListOf(chunk): ReadonlyArray<string>`.

- [ ] **Step 1: Write the failing test**

```ts
// src/graph/Graph.test.ts
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd skills/engineering/fleet-ship/scripts test src/graph/Graph.test.ts`
Expected: FAIL, cannot resolve `./Graph.ts`.

- [ ] **Step 3: Write the implementation**

```ts
// src/graph/Graph.ts
/**
 * graph.json - the plan-only dependency graph of one epic (spec section 5).
 * Never holds run-time state; the ledger does.
 */
import { Result, Schema } from "effect";

export const ChunkKind = Schema.Literals(["impl", "verify", "gate", "question"]);
export const Lane = Schema.Literals(["mechanical", "judgment", "design"]);

export const Chunk = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  kind: ChunkKind,
  lane: Lane,
  deps: Schema.Array(Schema.String),
  conflicts: Schema.optionalKey(Schema.Array(Schema.String)),
  needs: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)),
  hold: Schema.optionalKey(Schema.NullOr(Schema.Literal("human"))),
  areas: Schema.optionalKey(Schema.Array(Schema.String)),
  acceptance: Schema.String,
  plan_ref: Schema.optionalKey(Schema.String),
});

export const Graph = Schema.Struct({
  version: Schema.Literal(1),
  epic: Schema.String,
  repo: Schema.String,
  plan: Schema.Struct({ path: Schema.String, sha: Schema.String }),
  integration_branch: Schema.String,
  runmap_issue: Schema.optionalKey(Schema.Number),
  project_number: Schema.optionalKey(Schema.Number),
  chunks: Schema.Array(Chunk),
});

export type Chunk = typeof Chunk.Type;
export type Graph = typeof Graph.Type;
export type ChunkKind = typeof ChunkKind.Type;
export type Lane = typeof Lane.Type;

const decode = Schema.decodeUnknownResult(Graph);

/** Parse graph.json text. Never throws: a bad document is a Failure with a human reason. */
export const parseGraph = (text: string): Result.Result<Graph, string> => {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    return Result.fail(`not JSON: ${String(error)}`);
  }
  const decoded = decode(json);
  if (Result.isFailure(decoded)) return Result.fail(`not a fleet graph: ${String(decoded.failure)}`);
  return Result.succeed(decoded.success);
};

export const holdOf = (chunk: Chunk): "human" | null => chunk.hold ?? null;
export const conflictsListOf = (chunk: Chunk): ReadonlyArray<string> => chunk.conflicts ?? [];
export const areasOf = (chunk: Chunk): ReadonlyArray<string> => chunk.areas ?? [];

/** An empty graph for `fleet init`. */
export const emptyGraph = (input: { epic: string; repo: string; planPath: string; planSha: string }): Graph => ({
  version: 1,
  epic: input.epic,
  repo: input.repo,
  plan: { path: input.planPath, sha: input.planSha },
  integration_branch: `epic/${input.epic}`,
  chunks: [],
});

export const encodeGraph = (graph: Graph): string => JSON.stringify(graph, null, 2) + "\n";
```

- [ ] **Step 4: Run tests and typecheck**

Run: `bun run --cwd skills/engineering/fleet-ship/scripts test src/graph/Graph.test.ts && bun run --cwd skills/engineering/fleet-ship/scripts typecheck`
Expected: 4 pass, tsc clean. If `Schema.Array` or `Schema.Literals` is not exported under that name, look it up with `rg -n "export declare (const|function) (Array|Literals)" node_modules/effect/dist/Schema.d.ts` and use the exported name; do not change the test.

- [ ] **Step 5: Commit**

```bash
git add skills/engineering/fleet-ship/scripts/src/graph
git commit -m "feat(fleet-ship): graph.json schema and parser"
```

---

### Task 2: Graph structural checks

**Files:**
- Create: `skills/engineering/fleet-ship/scripts/src/graph/check.ts`
- Test: `skills/engineering/fleet-ship/scripts/src/graph/check.test.ts`

**Interfaces:**
- Consumes: `Graph`, `Chunk`, `conflictsListOf` from Task 1.
- Produces: `interface Finding { level: "error" | "warning"; code: string; chunk: string | null; message: string }`, `checkGraph(graph): ReadonlyArray<Finding>`, `hasErrors(findings): boolean`, `conflictsOf(graph): ReadonlyMap<string, ReadonlySet<string>>` (symmetric), `chunkById(graph): ReadonlyMap<string, Chunk>`.

- [ ] **Step 1: Write the failing test**

```ts
// src/graph/check.test.ts
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
    expect(["a", "b", "c"]).toContain(f.find((x) => x.code === "G120")!.chunk);
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd skills/engineering/fleet-ship/scripts test src/graph/check.test.ts`
Expected: FAIL, cannot resolve `./check.ts`.

- [ ] **Step 3: Write the implementation**

```ts
// src/graph/check.ts
/** Structural checks over a parsed graph (spec section 5). Pure. */
import { conflictsListOf, type Chunk, type Graph } from "./Graph.ts";

export interface Finding {
  readonly level: "error" | "warning";
  readonly code: string;
  readonly chunk: string | null;
  readonly message: string;
}

const ID = /^[a-z0-9-]+$/;

export const chunkById = (graph: Graph): ReadonlyMap<string, Chunk> => new Map(graph.chunks.map((c) => [c.id, c]));

export const conflictsOf = (graph: Graph): ReadonlyMap<string, ReadonlySet<string>> => {
  const out = new Map<string, Set<string>>();
  const add = (a: string, b: string) => {
    if (!out.has(a)) out.set(a, new Set());
    out.get(a)!.add(b);
  };
  for (const chunk of graph.chunks) {
    for (const other of conflictsListOf(chunk)) {
      if (other === chunk.id) continue;
      add(chunk.id, other);
      add(other, chunk.id);
    }
  }
  return out;
};

const findCycleMember = (graph: Graph): string | null => {
  const byId = chunkById(graph);
  const color = new Map<string, 0 | 1 | 2>();
  const visit = (id: string): string | null => {
    const state = color.get(id) ?? 0;
    if (state === 1) return id;
    if (state === 2) return null;
    color.set(id, 1);
    for (const dep of byId.get(id)?.deps ?? []) {
      if (!byId.has(dep)) continue;
      const hit = visit(dep);
      if (hit) return hit;
    }
    color.set(id, 2);
    return null;
  };
  for (const chunk of graph.chunks) {
    const hit = visit(chunk.id);
    if (hit) return hit;
  }
  return null;
};

export const checkGraph = (graph: Graph): ReadonlyArray<Finding> => {
  const findings: Array<Finding> = [];
  const err = (code: string, chunk: string | null, message: string) => findings.push({ level: "error", code, chunk, message });
  const warn = (code: string, chunk: string | null, message: string) => findings.push({ level: "warning", code, chunk, message });
  const seen = new Set<string>();
  const ids = new Set(graph.chunks.map((c) => c.id));

  for (const chunk of graph.chunks) {
    if (seen.has(chunk.id)) err("G100", chunk.id, `duplicate chunk id ${chunk.id}`);
    seen.add(chunk.id);
    if (!ID.test(chunk.id)) err("G101", chunk.id, `chunk id must match [a-z0-9-]+ (got ${JSON.stringify(chunk.id)})`);
    for (const dep of chunk.deps) if (!ids.has(dep)) err("G110", chunk.id, `${chunk.id} depends on unknown chunk ${dep}`);
    for (const other of conflictsListOf(chunk)) {
      if (other === chunk.id) err("G112", chunk.id, `${chunk.id} conflicts with itself`);
      else if (!ids.has(other)) err("G111", chunk.id, `${chunk.id} conflicts with unknown chunk ${other}`);
    }
  }

  const cycle = findCycleMember(graph);
  if (cycle) err("G120", cycle, `dependency cycle through ${cycle}`);

  for (const chunk of graph.chunks) {
    if (chunk.kind !== "question") continue;
    const dependents = graph.chunks.filter((c) => c.kind === "impl" && c.deps.includes(chunk.id)).map((c) => c.id);
    if (dependents.length > 0) warn("W200", chunk.id, `question ${chunk.id} has impl dependents ${dependents.join(", ")}; answer it before they start`);
  }
  return findings;
};

export const hasErrors = (findings: ReadonlyArray<Finding>): boolean => findings.some((f) => f.level === "error");

export const formatFindings = (findings: ReadonlyArray<Finding>): string =>
  findings.map((f) => `${f.level === "error" ? "E" : "W"} ${f.code} ${f.chunk ?? "-"}: ${f.message}`).join("\n");
```

- [ ] **Step 4: Run tests and typecheck**

Run: `bun run --cwd skills/engineering/fleet-ship/scripts test src/graph && bun run --cwd skills/engineering/fleet-ship/scripts typecheck`
Expected: all pass, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add skills/engineering/fleet-ship/scripts/src/graph
git commit -m "feat(fleet-ship): graph structural checks (cycle, dangling, duplicate, conflicts)"
```

---

### Task 3: Workflow template

**Files:**
- Create: `skills/engineering/fleet-ship/scripts/workflow.json`
- Create: `skills/engineering/fleet-ship/scripts/src/workflow/Workflow.ts`
- Test: `skills/engineering/fleet-ship/scripts/src/workflow/Workflow.test.ts`

**Interfaces:**
- Produces: `type Workflow`, `parseWorkflow(text): Result.Result<Workflow, string>`, `stepsFor(w, stage): ReadonlyArray<string>`, `hasStep(w, stage, step): boolean`, `DEFAULT_WORKFLOW: Workflow` (the same content as the JSON, used when the file is absent).

- [ ] **Step 1: Write the failing test**

```ts
// src/workflow/Workflow.test.ts
import { describe, expect, test } from "bun:test";
import { Result } from "effect";
import { readFileSync } from "node:fs";
import { DEFAULT_WORKFLOW, hasStep, parseWorkflow, stepsFor } from "./Workflow.ts";

describe("Workflow", () => {
  test("workflow.json in the scripts dir parses and equals the default", () => {
    const text = readFileSync(new URL("../../workflow.json", import.meta.url), "utf8");
    const r = parseWorkflow(text);
    expect(Result.isSuccess(r)).toBe(true);
    if (Result.isSuccess(r)) expect(r.success).toEqual(DEFAULT_WORKFLOW);
  });
  test("stepsFor lists the building steps in order and survey is last", () => {
    expect(stepsFor(DEFAULT_WORKFLOW, "building")).toEqual(["tdd-red", "tdd-green", "self-review", "report", "survey"]);
    expect(stepsFor(DEFAULT_WORKFLOW, "assigned")).toEqual([]);
  });
  test("hasStep is true only for a step under its own stage", () => {
    expect(hasStep(DEFAULT_WORKFLOW, "in_review", "adversarial-review")).toBe(true);
    expect(hasStep(DEFAULT_WORKFLOW, "building", "adversarial-review")).toBe(false);
  });
  test("rejects a document with version 2", () => {
    expect(Result.isFailure(parseWorkflow(JSON.stringify({ version: 2, steps: {} })))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd skills/engineering/fleet-ship/scripts test src/workflow`
Expected: FAIL, cannot resolve `./Workflow.ts`.

- [ ] **Step 3: Write workflow.json**

```json
{
  "version": 1,
  "steps": {
    "planned": ["plan-drafted", "plan-approved"],
    "building": ["tdd-red", "tdd-green", "self-review", "report", "survey"],
    "in_review": ["review-all", "codex-review", "adversarial-review"],
    "gated": ["consensus", "hold-approved"],
    "merged": ["main-synced", "archived-report"],
    "dogfooded": ["tracer-run", "findings-filed"]
  }
}
```

- [ ] **Step 4: Write the implementation**

```ts
// src/workflow/Workflow.ts
/** The per-chunk workflow template (spec section 7.3): ordered steps under each stage. */
import { Result, Schema } from "effect";

export const Workflow = Schema.Struct({
  version: Schema.Literal(1),
  steps: Schema.Record(Schema.String, Schema.Array(Schema.String)),
});
export type Workflow = typeof Workflow.Type;

export const DEFAULT_WORKFLOW: Workflow = {
  version: 1,
  steps: {
    planned: ["plan-drafted", "plan-approved"],
    building: ["tdd-red", "tdd-green", "self-review", "report", "survey"],
    in_review: ["review-all", "codex-review", "adversarial-review"],
    gated: ["consensus", "hold-approved"],
    merged: ["main-synced", "archived-report"],
    dogfooded: ["tracer-run", "findings-filed"],
  },
};

const decode = Schema.decodeUnknownResult(Workflow);

export const parseWorkflow = (text: string): Result.Result<Workflow, string> => {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    return Result.fail(`not JSON: ${String(error)}`);
  }
  const decoded = decode(json);
  if (Result.isFailure(decoded)) return Result.fail(`not a workflow template: ${String(decoded.failure)}`);
  return Result.succeed(decoded.success);
};

export const stepsFor = (workflow: Workflow, stage: string): ReadonlyArray<string> => workflow.steps[stage] ?? [];
export const hasStep = (workflow: Workflow, stage: string, step: string): boolean => stepsFor(workflow, stage).includes(step);
```

- [ ] **Step 5: Run tests and typecheck**

Run: `bun run --cwd skills/engineering/fleet-ship/scripts test src/workflow && bun run --cwd skills/engineering/fleet-ship/scripts typecheck`
Expected: 4 pass, tsc clean.

- [ ] **Step 6: Commit**

```bash
git add skills/engineering/fleet-ship/scripts/workflow.json skills/engineering/fleet-ship/scripts/src/workflow
git commit -m "feat(fleet-ship): workflow.json step template and parser"
```

---

### Task 4: Transition table

**Files:**
- Create: `skills/engineering/fleet-ship/scripts/src/ledger/transitions.ts`
- Test: `skills/engineering/fleet-ship/scripts/src/ledger/transitions.test.ts`

**Interfaces:**
- Produces: `STAGES`, `SIDE_STATES`, `MERGED_OR_LATER: ReadonlySet<string>`, `ACTIVE: ReadonlySet<string>`, `EVIDENCE = ["verified","reported","asserted"]`, `interface Position { stage: string | null; interrupted: string | null }`, `allowedTargets(p): ReadonlyArray<string>`, `isAllowed(p, to): boolean`, `type Cause = "initial" | "gate_failed" | "sent_back" | "followup"`, `causeFor(from: string | null, prevData, newData): Cause`, `RETURNS_TO_BUILDING`.

Note the first-event rule: `(none) -> assigned | spawned`. The spec table says `assigned` only; Task 12 retracts that line in the spec, because every existing ledger starts at `spawned` or `building` and a spawn implies assignment.

- [ ] **Step 1: Write the failing test**

```ts
// src/ledger/transitions.test.ts
import { describe, expect, test } from "bun:test";
import { allowedTargets, causeFor, isAllowed, MERGED_OR_LATER, ACTIVE } from "./transitions.ts";

const at = (stage: string | null, interrupted: string | null = null) => ({ stage, interrupted });

describe("allowedTargets", () => {
  test("nothing yet can become assigned or spawned only", () => {
    expect(allowedTargets(at(null))).toEqual(["assigned", "spawned"]);
  });
  test("the happy path is allowed end to end", () => {
    const path = ["assigned", "spawned", "planned", "building", "built", "in_review", "gated", "merged", "dogfooded", "archived", "closed"];
    for (let i = 1; i < path.length; i++) expect(isAllowed(at(path[i - 1]!), path[i]!)).toBe(true);
  });
  test("skipping the gate is refused", () => {
    expect(isAllowed(at("built"), "merged")).toBe(false);
    expect(isAllowed(at("in_review"), "merged")).toBe(false);
  });
  test("returns to building are allowed from built, in_review, gated, dogfooded", () => {
    for (const s of ["built", "in_review", "gated", "dogfooded"]) expect(isAllowed(at(s), "building")).toBe(true);
    expect(isAllowed(at("merged"), "building")).toBe(false);
  });
  test("blocked returns to the interrupted stage or building; error may also close", () => {
    expect(allowedTargets(at("blocked", "in_review"))).toEqual(["in_review", "building"]);
    expect(allowedTargets(at("error", "built"))).toEqual(["built", "building", "closed"]);
    expect(allowedTargets(at("blocked", null))).toEqual(["building"]);
  });
  test("any active stage may enter blocked or error", () => {
    for (const s of ["assigned", "spawned", "planned", "building", "built", "in_review", "gated"]) {
      expect(isAllowed(at(s), "blocked")).toBe(true);
      expect(isAllowed(at(s), "error")).toBe(true);
    }
    expect(isAllowed(at("merged"), "blocked")).toBe(false);
  });
  test("stage sets", () => {
    expect([...MERGED_OR_LATER]).toEqual(["merged", "dogfooded", "archived", "closed"]);
    expect(ACTIVE.has("building")).toBe(true);
    expect(ACTIVE.has("assigned")).toBe(false);
    expect(ACTIVE.has("merged")).toBe(false);
  });
});

describe("causeFor", () => {
  test("explicit cause wins", () => {
    expect(causeFor("built", {}, { cause: "followup" })).toBe("followup");
  });
  test("a FAIL verdict on the previous event is gate_failed", () => {
    expect(causeFor("built", { verdict: "FAILED" }, {})).toBe("gate_failed");
    expect(causeFor("gated", { verdict: "FAIL" }, {})).toBe("gate_failed");
  });
  test("otherwise review returns are sent_back, dogfood returns are followup, first is initial", () => {
    expect(causeFor("in_review", {}, {})).toBe("sent_back");
    expect(causeFor("gated", { verdict: "PASS" }, {})).toBe("sent_back");
    expect(causeFor("built", {}, {})).toBe("sent_back");
    expect(causeFor("dogfooded", {}, {})).toBe("followup");
    expect(causeFor("spawned", {}, {})).toBe("initial");
    expect(causeFor(null, {}, {})).toBe("initial");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd skills/engineering/fleet-ship/scripts test src/ledger/transitions.test.ts`
Expected: FAIL, cannot resolve `./transitions.ts`.

- [ ] **Step 3: Write the implementation**

```ts
// src/ledger/transitions.ts
/** The chunk state machine (spec section 7.1). Pure data and predicates. */

export const STAGES = [
  "assigned", "spawned", "planned", "building", "built", "in_review", "gated", "merged", "dogfooded", "archived", "closed",
] as const;
export const SIDE_STATES = ["blocked", "error"] as const;
export const ALL_STAGES: ReadonlySet<string> = new Set([...STAGES, ...SIDE_STATES]);

export const MERGED_OR_LATER: ReadonlySet<string> = new Set(["merged", "dogfooded", "archived", "closed"]);
/** Stages where a chunk occupies a pane and may collide on shared files. */
export const ACTIVE: ReadonlySet<string> = new Set(["spawned", "planned", "building", "built", "in_review", "gated", "blocked", "error"]);
export const RETURNS_TO_BUILDING: ReadonlySet<string> = new Set(["built", "in_review", "gated", "dogfooded"]);
export const EVIDENCE = ["verified", "reported", "asserted"] as const;
export const EVIDENCE_STAGES: ReadonlySet<string> = new Set(["built", "gated", "merged"]);

const TABLE: Readonly<Record<string, ReadonlyArray<string>>> = {
  "": ["assigned", "spawned"],
  assigned: ["spawned", "blocked", "error", "closed"],
  spawned: ["planned", "building", "blocked", "error"],
  planned: ["building", "blocked", "error"],
  building: ["built", "blocked", "error"],
  built: ["in_review", "building", "blocked", "error"],
  in_review: ["gated", "building", "blocked", "error"],
  gated: ["merged", "building", "blocked", "error"],
  merged: ["dogfooded", "archived"],
  dogfooded: ["archived", "building"],
  archived: ["closed"],
  closed: [],
};

export interface Position {
  readonly stage: string | null;
  /** The stage a blocked/error chunk left; null otherwise. */
  readonly interrupted: string | null;
}

const uniq = (xs: ReadonlyArray<string>) => [...new Set(xs)];

export const allowedTargets = (p: Position): ReadonlyArray<string> => {
  if (p.stage === "blocked") return uniq([...(p.interrupted ? [p.interrupted] : []), "building"]);
  if (p.stage === "error") return uniq([...(p.interrupted ? [p.interrupted] : []), "building", "closed"]);
  return TABLE[p.stage ?? ""] ?? [];
};

export const isAllowed = (p: Position, to: string): boolean => allowedTargets(p).includes(to);

export type Cause = "initial" | "gate_failed" | "sent_back" | "followup";
const CAUSES: ReadonlySet<string> = new Set(["initial", "gate_failed", "sent_back", "followup"]);

/**
 * Why a new attempt starts. `from` is the effective stage being left (an interrupted stage when
 * leaving blocked/error), `prevData` the chunk's data before this event, `newData` this event's data.
 */
export const causeFor = (from: string | null, prevData: Record<string, unknown>, newData: Record<string, unknown>): Cause => {
  const explicit = newData.cause;
  if (typeof explicit === "string" && CAUSES.has(explicit)) return explicit as Cause;
  if (from === "dogfooded") return "followup";
  if ((from === "built" || from === "gated") && /FAIL/i.test(String(prevData.verdict ?? ""))) return "gate_failed";
  if (from === "built" || from === "in_review" || from === "gated") return "sent_back";
  return "initial";
};
```

- [ ] **Step 4: Run tests and typecheck**

Run: `bun run --cwd skills/engineering/fleet-ship/scripts test src/ledger/transitions.test.ts && bun run --cwd skills/engineering/fleet-ship/scripts typecheck`
Expected: all pass, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add skills/engineering/fleet-ship/scripts/src/ledger/transitions.ts skills/engineering/fleet-ship/scripts/src/ledger/transitions.test.ts
git commit -m "feat(fleet-ship): chunk transition table, stage sets, attempt causes"
```

---

### Task 5: Fold extension - step, interrupted, attempts, evidence, landed

**Files:**
- Modify: `skills/engineering/fleet-ship/scripts/src/ledger/fold.ts`
- Modify: `skills/engineering/fleet-ship/scripts/src/testing/fixture.ts` (add a second fixture with a retry)
- Test: `skills/engineering/fleet-ship/scripts/src/ledger/fold.test.ts` (new file; the existing fold test in `render/state.test.ts` stays)

**Interfaces:**
- Consumes: `causeFor`, `RETURNS_TO_BUILDING`, `EVIDENCE_STAGES` from Task 4.
- Produces: `interface Attempt { n: number; cause: Cause; pane: string | null; engine: string | null; started: string | null; ended: string | null; terminal: string | null; evidence: string | null }`; `ChunkState` gains `step: string | null`, `interrupted: string | null`, `attempts: Array<Attempt>`, `evidence: string | null`; `RunState` gains `landed: { time: string | null; pr: string | null; commit: string | null } | null`. `fold` signature unchanged.

- [ ] **Step 1: Add the retry fixture**

Append to `src/testing/fixture.ts`:

```ts
/** A chunk that fails its gate, is sent back, is retried, blocks once, then merges. */
export const RETRY_EVENTS: ReadonlyArray<FleetEvent> = [
  event("fleet.run.started", "demo", { session: "fleet-demo" }, "2026-09-03T09:00:00Z"),
  event("fleet.chunk.spawned", "mbp/w1-ui", { pane: "w1:p8", engine: "codex" }, "2026-09-03T09:01:00Z"),
  event("fleet.chunk.building", "mbp/w1-ui", { step: "tdd-red" }, "2026-09-03T09:02:00Z"),
  event("fleet.chunk.built", "mbp/w1-ui", { commit: "aaa111", evidence: "reported" }, "2026-09-03T09:20:00Z"),
  event("fleet.chunk.gated", "mbp/w1-ui", { verdict: "FAIL", gist: "missing tests" }, "2026-09-03T09:30:00Z"),
  event("fleet.chunk.building", "mbp/w1-ui", {}, "2026-09-03T09:31:00Z"),
  event("fleet.chunk.blocked", "mbp/w1-ui", { gist: "needs token" }, "2026-09-03T09:40:00Z"),
  event("fleet.chunk.building", "mbp/w1-ui", { step: "tdd-green" }, "2026-09-03T09:45:00Z"),
  event("fleet.chunk.built", "mbp/w1-ui", { commit: "bbb222" }, "2026-09-03T10:00:00Z"),
  event("fleet.chunk.in_review", "mbp/w1-ui", { step: "codex-review" }, "2026-09-03T10:05:00Z"),
  event("fleet.chunk.gated", "mbp/w1-ui", { verdict: "PASS", evidence: "reported" }, "2026-09-03T10:20:00Z"),
  event("fleet.chunk.merged", "mbp/w1-ui", { pr: "Necmttn/ax#800", evidence: "verified" }, "2026-09-03T10:30:00Z"),
  event("fleet.run.landed", "demo", { pr: "Necmttn/ax#801", commit: "ccc333" }, "2026-09-03T11:00:00Z"),
];
```

- [ ] **Step 2: Write the failing test**

```ts
// src/ledger/fold.test.ts
import { describe, expect, test } from "bun:test";
import { fold } from "./fold.ts";
import { FIXTURE_EVENTS, RETRY_EVENTS } from "../testing/fixture.ts";

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
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun run --cwd skills/engineering/fleet-ship/scripts test src/ledger/fold.test.ts`
Expected: FAIL on `attempts` being undefined.

- [ ] **Step 4: Extend fold.ts**

Replace the whole file with:

```ts
/** Fold a ledger's events into the run's current state. Pure. */
import type { FleetData, FleetEvent } from "./Event.ts";
import { causeFor, EVIDENCE_STAGES, RETURNS_TO_BUILDING, type Cause } from "./transitions.ts";

export interface Attempt {
  n: number;
  cause: Cause;
  pane: string | null;
  engine: string | null;
  started: string | null;
  ended: string | null;
  /** The stage that ended the attempt: built or error. */
  terminal: string | null;
  evidence: string | null;
}

export interface ChunkState {
  stage: string;
  time: string | null;
  data: Record<string, unknown>;
  step: string | null;
  interrupted: string | null;
  attempts: Array<Attempt>;
  evidence: string | null;
}

export interface RunState {
  epic: string | null;
  session: string | null;
  runmap: string | null;
  kanban: string | null;
  policies: Map<string, string>;
  cursor: FleetData | null;
  chunks: Map<string, ChunkState>;
  attn: Map<string, { ask: string; time: string | null }>;
  resources: Map<string, { label: string; time: string | null }>;
  last: string | null;
  teardown: string | null;
  landed: { time: string | null; pr: string | null; commit: string | null } | null;
}

const str = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
const SIDE = new Set(["blocked", "error"]);

const newChunk = (): ChunkState => ({ stage: "?", time: null, data: {}, step: null, interrupted: null, attempts: [], evidence: null });

const applyChunkEvent = (chunk: ChunkState, stage: string, data: FleetData, when: string | null): void => {
  const prev = chunk.stage === "?" ? null : chunk.stage;
  const effectiveFrom = prev && SIDE.has(prev) ? chunk.interrupted : prev;
  const prevData = { ...chunk.data };

  // interrupted bookkeeping
  if (SIDE.has(stage)) {
    if (!(prev && SIDE.has(prev))) chunk.interrupted = prev;
  } else {
    chunk.interrupted = null;
  }

  // attempts
  const open = chunk.attempts.at(-1);
  const isOpen = open !== undefined && open.ended === null;
  if (stage === "building" && !isOpen) {
    const cause: Cause = effectiveFrom && RETURNS_TO_BUILDING.has(effectiveFrom) ? causeFor(effectiveFrom, prevData, data) : causeFor(null, prevData, data);
    chunk.attempts.push({
      n: chunk.attempts.length + 1,
      cause,
      pane: str(data.pane) ?? str(chunk.data.pane),
      engine: str(data.engine) ?? str(chunk.data.engine),
      started: when,
      ended: null,
      terminal: null,
      evidence: null,
    });
  } else if ((stage === "built" || stage === "error") && isOpen && open) {
    open.ended = when;
    open.terminal = stage;
    open.evidence = stage === "built" ? (str(data.evidence) ?? "asserted") : null;
    if (!open.pane) open.pane = str(chunk.data.pane);
    if (!open.engine) open.engine = str(chunk.data.engine);
  }

  // evidence
  if (EVIDENCE_STAGES.has(stage)) {
    const evidence = str(data.evidence) ?? "asserted";
    chunk.evidence = evidence;
    if (!("evidence" in data)) data = { ...data, evidence };
  }

  // step: explicit wins; a stage change without a step clears it
  if (str(data.step)) chunk.step = str(data.step);
  else if (stage !== prev) chunk.step = null;

  chunk.stage = stage;
  chunk.time = when;
  Object.assign(chunk.data, data);
};

export const fold = (events: ReadonlyArray<FleetEvent>): RunState => {
  const state: RunState = {
    epic: null, session: null, runmap: null, kanban: null,
    policies: new Map(), cursor: null, chunks: new Map(), attn: new Map(), resources: new Map(),
    last: null, teardown: null, landed: null,
  };
  for (const event of events) {
    const { type, subject, data } = event;
    const when = event.time || null;
    state.last = when ?? state.last;
    if (type === "fleet.run.started") {
      state.epic = subject || state.epic;
      state.session = str(data.session) ?? state.session;
      state.runmap = str(data.runmap) ?? state.runmap;
      state.kanban = str(data.kanban) ?? state.kanban;
    } else if (type === "fleet.run.teardown") {
      state.teardown = when;
    } else if (type === "fleet.run.landed") {
      state.landed = { time: when, pr: str(data.pr), commit: str(data.commit) };
    } else if (type === "fleet.policy.set") {
      state.policies.set(subject, str(data.text) ?? JSON.stringify(data));
    } else if (type === "fleet.cursor.advanced") {
      state.cursor = data;
    } else if (type === "fleet.resource.minted") {
      state.resources.set(subject, { label: str(data.label) ?? "", time: when });
      if (subject.startsWith("session:") && !state.session) state.session = subject.slice("session:".length);
    } else if (type === "fleet.resource.closed") {
      state.resources.delete(subject);
    } else if (type === "fleet.attn.opened") {
      state.attn.set(subject, { ask: str(data.ask) ?? "", time: when });
    } else if (type === "fleet.attn.closed") {
      state.attn.delete(subject);
    } else if (type.startsWith("fleet.chunk.")) {
      const chunk = state.chunks.get(subject) ?? newChunk();
      applyChunkEvent(chunk, type.slice("fleet.chunk.".length), data, when);
      state.chunks.set(subject, chunk);
    }
  }
  return state;
};

/** The bare chunk id of a ledger subject `<slug>/<id>`. */
export const bareId = (subject: string): string => subject.split("/").at(-1) ?? subject;
```

- [ ] **Step 5: Run the whole suite and typecheck**

Run: `bun run --cwd skills/engineering/fleet-ship/scripts test && bun run --cwd skills/engineering/fleet-ship/scripts typecheck`
Expected: all pass including the existing `render/state.test.ts`, tsc clean. If `state.test.ts` breaks on the `data` object gaining `evidence`, it is because `toMatchObject` is a subset match and must still pass; investigate before changing any test.

- [ ] **Step 6: Commit**

```bash
git add skills/engineering/fleet-ship/scripts/src/ledger/fold.ts skills/engineering/fleet-ship/scripts/src/ledger/fold.test.ts skills/engineering/fleet-ship/scripts/src/testing/fixture.ts
git commit -m "feat(fleet-ship): fold derives attempts, step, interrupted stage, evidence, run.landed"
```

---

### Task 6: Epic directory and multi-ledger read

**Files:**
- Create: `skills/engineering/fleet-ship/scripts/src/cli/epic.ts`
- Modify: `skills/engineering/fleet-ship/scripts/src/ledger/Event.ts` (add `file` to `MalformedLine`)
- Modify: `skills/engineering/fleet-ship/scripts/src/ledger/Ledger.ts` (add `layerDir`)
- Create: `skills/engineering/fleet-ship/scripts/src/testing/graphFixture.ts`
- Test: `skills/engineering/fleet-ship/scripts/src/ledger/Ledger.test.ts` (extend)

**Interfaces:**
- Produces: `slugOf(): string` (from `FLEET_SLUG` or short hostname), `isLedgerFile(arg): boolean` (ends with `.jsonl`), `interface EpicPaths { dir; epic; graph; decisions; ledger; dagr }`, `epicPaths(dir, slug): EpicPaths`, `ledgerFileName(slug): string` = `ledger.<slug>.jsonl`.
- Produces: `Ledger.layerDir(dir, slug): Layer<Ledger, never, FileSystem>` - append goes to `ledger.<slug>.jsonl`, `readAll` merges every `ledger.*.jsonl` in `dir`, sorted by `time` then file name.
- Produces: `FIXTURE_GRAPH: Graph` and `writeEpicDir(root, opts?): string` for tests.

- [ ] **Step 1: Write the failing tests**

Append to `src/ledger/Ledger.test.ts`:

```ts
import { mkdirSync } from "node:fs";
import { layerDir } from "./Ledger.ts";
import { RETRY_EVENTS, FIXTURE_EVENTS } from "../testing/fixture.ts";

describe("Ledger.layerDir", () => {
  const runDir = <A, E>(dir: string, slug: string, body: Effect.Effect<A, E, Ledger>) =>
    Effect.runPromise(body.pipe(Effect.provide(layerDir(dir, slug)), Effect.provide(BunFileSystem.layer)));

  test("append writes to ledger.<slug>.jsonl and readAll merges every machine's file by time", async () => {
    const dir = join(tmp(), "demo");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "ledger.vps.jsonl"), RETRY_EVENTS.map((e) => JSON.stringify(e)).join("\n") + "\n");
    writeFileSync(join(dir, "ledger.mbp.jsonl"), FIXTURE_EVENTS.slice(0, 2).map((e) => JSON.stringify(e)).join("\n") + "\nnot json\n");
    const { events, malformed } = await runDir(
      dir, "mbp",
      Effect.gen(function* () {
        const ledger = yield* Ledger;
        yield* ledger.append(makeEvent({ type: "fleet.note", subject: "", data: { text: "late" }, source: "s", now: new Date("2026-09-03T12:00:00Z") }));
        return yield* ledger.readAll;
      }),
    );
    expect(events).toHaveLength(RETRY_EVENTS.length + 2 + 1);
    expect(events.at(-1)!.data).toEqual({ text: "late" });
    expect(events[0]!.type).toBe("fleet.run.started");
    expect(malformed).toHaveLength(1);
    expect(malformed[0]!.file).toBe("ledger.mbp.jsonl");
    expect(readFileSync(join(dir, "ledger.mbp.jsonl"), "utf8").trimEnd().split("\n")).toHaveLength(4);
  });

  test("readAll on an empty directory is empty and append creates the directory", async () => {
    const dir = join(tmp(), "fresh");
    const { events } = await runDir(
      dir, "mbp",
      Effect.gen(function* () {
        const ledger = yield* Ledger;
        const before = yield* ledger.readAll;
        expect(before.events).toHaveLength(0);
        yield* ledger.append(makeEvent({ type: "fleet.note", subject: "", data: {}, source: "s" }));
        return yield* ledger.readAll;
      }),
    );
    expect(events).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd skills/engineering/fleet-ship/scripts test src/ledger/Ledger.test.ts`
Expected: FAIL, `layerDir` is not exported.

- [ ] **Step 3: Add `file` to MalformedLine**

In `src/ledger/Event.ts` change the interface:

```ts
export interface MalformedLine {
  readonly line: number;
  readonly raw: string;
  readonly reason: string;
  /** Set when the ledger is read from an epic directory: the file the line came from. */
  readonly file?: string;
}
```

- [ ] **Step 4: Add `layerDir` to Ledger.ts**

Append to `src/ledger/Ledger.ts`:

```ts
export const ledgerFileName = (slug: string): string => `ledger.${slug}.jsonl`;
const LEDGER_FILE = /^ledger\.[A-Za-z0-9_-]+\.jsonl$/;

const parseText = (text: string, file?: string): LedgerRead => {
  const events: Array<FleetEvent> = [];
  const malformed: Array<MalformedLine> = [];
  text.split("\n").forEach((raw, index) => {
    if (raw.trim() === "") return;
    const parsed = parseLine(raw, index + 1);
    if (Result.isSuccess(parsed)) events.push(parsed.success);
    else malformed.push(file ? { ...parsed.failure, file } : parsed.failure);
  });
  return { events, malformed };
};

/**
 * The epic-directory ledger: this machine appends to `ledger.<slug>.jsonl`; reads merge every
 * `ledger.*.jsonl` in the directory, ordered by `time` then file name (stable for equal times).
 */
export const layerDir = (dir: string, slug: string): Layer.Layer<Ledger, never, FileSystem.FileSystem> =>
  Layer.effect(
    Ledger,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const own = `${dir}/${ledgerFileName(slug)}`;
      return {
        path: own,
        append: (event) =>
          Effect.gen(function* () {
            yield* fs.makeDirectory(dir, { recursive: true });
            yield* fs.writeFileString(own, encodeLine(event) + "\n", { flag: "a" });
          }),
        readAll: Effect.gen(function* () {
          if (!(yield* fs.exists(dir))) return { events: [], malformed: [] };
          const names = (yield* fs.readDirectory(dir)).filter((n) => LEDGER_FILE.test(n)).sort();
          const tagged: Array<{ event: FleetEvent; file: string; index: number }> = [];
          const malformed: Array<MalformedLine> = [];
          for (const name of names) {
            const read = parseText(yield* fs.readFileString(`${dir}/${name}`), name);
            read.events.forEach((event, index) => tagged.push({ event, file: name, index }));
            malformed.push(...read.malformed);
          }
          tagged.sort((a, b) => a.event.time.localeCompare(b.event.time) || a.file.localeCompare(b.file) || a.index - b.index);
          return { events: tagged.map((t) => t.event), malformed };
        }),
      };
    }),
  );
```

Also refactor the existing single-file `layer` to call `parseText(text)` instead of its inline loop, so the two paths share one parser.

- [ ] **Step 5: Write epic.ts**

```ts
// src/cli/epic.ts
/** Epic-directory resolution. The only module besides fleet.ts that reads process.env. */
import { hostname } from "node:os";
import { basename, join, resolve } from "node:path";
import { ledgerFileName } from "../ledger/Ledger.ts";

export const slugOf = (): string => process.env.FLEET_SLUG || hostname().split(".")[0] || "local";

/** Legacy form: a single ledger file path. Everything else is an epic directory. */
export const isLedgerFile = (arg: string): boolean => arg.endsWith(".jsonl");

export interface EpicPaths {
  readonly dir: string;
  readonly epic: string;
  readonly graph: string;
  readonly decisions: string;
  readonly ledger: string;
  readonly dagr: string;
}

export const epicPaths = (dir: string, slug: string): EpicPaths => {
  const abs = resolve(dir);
  return {
    dir: abs,
    epic: basename(abs),
    graph: join(abs, "graph.json"),
    decisions: join(abs, "DECISIONS.md"),
    ledger: join(abs, ledgerFileName(slug)),
    dagr: join(abs, ".dagr", "run.json"),
  };
};

/** The workflow.json that ships with the skill, resolved relative to this source tree. */
export const bundledWorkflowPath = (): string => new URL("../../workflow.json", import.meta.url).pathname;
```

- [ ] **Step 6: Write the graph fixture**

```ts
// src/testing/graphFixture.ts
/** Test-only: the demo graph that matches fixture.ts, and an epic-dir writer. */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { encodeGraph, type Graph } from "../graph/Graph.ts";
import type { FleetEvent } from "../ledger/Event.ts";
import { FIXTURE_EVENTS } from "./fixture.ts";

export const FIXTURE_GRAPH: Graph = {
  version: 1,
  epic: "demo",
  repo: "Necmttn/ax",
  plan: { path: "docs/superpowers/plans/demo.md", sha: "abc1234" },
  integration_branch: "epic/demo",
  chunks: [
    { id: "w0-prunes", title: "Prune stale rows", kind: "impl", lane: "mechanical", deps: [], areas: ["db"], acceptance: "tests green" },
    { id: "w0-ffi", title: "FFI bridge", kind: "impl", lane: "judgment", deps: [], areas: ["ffi"], acceptance: "tests green" },
    { id: "w1-ui", title: "UI over both", kind: "impl", lane: "design", deps: ["w0-prunes", "w0-ffi"], conflicts: ["w1-docs"], hold: "human", areas: ["web"], acceptance: "screens match" },
    { id: "w1-docs", title: "Docs", kind: "impl", lane: "mechanical", deps: ["w0-prunes"], areas: ["docs"], acceptance: "rendered" },
    { id: "q1-name", title: "Pick the product name", kind: "question", lane: "judgment", deps: [], acceptance: "owner answered" },
  ],
};

/** Write `<root>/demo/graph.json` + `ledger.mbp.jsonl`; returns the epic dir. */
export const writeEpicDir = (root: string, opts: { events?: ReadonlyArray<FleetEvent>; graph?: Graph | null; slug?: string } = {}): string => {
  const dir = join(root, "demo");
  mkdirSync(dir, { recursive: true });
  const graph = opts.graph === undefined ? FIXTURE_GRAPH : opts.graph;
  if (graph) writeFileSync(join(dir, "graph.json"), encodeGraph(graph));
  const events = opts.events ?? FIXTURE_EVENTS;
  writeFileSync(join(dir, `ledger.${opts.slug ?? "mbp"}.jsonl`), events.map((e) => JSON.stringify(e)).join("\n") + "\n");
  return dir;
};
```

- [ ] **Step 7: Run tests and typecheck**

Run: `bun run --cwd skills/engineering/fleet-ship/scripts test && bun run --cwd skills/engineering/fleet-ship/scripts typecheck`
Expected: all pass, tsc clean.

- [ ] **Step 8: Commit**

```bash
git add skills/engineering/fleet-ship/scripts/src
git commit -m "feat(fleet-ship): epic directory paths and multi-machine ledger read"
```

---

### Task 7: Run join - readiness, frontier, depth, blockers

**Files:**
- Create: `skills/engineering/fleet-ship/scripts/src/run/Run.ts`
- Test: `skills/engineering/fleet-ship/scripts/src/run/Run.test.ts`

**Interfaces:**
- Consumes: `Graph`, `Chunk`, `holdOf` (Task 1); `chunkById`, `conflictsOf` (Task 2); `RunState`, `ChunkState`, `bareId` (Task 5); `MERGED_OR_LATER`, `ACTIVE` (Task 4).
- Produces:

```ts
interface ChunkView {
  id: string; subject: string | null; spec: Chunk; state: ChunkState | null; stage: string | null;
  blockedBy: ReadonlyArray<string>; dependents: ReadonlyArray<string>; conflictHolds: ReadonlyArray<string>;
  depth: number; ready: boolean; needsAnswer: boolean; reason: string; holdApproved: boolean;
}
interface RunView { chunks: ReadonlyMap<string, ChunkView>; frontier: ReadonlyArray<string>; adhoc: ReadonlyArray<string>; }
joinRun(graph: Graph, state: RunState): RunView
```

Readiness rule (spec 7.4 as amended in Task 12): every dep `merged` or later; stage is null or `assigned`; no conflicting chunk is `ACTIVE`; `hold` does not affect readiness (hold gates `gated -> merged`). `needsAnswer` is true for `kind: question`. `holdApproved` is true when the chunk's data has `hold: "approved"`.

- [ ] **Step 1: Write the failing test**

```ts
// src/run/Run.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd skills/engineering/fleet-ship/scripts test src/run/Run.test.ts`
Expected: FAIL, cannot resolve `./Run.ts`.

- [ ] **Step 3: Write the implementation**

```ts
// src/run/Run.ts
/** Join graph.json with the folded ledger into the run view (spec section 7.4). Pure. */
import type { Chunk, Graph } from "../graph/Graph.ts";
import { chunkById, conflictsOf } from "../graph/check.ts";
import { bareId, type ChunkState, type RunState } from "../ledger/fold.ts";
import { ACTIVE, MERGED_OR_LATER } from "../ledger/transitions.ts";

export interface ChunkView {
  readonly id: string;
  readonly subject: string | null;
  readonly spec: Chunk;
  readonly state: ChunkState | null;
  readonly stage: string | null;
  readonly blockedBy: ReadonlyArray<string>;
  readonly dependents: ReadonlyArray<string>;
  readonly conflictHolds: ReadonlyArray<string>;
  readonly depth: number;
  readonly ready: boolean;
  readonly needsAnswer: boolean;
  readonly reason: string;
  readonly holdApproved: boolean;
}

export interface RunView {
  readonly chunks: ReadonlyMap<string, ChunkView>;
  readonly frontier: ReadonlyArray<string>;
  /** Ledger subjects whose bare id is not in the graph. */
  readonly adhoc: ReadonlyArray<string>;
}

const isStarted = (stage: string | null) => stage !== null && stage !== "assigned";

export const joinRun = (graph: Graph, state: RunState): RunView => {
  const byId = chunkById(graph);
  const conflicts = conflictsOf(graph);

  const subjects = new Map<string, string>();
  const adhoc: Array<string> = [];
  for (const subject of state.chunks.keys()) {
    const id = bareId(subject);
    if (byId.has(id)) subjects.set(id, subject);
    else adhoc.push(subject);
  }
  const stateOf = (id: string): ChunkState | null => {
    const subject = subjects.get(id);
    return subject ? (state.chunks.get(subject) ?? null) : null;
  };
  const stageOf = (id: string): string | null => stateOf(id)?.stage ?? null;

  const depthMemo = new Map<string, number>();
  const depthOf = (id: string, seen: Set<string> = new Set()): number => {
    const hit = depthMemo.get(id);
    if (hit !== undefined) return hit;
    if (seen.has(id)) return 0;
    seen.add(id);
    const deps = byId.get(id)?.deps ?? [];
    const d = deps.length === 0 ? 0 : 1 + Math.max(...deps.map((dep) => (byId.has(dep) ? depthOf(dep, seen) : 0)));
    depthMemo.set(id, d);
    return d;
  };

  const dependentsOf = (id: string) => graph.chunks.filter((c) => c.deps.includes(id)).map((c) => c.id);

  const chunks = new Map<string, ChunkView>();
  const frontier: Array<string> = [];
  for (const spec of graph.chunks) {
    const st = stateOf(spec.id);
    const stage = st?.stage ?? null;
    const blockedBy = spec.deps.filter((dep) => !MERGED_OR_LATER.has(stageOf(dep) ?? ""));
    const conflictHolds = [...(conflicts.get(spec.id) ?? [])].filter((other) => ACTIVE.has(stageOf(other) ?? ""));
    const started = isStarted(stage);
    const done = MERGED_OR_LATER.has(stage ?? "");
    const reasons: Array<string> = [];
    if (done) reasons.push(`already ${stage}`);
    else if (started) reasons.push(`in progress (${stage})`);
    if (blockedBy.length) reasons.push(`waits on ${blockedBy.join(", ")}`);
    if (conflictHolds.length) reasons.push(`conflicts with active ${conflictHolds.join(", ")}`);
    const ready = !started && blockedBy.length === 0 && conflictHolds.length === 0;
    const needsAnswer = spec.kind === "question";
    const view: ChunkView = {
      id: spec.id,
      subject: subjects.get(spec.id) ?? null,
      spec,
      state: st,
      stage,
      blockedBy,
      dependents: dependentsOf(spec.id),
      conflictHolds,
      depth: depthOf(spec.id),
      ready,
      needsAnswer,
      reason: ready ? (needsAnswer ? "ready - needs answer" : "ready") : reasons.join("; "),
      holdApproved: st?.data.hold === "approved",
    };
    chunks.set(spec.id, view);
    if (ready) frontier.push(spec.id);
  }
  return { chunks, frontier, adhoc };
};
```

- [ ] **Step 4: Run tests and typecheck**

Run: `bun run --cwd skills/engineering/fleet-ship/scripts test src/run && bun run --cwd skills/engineering/fleet-ship/scripts typecheck`
Expected: all pass, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add skills/engineering/fleet-ship/scripts/src/run
git commit -m "feat(fleet-ship): join graph and ledger into readiness, frontier, depth, blockers"
```

---

### Task 8: `fleet log` guard, `fleet graph check`, `fleet init`

**Files:**
- Modify: `skills/engineering/fleet-ship/scripts/fleet.ts`
- Test: `skills/engineering/fleet-ship/scripts/fleet.test.ts` (extend)

**Interfaces:**
- Consumes: everything from Tasks 1 to 7.
- Produces CLI:
  - `fleet log <epic-dir|ledger.jsonl> <type> <subject|-> [--force] [--adhoc] [key=value ...]`. Epic mode guards; legacy file mode is unchanged.
  - `fleet graph check <epic-dir>` prints findings; exit 2 on any error finding, 0 otherwise (warnings printed to stderr).
  - `fleet init <home> <epic> --repo <owner/name> --plan <path> [--plan-sha <sha>]` creates the layout and prints what it created plus the git recipe when `<home>/.git` is absent.

Guard rules in `log` (epic mode, `fleet.chunk.*` types only):
1. Bare id must be in `graph.json` unless `--adhoc` (then `data.adhoc = true`). Missing `graph.json` means no id check and no transition check, but the step and evidence checks still run.
2. `isAllowed({stage, interrupted}, target)` or `--force` with a `reason=` pair; forced events get `data.forced = true`.
3. `data.step`, when present, must satisfy `hasStep(workflow, target, step)`.
4. `data.evidence`, when present, must be one of `EVIDENCE`.
5. `target === "merged"` on a `hold: human` chunk requires `hold=approved` on this event or on the chunk's folded data.

- [ ] **Step 1: Write the failing CLI tests**

Append to `fleet.test.ts`:

```ts
import { existsSync, mkdirSync } from "node:fs";
import { FIXTURE_EVENTS, RETRY_EVENTS } from "./src/testing/fixture.ts";
import { writeEpicDir } from "./src/testing/graphFixture.ts";

const tmpRoot = () => mkdtempSync(join(tmpdir(), "fleet-epic-"));
const lastLine = (dir: string, slug = "mbp") => JSON.parse(readFileSync(join(dir, `ledger.${slug}.jsonl`), "utf8").trim().split("\n").at(-1)!);

describe("fleet log (epic mode guard)", () => {
  test("an allowed transition appends to this machine's ledger file", () => {
    const dir = writeEpicDir(tmpRoot());
    const r = fleet(["log", dir, "fleet.chunk.building", "mbp/w1-docs", "pane=w1:p3"], { FLEET_SLUG: "mbp" });
    expect(r.code).toBe(0);
    expect(lastLine(dir).type).toBe("fleet.chunk.building");
  });
  test("skipping the gate is refused with exit 2 and the allowed targets", () => {
    const dir = writeEpicDir(tmpRoot());
    // w0-ffi is spawned; merged is not allowed from spawned
    const r = fleet(["log", dir, "fleet.chunk.merged", "mbp/w0-ffi"], { FLEET_SLUG: "mbp" });
    expect(r.code).toBe(2);
    expect(r.err).toContain("spawned");
    expect(r.err).toContain("planned");
  });
  test("--force with a reason records forced=true", () => {
    const dir = writeEpicDir(tmpRoot());
    const r = fleet(["log", "--force", dir, "fleet.chunk.merged", "mbp/w0-ffi", "reason=owner merged by hand"], { FLEET_SLUG: "mbp" });
    expect(r.code).toBe(0);
    expect(lastLine(dir).data).toMatchObject({ forced: true, reason: "owner merged by hand" });
  });
  test("--force without a reason is exit 2", () => {
    const dir = writeEpicDir(tmpRoot());
    expect(fleet(["log", "--force", dir, "fleet.chunk.merged", "mbp/w0-ffi"], { FLEET_SLUG: "mbp" }).code).toBe(2);
  });
  test("an unknown chunk id is exit 2 unless --adhoc", () => {
    const dir = writeEpicDir(tmpRoot());
    expect(fleet(["log", dir, "fleet.chunk.spawned", "mbp/hotfix-9"], { FLEET_SLUG: "mbp" }).code).toBe(2);
    const r = fleet(["log", "--adhoc", dir, "fleet.chunk.spawned", "mbp/hotfix-9"], { FLEET_SLUG: "mbp" });
    expect(r.code).toBe(0);
    expect(lastLine(dir).data.adhoc).toBe(true);
  });
  test("an unknown step for the stage is exit 2; a known one passes", () => {
    const dir = writeEpicDir(tmpRoot());
    expect(fleet(["log", dir, "fleet.chunk.building", "mbp/w1-docs", "step=consensus"], { FLEET_SLUG: "mbp" }).code).toBe(2);
    expect(fleet(["log", dir, "fleet.chunk.building", "mbp/w1-docs", "step=tdd-red"], { FLEET_SLUG: "mbp" }).code).toBe(0);
  });
  test("a bad evidence value is exit 2", () => {
    const dir = writeEpicDir(tmpRoot(), { events: RETRY_EVENTS.slice(0, 3) });
    expect(fleet(["log", dir, "fleet.chunk.built", "mbp/w1-ui", "evidence=trust-me"], { FLEET_SLUG: "mbp" }).code).toBe(2);
  });
  test("a held chunk cannot merge without hold=approved", () => {
    const events = [...FIXTURE_EVENTS, ...RETRY_EVENTS.slice(1, 11)]; // w1-ui up to gated PASS
    const dir = writeEpicDir(tmpRoot(), { events });
    expect(fleet(["log", dir, "fleet.chunk.merged", "mbp/w1-ui"], { FLEET_SLUG: "mbp" }).code).toBe(2);
    expect(fleet(["log", dir, "fleet.chunk.merged", "mbp/w1-ui", "hold=approved"], { FLEET_SLUG: "mbp" }).code).toBe(0);
  });
  test("legacy single-file mode has no guard", () => {
    const ledger = join(tmpRoot(), "demo.jsonl");
    expect(fleet(["log", ledger, "fleet.chunk.merged", "mbp/anything"]).code).toBe(0);
  });
});

describe("fleet graph check", () => {
  test("clean graph exits 0 and says so", () => {
    const dir = writeEpicDir(tmpRoot());
    const r = fleet(["graph", "check", dir]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("ok");
  });
  test("a cycle exits 2 with G120", () => {
    const root = tmpRoot();
    const dir = writeEpicDir(root, { graph: { ...FIXTURE_GRAPH_CYCLE } });
    const r = fleet(["graph", "check", dir]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("G120");
  });
});

describe("fleet init", () => {
  test("creates the home layout, an empty graph, DECISIONS.md, knowhow dirs, and prints the git recipe", () => {
    const home = join(tmpRoot(), "home");
    const r = fleet(["init", home, "demo", "--repo", "Necmttn/ax", "--plan", "docs/superpowers/plans/demo.md", "--plan-sha", "abc1234"]);
    expect(r.code).toBe(0);
    expect(existsSync(join(home, "demo", "graph.json"))).toBe(true);
    expect(existsSync(join(home, "demo", "DECISIONS.md"))).toBe(true);
    expect(existsSync(join(home, "knowhow", "inbox"))).toBe(true);
    expect(existsSync(join(home, "knowhow", "KNOWHOW.md"))).toBe(true);
    expect(readFileSync(join(home, ".gitignore"), "utf8")).toContain(".dagr/");
    expect(JSON.parse(readFileSync(join(home, "demo", "graph.json"), "utf8"))).toMatchObject({ epic: "demo", integration_branch: "epic/demo", chunks: [] });
    expect(r.out).toContain("git worktree add --orphan");
  });
  test("is idempotent: a second run does not overwrite an edited graph", () => {
    const home = join(tmpRoot(), "home");
    fleet(["init", home, "demo", "--repo", "Necmttn/ax", "--plan", "p.md"]);
    writeFileSync(join(home, "demo", "graph.json"), "{\"edited\":true}");
    const r = fleet(["init", home, "demo", "--repo", "Necmttn/ax", "--plan", "p.md"]);
    expect(r.code).toBe(0);
    expect(readFileSync(join(home, "demo", "graph.json"), "utf8")).toBe("{\"edited\":true}");
  });
});
```

Add to `src/testing/graphFixture.ts`:

```ts
export const FIXTURE_GRAPH_CYCLE: Graph = {
  ...FIXTURE_GRAPH,
  chunks: [
    { id: "a", title: "a", kind: "impl", lane: "mechanical", deps: ["b"], acceptance: "x" },
    { id: "b", title: "b", kind: "impl", lane: "mechanical", deps: ["a"], acceptance: "x" },
  ],
};
```

and import it in `fleet.test.ts`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run --cwd skills/engineering/fleet-ship/scripts test fleet.test.ts`
Expected: the new describes FAIL (unknown command `graph`, `init`; guard tests get exit 0 where 2 is expected).

- [ ] **Step 3: Add shared loaders to fleet.ts**

Insert after the `stdout` helper in `fleet.ts`:

```ts
import { epicPaths, isLedgerFile, slugOf, bundledWorkflowPath } from "./src/cli/epic.ts";
import { emptyGraph, encodeGraph, holdOf, parseGraph, type Graph } from "./src/graph/Graph.ts";
import { checkGraph, chunkById, formatFindings, hasErrors } from "./src/graph/check.ts";
import { DEFAULT_WORKFLOW, hasStep, parseWorkflow, stepsFor, type Workflow } from "./src/workflow/Workflow.ts";
import { allowedTargets, EVIDENCE, isAllowed } from "./src/ledger/transitions.ts";
import { bareId } from "./src/ledger/fold.ts";
import { layerDir } from "./src/ledger/Ledger.ts";
import { joinRun } from "./src/run/Run.ts";

class GraphInvalid extends Data.TaggedError("GraphInvalid")<{ readonly message: string }> {}

/** graph.json of an epic dir, or null when absent. Invalid JSON is an error, not null. */
const loadGraph = (path: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    if (!(yield* fs.exists(path))) return null;
    const parsed = parseGraph(yield* fs.readFileString(path));
    if (Result.isFailure(parsed)) return yield* new GraphInvalid({ message: `${path}: ${parsed.failure}` });
    return parsed.success;
  });

const loadWorkflow = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = process.env.FLEET_WORKFLOW || bundledWorkflowPath();
  if (!(yield* fs.exists(path))) return DEFAULT_WORKFLOW;
  const parsed = parseWorkflow(yield* fs.readFileString(path));
  if (Result.isFailure(parsed)) return yield* new UsageError({ message: `${path}: ${parsed.failure}` });
  return parsed.success;
});

/** Ledger layer for either form: a single file (legacy) or an epic directory. */
const ledgerLayerFor = (target: string) => (isLedgerFile(target) ? ledgerLayer(target) : layerDir(epicPaths(target, slugOf()).dir, slugOf()));

const readLedger = (target: string) =>
  Effect.gen(function* () {
    return yield* (yield* Ledger).readAll;
  }).pipe(Effect.provide(ledgerLayerFor(target)));
```

Add `GraphInvalid` to `exitCodeFor` (2) and `describe` (`fleet: ${message}`).

- [ ] **Step 4: Rewrite the `log` command with the guard**

Replace `logCommand` with:

```ts
const logCommand = Command.make(
  "log",
  {
    force: Flag.boolean("force").pipe(Flag.withDefault(false), Flag.withDescription("allow an illegal transition; requires reason=<text>")),
    adhoc: Flag.boolean("adhoc").pipe(Flag.withDefault(false), Flag.withDescription("allow a chunk id that is not in graph.json")),
    target: Argument.string("epic-dir-or-ledger"),
    type: Argument.string("type"),
    subject: Argument.string("subject"),
    pairs: Argument.variadic(Argument.string("pair")),
  },
  ({ force, adhoc, target, type, subject, pairs }) =>
    Effect.gen(function* () {
      if (!isFleetType(type)) return yield* new UsageError({ message: `type must be in the fleet.* namespace, lowercase dotted (got ${JSON.stringify(type)})` });
      const parsed = parseData(pairs);
      if (Result.isFailure(parsed)) return yield* new UsageError({ message: parsed.failure });
      const data: Record<string, unknown> = { ...parsed.success };
      const epicMode = !isLedgerFile(target);
      const paths = epicMode ? epicPaths(target, slugOf()) : null;

      if (epicMode && paths && type.startsWith("fleet.chunk.")) {
        const stage = type.slice("fleet.chunk.".length);
        const graph = yield* loadGraph(paths.graph);
        const workflow = yield* loadWorkflow;
        const { events } = yield* readLedger(target);
        const state = fold(events);
        const id = bareId(subject);
        const spec = graph ? chunkById(graph).get(id) : undefined;
        if (graph && !spec && !adhoc) return yield* new UsageError({ message: `chunk ${id} is not in ${paths.graph} (use --adhoc for a hotfix chunk)` });
        if (adhoc) data.adhoc = true;
        const current = state.chunks.get(subject) ?? null;
        const position = { stage: current?.stage ?? null, interrupted: current?.interrupted ?? null };
        if (!isAllowed(position, stage)) {
          if (!force) return yield* new UsageError({ message: `illegal transition ${position.stage ?? "(none)"} -> ${stage} for ${subject}; allowed: ${allowedTargets(position).join(", ") || "none"} (or --force reason=...)` });
          if (typeof data.reason !== "string" || data.reason === "") return yield* new UsageError({ message: `--force needs reason=<text>` });
          data.forced = true;
        }
        if (typeof data.step === "string" && !hasStep(workflow, stage, data.step)) {
          return yield* new UsageError({ message: `unknown step ${data.step} for stage ${stage}; steps: ${stepsFor(workflow, stage).join(", ") || "none"}` });
        }
        if (data.evidence !== undefined && !(EVIDENCE as ReadonlyArray<unknown>).includes(data.evidence)) {
          return yield* new UsageError({ message: `evidence must be one of ${EVIDENCE.join(", ")} (got ${String(data.evidence)})` });
        }
        if (stage === "merged" && spec && holdOf(spec) === "human" && data.hold !== "approved" && current?.data.hold !== "approved") {
          return yield* new UsageError({ message: `${id} is held for the owner; log merged with hold=approved once approved` });
        }
      }

      const source = process.env.FLEET_SOURCE || (paths ? `fleet/${paths.epic}/${slugOf()}` : defaultSource(target));
      const event = makeEvent({ type, subject: subject === "-" ? "" : subject, data, source });
      yield* Effect.gen(function* () {
        yield* (yield* Ledger).append(event);
      }).pipe(Effect.provide(ledgerLayerFor(target)));
    }),
).pipe(Command.withDescription("Append one fleet.* CloudEvents record; in epic mode the chunk transition is checked"));
```

Note: the existing tests pass a `.jsonl` path first, so legacy behaviour is unchanged. Keep the old `ledger` positional name change in mind: the first argument is now named `epic-dir-or-ledger`.

- [ ] **Step 5: Add `graph check`**

```ts
const graphCheckCommand = Command.make(
  "check",
  { dir: Argument.string("epic-dir") },
  ({ dir }) =>
    Effect.gen(function* () {
      const paths = epicPaths(dir, slugOf());
      const graph = yield* loadGraph(paths.graph);
      if (!graph) return yield* new UsageError({ message: `no graph.json in ${paths.dir}` });
      const findings = checkGraph(graph);
      if (findings.length) yield* stderr(formatFindings(findings));
      if (hasErrors(findings)) return yield* new GraphInvalid({ message: `${paths.graph}: ${findings.filter((f) => f.level === "error").length} error(s)` });
      yield* stdout(`graph ok: ${graph.chunks.length} chunks, ${findings.length} warning(s)\n`);
    }),
).pipe(Command.withDescription("Validate graph.json: cycles, dangling deps and conflicts, duplicate ids"));

const graphCommand = Command.make("graph").pipe(Command.withDescription("graph.json tooling"), Command.withSubcommands([graphCheckCommand]));
```

- [ ] **Step 6: Add `init`**

```ts
const KNOWHOW_SKELETON = `# Know-how\n\nCurated, per area. The librarian writes here; agents read it through \`fleet status\`.\n`;
const DECISIONS_SKELETON = (epic: string) => `# Decisions: ${epic}\n\nOne line per decision, newest last. Panes read this at start and before their gate.\n\n- (none yet)\n`;
const GIT_RECIPE = (home: string) =>
  `fleet home is not a git worktree yet. From the code repo checkout run:\n  git worktree add --orphan -b fleet ${home}\n  (git >= 2.42; then commit the files fleet init created)\n`;

const initCommand = Command.make(
  "init",
  {
    home: Argument.string("home"),
    epic: Argument.string("epic"),
    repo: Flag.string("repo"),
    plan: Flag.string("plan"),
    planSha: Flag.string("plan-sha").pipe(Flag.withDefault("")),
  },
  ({ home, epic, repo, plan, planSha }) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const created: Array<string> = [];
      const ensureDir = (p: string) => fs.makeDirectory(p, { recursive: true });
      const ensureFile = (p: string, body: string) =>
        Effect.gen(function* () {
          if (yield* fs.exists(p)) return;
          yield* fs.writeFileString(p, body);
          created.push(p);
        });
      const paths = epicPaths(`${home}/${epic}`, slugOf());
      yield* ensureDir(`${home}/knowhow/inbox`);
      yield* ensureDir(`${home}/knowhow/archive`);
      yield* ensureDir(paths.dir);
      yield* ensureFile(`${home}/.gitignore`, ".dagr/\nmessages.jsonl\n");
      yield* ensureFile(`${home}/knowhow/KNOWHOW.md`, KNOWHOW_SKELETON);
      yield* ensureFile(paths.graph, encodeGraph(emptyGraph({ epic, repo, planPath: plan, planSha })));
      yield* ensureFile(paths.decisions, DECISIONS_SKELETON(epic));
      yield* stdout(created.length ? `created:\n${created.map((c) => `  ${c}`).join("\n")}\n` : "nothing to create\n");
      if (!(yield* fs.exists(`${home}/.git`))) yield* stdout(GIT_RECIPE(home));
    }),
).pipe(Command.withDescription("Create the fleet home layout for an epic: graph.json, DECISIONS.md, knowhow/"));
```

Register in `root`: `Command.withSubcommands([logCommand, stateCommand, teardownCommand, graphCommand, initCommand])`.

- [ ] **Step 7: Run the whole suite and typecheck**

Run: `bun run --cwd skills/engineering/fleet-ship/scripts test && bun run --cwd skills/engineering/fleet-ship/scripts typecheck`
Expected: all pass, tsc clean. If the CLI rejects `--force` placed before positionals, move the flags after the positionals in the tests and note the accepted order in the command description; do not weaken assertions.

- [ ] **Step 8: Commit**

```bash
git add skills/engineering/fleet-ship/scripts
git commit -m "feat(fleet-ship): fleet log transition guard, fleet graph check, fleet init"
```

---

### Task 9: `fleet next` and `fleet status`

**Files:**
- Create: `skills/engineering/fleet-ship/scripts/src/render/next.ts`
- Create: `skills/engineering/fleet-ship/scripts/src/render/status.ts`
- Test: `skills/engineering/fleet-ship/scripts/src/render/next.test.ts`, `skills/engineering/fleet-ship/scripts/src/render/status.test.ts`
- Modify: `skills/engineering/fleet-ship/scripts/fleet.ts`, `skills/engineering/fleet-ship/scripts/fleet.test.ts`

**Interfaces:**
- Produces: `renderNext(view: RunView, now: Date): string`, `renderStatus(view: RunView, id: string, now: Date, workflow: Workflow): string | null` (null when the id is not in the graph).
- CLI: `fleet next <epic-dir>`, `fleet status <epic-dir> <chunk-id-or-subject>` (exit 2 when the chunk is unknown).

- [ ] **Step 1: Write the failing render tests**

```ts
// src/render/next.test.ts
import { describe, expect, test } from "bun:test";
import { fold } from "../ledger/fold.ts";
import { joinRun } from "../run/Run.ts";
import { FIXTURE_EVENTS } from "../testing/fixture.ts";
import { FIXTURE_GRAPH } from "../testing/graphFixture.ts";
import { renderNext } from "./next.ts";

describe("renderNext", () => {
  const text = renderNext(joinRun(FIXTURE_GRAPH, fold(FIXTURE_EVENTS)), new Date("2026-09-03T10:00:00Z"));
  test("frontier block lists ready chunks with kind, lane, hold, needs, and a question flag", () => {
    const frontier = text.split("not ready")[0]!;
    expect(frontier).toContain("frontier (2)");
    expect(frontier).toContain("w1-docs | impl | mechanical");
    expect(frontier).toContain("q1-name | question | judgment");
    expect(frontier).toContain("needs answer");
    expect(frontier).not.toContain("w1-ui");
  });
  test("not-ready block names blockers and skips done chunks", () => {
    const rest = text.split("not ready")[1]!;
    expect(rest).toContain("w1-ui");
    expect(rest).toContain("waits on w0-ffi");
    expect(rest).not.toContain("w0-prunes");
  });
});
```

```ts
// src/render/status.test.ts
import { describe, expect, test } from "bun:test";
import { fold } from "../ledger/fold.ts";
import { joinRun } from "../run/Run.ts";
import { FIXTURE_EVENTS, RETRY_EVENTS } from "../testing/fixture.ts";
import { FIXTURE_GRAPH } from "../testing/graphFixture.ts";
import { DEFAULT_WORKFLOW } from "../workflow/Workflow.ts";
import { renderStatus } from "./status.ts";

const NOW = new Date("2026-09-03T11:00:00Z");

describe("renderStatus", () => {
  test("a started chunk shows stage, step, attempts, blockers, dependents, acceptance", () => {
    const events = [...FIXTURE_EVENTS, ...RETRY_EVENTS.slice(1, 10)];
    const text = renderStatus(joinRun(FIXTURE_GRAPH, fold(events)), "w1-ui", NOW, DEFAULT_WORKFLOW)!;
    expect(text).toContain("chunk: w1-ui");
    expect(text).toContain("stage: in_review");
    expect(text).toContain("step: codex-review");
    expect(text).toContain("next steps: adversarial-review");
    expect(text).toContain("attempt: 2 (gate_failed)");
    expect(text).toContain("blocked by: w0-ffi (spawned)");
    expect(text).toContain("conflicts: w1-docs");
    expect(text).toContain("hold: human (not approved)");
    expect(text).toContain("acceptance: screens match");
  });
  test("dependents list their pane ids when known", () => {
    const text = renderStatus(joinRun(FIXTURE_GRAPH, fold(FIXTURE_EVENTS)), "w0-prunes", NOW, DEFAULT_WORKFLOW)!;
    expect(text).toContain("dependents: w1-ui (-), w1-docs (-)");
  });
  test("unknown chunk is null", () => {
    expect(renderStatus(joinRun(FIXTURE_GRAPH, fold(FIXTURE_EVENTS)), "nope", NOW, DEFAULT_WORKFLOW)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run --cwd skills/engineering/fleet-ship/scripts test src/render/next.test.ts src/render/status.test.ts`
Expected: FAIL, modules missing.

- [ ] **Step 3: Write next.ts**

```ts
// src/render/next.ts
/** The frontier: what the orchestrator may spawn now, and why the rest cannot. Pure. */
import { holdOf } from "../graph/Graph.ts";
import { MERGED_OR_LATER } from "../ledger/transitions.ts";
import type { RunView } from "../run/Run.ts";

const needsText = (needs: Record<string, unknown> | undefined) =>
  needs && Object.keys(needs).length ? Object.entries(needs).map(([k, v]) => `${k}=${String(v)}`).join(",") : "-";

export const renderNext = (view: RunView, now: Date): string => {
  const out: Array<string> = [];
  out.push(`frontier (${view.frontier.length}) at ${now.toISOString()}`);
  out.push("chunk | kind | lane | hold | needs | note");
  for (const id of view.frontier) {
    const c = view.chunks.get(id)!;
    out.push([id, c.spec.kind, c.spec.lane, holdOf(c.spec) ?? "-", needsText(c.spec.needs), c.needsAnswer ? "needs answer - do not spawn a build pane" : "spawn"].join(" | "));
  }
  if (view.frontier.length === 0) out.push("(nothing ready)");
  out.push("", "not ready");
  let any = false;
  for (const c of view.chunks.values()) {
    if (c.ready || MERGED_OR_LATER.has(c.stage ?? "")) continue;
    any = true;
    out.push(`${c.id} | ${c.stage ?? "-"} | ${c.reason}`);
  }
  if (!any) out.push("(none)");
  if (view.adhoc.length) out.push("", `adhoc (not in graph): ${view.adhoc.join(", ")}`);
  return out.join("\n") + "\n";
};
```

- [ ] **Step 4: Write status.ts**

```ts
// src/render/status.ts
/** One chunk, for the pane that owns it (spec section 12). Pure. */
import { holdOf } from "../graph/Graph.ts";
import type { RunView } from "../run/Run.ts";
import { stepsFor, type Workflow } from "../workflow/Workflow.ts";
import { age } from "./state.ts";

export const renderStatus = (view: RunView, idOrSubject: string, now: Date, workflow: Workflow): string | null => {
  const id = idOrSubject.split("/").at(-1) ?? idOrSubject;
  const c = view.chunks.get(id);
  if (!c) return null;
  const st = c.state;
  const attempt = st?.attempts.at(-1);
  const steps = stepsFor(workflow, c.stage ?? "");
  const nextSteps = st?.step ? steps.slice(steps.indexOf(st.step) + 1) : steps;
  const paneOf = (dep: string) => view.chunks.get(dep)?.state?.data.pane ?? "-";
  const stageOf = (dep: string) => view.chunks.get(dep)?.stage ?? "not started";
  const hold = holdOf(c.spec);
  const lines = [
    `chunk: ${c.id}  (${c.spec.title})`,
    `subject: ${c.subject ?? "-"}   pane: ${String(st?.data.pane ?? "-")}   engine: ${String(st?.data.engine ?? "-")}`,
    `stage: ${c.stage ?? "not started"}   step: ${st?.step ?? "-"}   since: ${age(st?.time ?? null, now)} ago`,
    `next steps: ${nextSteps.join(", ") || "-"}`,
    `attempt: ${attempt ? `${attempt.n} (${attempt.cause})` : "-"}   evidence: ${st?.evidence ?? "-"}`,
    `ready: ${c.ready ? "yes" : "no"} - ${c.reason}`,
    `blocked by: ${c.blockedBy.length ? c.blockedBy.map((d) => `${d} (${stageOf(d)})`).join(", ") : "-"}`,
    `dependents: ${c.dependents.length ? c.dependents.map((d) => `${d} (${String(paneOf(d))})`).join(", ") : "-"}`,
    `conflicts: ${(c.spec.conflicts ?? []).join(", ") || "-"}${c.conflictHolds.length ? `  ACTIVE: ${c.conflictHolds.join(", ")}` : ""}`,
    `hold: ${hold ? `${hold} (${c.holdApproved ? "approved" : "not approved"})` : "-"}`,
    `pr: ${String(st?.data.pr ?? "-")}   commit: ${String(st?.data.commit ?? "-")}`,
    `acceptance: ${c.spec.acceptance}`,
    `plan: ${c.spec.plan_ref ?? "-"}   lane: ${c.spec.lane}   kind: ${c.spec.kind}   areas: ${(c.spec.areas ?? []).join(",") || "-"}`,
  ];
  return lines.join("\n") + "\n";
};
```

- [ ] **Step 5: Add the CLI commands to fleet.ts**

```ts
import { renderNext } from "./src/render/next.ts";
import { renderStatus } from "./src/render/status.ts";

/** graph + folded ledger of an epic dir; UsageError when graph.json is missing. */
const loadRun = (dir: string) =>
  Effect.gen(function* () {
    const paths = epicPaths(dir, slugOf());
    const graph = yield* loadGraph(paths.graph);
    if (!graph) return yield* new UsageError({ message: `no graph.json in ${paths.dir} - run fleet init, then write the graph` });
    const { events, malformed } = yield* readLedger(dir);
    for (const m of malformed) yield* stderr(`fleet: ${m.file ?? paths.ledger} line ${m.line} malformed (${m.reason})`);
    const state = fold(events);
    if (!state.epic) state.epic = paths.epic;
    return { paths, graph, events, malformed, state, view: joinRun(graph, state) };
  });

const nextCommand = Command.make("next", { dir: Argument.string("epic-dir") }, ({ dir }) =>
  Effect.gen(function* () {
    const run = yield* loadRun(dir);
    yield* stdout(renderNext(run.view, new Date()));
  }),
).pipe(Command.withDescription("Print the frontier: chunks the orchestrator may spawn now, and why the rest wait"));

const statusCommand = Command.make("status", { dir: Argument.string("epic-dir"), chunk: Argument.string("chunk") }, ({ dir, chunk }) =>
  Effect.gen(function* () {
    const run = yield* loadRun(dir);
    const workflow = yield* loadWorkflow;
    const text = renderStatus(run.view, chunk, new Date(), workflow);
    if (!text) return yield* new UsageError({ message: `chunk ${chunk} is not in ${run.paths.graph}` });
    yield* stdout(text);
  }),
).pipe(Command.withDescription("Print one chunk for the pane that owns it: stage, step, attempt, blockers, dependents, acceptance"));
```

Register both in `root`.

- [ ] **Step 6: Add CLI tests**

Append to `fleet.test.ts`:

```ts
describe("fleet next / status", () => {
  test("next prints the frontier from an epic dir", () => {
    const r = fleet(["next", writeEpicDir(tmpRoot())], { FLEET_SLUG: "mbp" });
    expect(r.code).toBe(0);
    expect(r.out).toContain("frontier (2)");
    expect(r.out).toContain("w1-docs");
  });
  test("status prints one chunk and exit 2 for an unknown one", () => {
    const dir = writeEpicDir(tmpRoot());
    const ok = fleet(["status", dir, "mbp/w0-prunes"], { FLEET_SLUG: "mbp" });
    expect(ok.code).toBe(0);
    expect(ok.out).toContain("stage: merged");
    expect(fleet(["status", dir, "nope"], { FLEET_SLUG: "mbp" }).code).toBe(2);
  });
  test("next without a graph.json is exit 2 with a hint", () => {
    const dir = writeEpicDir(tmpRoot(), { graph: null });
    const r = fleet(["next", dir], { FLEET_SLUG: "mbp" });
    expect(r.code).toBe(2);
    expect(r.err).toContain("fleet init");
  });
});
```

- [ ] **Step 7: Run tests and typecheck**

Run: `bun run --cwd skills/engineering/fleet-ship/scripts test && bun run --cwd skills/engineering/fleet-ship/scripts typecheck`
Expected: all pass, tsc clean.

- [ ] **Step 8: Commit**

```bash
git add skills/engineering/fleet-ship/scripts
git commit -m "feat(fleet-ship): fleet next (frontier) and fleet status (per-chunk view)"
```

---

### Task 10: `fleet state` epic mode

**Files:**
- Modify: `skills/engineering/fleet-ship/scripts/src/render/state.ts`
- Modify: `skills/engineering/fleet-ship/scripts/src/render/state.test.ts`
- Modify: `skills/engineering/fleet-ship/scripts/fleet.ts`, `skills/engineering/fleet-ship/scripts/fleet.test.ts`

**Interfaces:**
- `RenderInput` gains `readonly run?: RunView | undefined`. With `run`, the chunks block is grouped by depth (`depth 0`, `depth 1`, ...), each row gains `blocked-by` and `step` columns, graph chunks with no ledger event appear as `not started`, and the checklist gains `frontier: N`. Without `run`, output is byte-identical to today.
- CLI: `fleet state <epic-dir|ledger.jsonl> [--live] [--session] [--tail]`. Epic dirs load the graph when present.

- [ ] **Step 1: Write the failing test**

Append to `src/render/state.test.ts`:

```ts
import { joinRun } from "../run/Run.ts";
import { FIXTURE_GRAPH } from "../testing/graphFixture.ts";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd skills/engineering/fleet-ship/scripts test src/render/state.test.ts`
Expected: FAIL on `run` not being accepted / no `depth 0`.

- [ ] **Step 3: Extend render/state.ts**

Add to `RenderInput`: `readonly run?: RunView | undefined;` (import `type { RunView } from "../run/Run.ts"`). Replace the chunks block (from `out.push("", "chunks", ...)` to the `(no chunk events yet)` line) with:

```ts
  const claimed = new Set<string>();
  const chunkNames = new Set<string>();
  const gone: Array<string> = [];
  const liveStatus = (subject: string, chunk: ChunkState | null): string => {
    const pane = text(chunk?.data.pane);
    const name = subject.split("/").at(-1) ?? subject;
    chunkNames.add(name);
    const agent = byPane.get(pane) ?? byName.get(name);
    let status = "-";
    if (live !== undefined && chunk) {
      if (agent) {
        status = agent.agent_status ?? "?";
        claimed.add(agent.pane_id);
      } else if (pane && !TERMINAL.has(chunk.stage)) {
        status = "gone";
        gone.push(`${subject} pane ${pane}`);
      }
    }
    if (pane) claimed.add(pane);
    return status;
  };
  const legacyRow = (subject: string, chunk: ChunkState) => {
    const status = liveStatus(subject, chunk);
    const gist = text(chunk.data.gist) || text(chunk.data.commit);
    return [subject, chunk.stage, text(chunk.data.pane) || "-", status, text(chunk.data.engine) || "-", text(chunk.data.pr) || "-", age(chunk.time, now), gist].join(" | ");
  };

  if (run) {
    out.push("", "chunks", "chunk | stage | step | blocked-by | pane | live | engine | pr | age | gist");
    const byDepth = new Map<number, Array<ChunkView>>();
    for (const view of run.chunks.values()) byDepth.set(view.depth, [...(byDepth.get(view.depth) ?? []), view]);
    for (const depth of [...byDepth.keys()].sort((a, b) => a - b)) {
      out.push(`depth ${depth}`);
      for (const view of byDepth.get(depth)!) {
        const chunk = view.state;
        const subject = view.subject ?? view.id;
        const status = liveStatus(subject, chunk);
        const gist = text(chunk?.data.gist) || text(chunk?.data.commit);
        out.push([
          subject, chunk?.stage ?? "not started", chunk?.step ?? "-", view.blockedBy.join(",") || "-",
          text(chunk?.data.pane) || "-", status, text(chunk?.data.engine) || "-", text(chunk?.data.pr) || "-",
          chunk ? age(chunk.time, now) : "-", gist,
        ].join(" | "));
      }
    }
    for (const subject of run.adhoc) out.push(legacyRow(subject, state.chunks.get(subject)!) + " | ADHOC");
  } else {
    out.push("", "chunks", "chunk | stage | pane | live | engine | pr | age | gist");
    for (const [subject, chunk] of state.chunks) out.push(legacyRow(subject, chunk));
    if (state.chunks.size === 0) out.push("(no chunk events yet)");
  }
```

Import `type { ChunkState }` from `../ledger/fold.ts` and `type { ChunkView, RunView }` from `../run/Run.ts`. In the checklist block, after the counts line, add:

```ts
  if (run) out.push(`frontier: ${run.frontier.length}${run.frontier.length ? " (" + run.frontier.join(", ") + ")" : ""}`);
```

- [ ] **Step 4: Update the state command in fleet.ts**

Replace the body of `stateCommand` so it handles both forms:

```ts
  ({ ledger: target, live, session, tail }) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      if (!(yield* fs.exists(target))) return yield* new UsageError({ message: `ledger or epic dir does not exist: ${target}` });
      const epicMode = !isLedgerFile(target);
      const paths = epicMode ? epicPaths(target, slugOf()) : null;
      const graph = paths ? yield* loadGraph(paths.graph) : null;
      const { events, malformed } = yield* readLedger(target);
      for (const m of malformed) yield* stderr(`fleet-state: ${m.file ? m.file + " " : ""}line ${m.line} malformed (${m.reason}): ${m.raw.slice(0, 80)}`);
      const state = fold(events);
      if (!state.epic) state.epic = paths ? paths.epic : basename(target, extname(target));
      const sessionName = Option.getOrNull(session) ?? state.session;
      const agents = live
        ? yield* Effect.gen(function* () {
            return yield* (yield* Herdr).agents.list;
          }).pipe(
            Effect.provide(HerdrCli.layer(sessionName)),
            Effect.catchTag("HerdrCommandFailed", (e) => stderr(`fleet-state: herdr agent list failed: ${e.output}`).pipe(Effect.as([]))),
          )
        : undefined;
      const run = graph ? joinRun(graph, state) : undefined;
      yield* stdout(render({ state, events, malformed: malformed.length, tail, now: new Date(), live: agents, run }));
    }),
```

Rename the positional to `Argument.string("epic-dir-or-ledger")` and keep the destructured name via `ledger: target` as shown.

- [ ] **Step 5: Add a CLI test**

Append to `fleet.test.ts`:

```ts
describe("fleet state (epic mode)", () => {
  test("renders depth groups and the frontier from an epic dir", () => {
    const r = fleet(["state", writeEpicDir(tmpRoot()), "--tail", "3"], { FLEET_SLUG: "mbp" });
    expect(r.code).toBe(0);
    expect(r.out).toContain("depth 0");
    expect(r.out).toContain("frontier: 2");
    expect(r.out).toContain("not started");
  });
});
```

- [ ] **Step 6: Run tests and typecheck**

Run: `bun run --cwd skills/engineering/fleet-ship/scripts test && bun run --cwd skills/engineering/fleet-ship/scripts typecheck`
Expected: all pass, including the untouched legacy `fleet state` tests, tsc clean.

- [ ] **Step 7: Commit**

```bash
git add skills/engineering/fleet-ship/scripts
git commit -m "feat(fleet-ship): fleet state epic mode - depth groups, step and blocked-by columns, frontier"
```

---

### Task 11: `fleet stats`

**Files:**
- Create: `skills/engineering/fleet-ship/scripts/src/run/stats.ts`
- Create: `skills/engineering/fleet-ship/scripts/src/render/stats.ts`
- Test: `skills/engineering/fleet-ship/scripts/src/run/stats.test.ts`
- Modify: `skills/engineering/fleet-ship/scripts/fleet.ts`, `skills/engineering/fleet-ship/scripts/fleet.test.ts`

**Interfaces:**
- Produces:

```ts
interface StageStat { lane: string; stage: string; count: number; meanMin: number; maxMin: number }
interface Stats {
  byLaneStage: ReadonlyArray<StageStat>;              // time spent IN each stage, per lane
  attempts: ReadonlyArray<{ id: string; attempts: number; causes: ReadonlyArray<string> }>; // chunks with > 1 attempt
  causes: ReadonlyMap<string, number>;                // gate_failed / sent_back / followup counts
  slowest: ReadonlyArray<{ id: string; stage: string; minutes: number }>; // top 5 stage dwell times
  evidence: ReadonlyMap<string, number>;              // verified / reported / asserted on merged chunks
}
computeStats(graph: Graph, events: ReadonlyArray<FleetEvent>): Stats
renderStats(stats: Stats): string
```

Dwell time in a stage = time from the event that entered it to the next `fleet.chunk.*` event of the same subject. The last (current) stage has no dwell. Lane comes from the graph; an adhoc chunk's lane is `adhoc`.

- [ ] **Step 1: Write the failing test**

```ts
// src/run/stats.test.ts
import { describe, expect, test } from "bun:test";
import { RETRY_EVENTS } from "../testing/fixture.ts";
import { FIXTURE_GRAPH } from "../testing/graphFixture.ts";
import { computeStats } from "./stats.ts";
import { renderStats } from "../render/stats.ts";

describe("computeStats", () => {
  const stats = computeStats(FIXTURE_GRAPH, RETRY_EVENTS);
  test("dwell per lane and stage: w1-ui (design) visited building three times (18, 9, 15 minutes)", () => {
    const building = stats.byLaneStage.find((s) => s.lane === "design" && s.stage === "building")!;
    expect(building.count).toBe(3); // 09:02-09:20, 09:31-09:40, 09:45-10:00
    expect(building.maxMin).toBe(18);
    expect(Math.round(building.meanMin)).toBe(14);
  });
  test("attempts and causes", () => {
    expect(stats.attempts).toEqual([{ id: "w1-ui", attempts: 2, causes: ["initial", "gate_failed"] }]);
    expect(stats.causes.get("gate_failed")).toBe(1);
  });
  test("slowest lists the longest dwell first", () => {
    expect(stats.slowest[0]).toEqual({ id: "w1-ui", stage: "building", minutes: 18 });
  });
  test("evidence on merged chunks", () => {
    expect(stats.evidence.get("verified")).toBe(1);
  });
  test("renderStats prints every block", () => {
    const text = renderStats(stats);
    expect(text).toContain("time in stage (minutes) by lane");
    expect(text).toContain("design | building | 3 |");
    expect(text).toContain("retries");
    expect(text).toContain("w1-ui: 2 attempts (initial, gate_failed)");
    expect(text).toContain("slowest");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd skills/engineering/fleet-ship/scripts test src/run/stats.test.ts`
Expected: FAIL, modules missing.

- [ ] **Step 3: Write stats.ts**

```ts
// src/run/stats.ts
/** Flow measurements over graph + ledger (spec 7.5 `fleet stats`). Pure. */
import type { Graph } from "../graph/Graph.ts";
import { chunkById } from "../graph/check.ts";
import type { FleetEvent } from "../ledger/Event.ts";
import { bareId, fold } from "../ledger/fold.ts";

export interface StageStat { lane: string; stage: string; count: number; meanMin: number; maxMin: number }
export interface Stats {
  byLaneStage: ReadonlyArray<StageStat>;
  attempts: ReadonlyArray<{ id: string; attempts: number; causes: ReadonlyArray<string> }>;
  causes: ReadonlyMap<string, number>;
  slowest: ReadonlyArray<{ id: string; stage: string; minutes: number }>;
  evidence: ReadonlyMap<string, number>;
}

const minutes = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);

export const computeStats = (graph: Graph, events: ReadonlyArray<FleetEvent>): Stats => {
  const byId = chunkById(graph);
  const laneOf = (subject: string) => byId.get(bareId(subject))?.lane ?? "adhoc";

  // dwell per (subject, stage): consecutive chunk events of the same subject
  const perSubject = new Map<string, Array<FleetEvent>>();
  for (const e of events) {
    if (!e.type.startsWith("fleet.chunk.")) continue;
    perSubject.set(e.subject, [...(perSubject.get(e.subject) ?? []), e]);
  }
  const dwells: Array<{ id: string; lane: string; stage: string; minutes: number }> = [];
  for (const [subject, list] of perSubject) {
    for (let i = 0; i + 1 < list.length; i++) {
      const stage = list[i]!.type.slice("fleet.chunk.".length);
      dwells.push({ id: bareId(subject), lane: laneOf(subject), stage, minutes: minutes(list[i]!.time, list[i + 1]!.time) });
    }
  }
  const groups = new Map<string, Array<number>>();
  for (const d of dwells) {
    const key = `${d.lane} ${d.stage}`;
    groups.set(key, [...(groups.get(key) ?? []), d.minutes]);
  }
  const byLaneStage: Array<StageStat> = [...groups.entries()].map(([key, xs]) => {
    const [lane, stage] = key.split(" ") as [string, string];
    return { lane, stage, count: xs.length, meanMin: xs.reduce((a, b) => a + b, 0) / xs.length, maxMin: Math.max(...xs) };
  }).sort((a, b) => a.lane.localeCompare(b.lane) || a.stage.localeCompare(b.stage));

  const state = fold(events);
  const attempts: Array<{ id: string; attempts: number; causes: Array<string> }> = [];
  const causes = new Map<string, number>();
  const evidence = new Map<string, number>();
  for (const [subject, chunk] of state.chunks) {
    if (chunk.attempts.length > 1) attempts.push({ id: bareId(subject), attempts: chunk.attempts.length, causes: chunk.attempts.map((a) => a.cause) });
    for (const a of chunk.attempts) if (a.cause !== "initial") causes.set(a.cause, (causes.get(a.cause) ?? 0) + 1);
    if (chunk.stage === "merged" || chunk.stage === "dogfooded" || chunk.stage === "archived" || chunk.stage === "closed") {
      const ev = chunk.evidence ?? "asserted";
      evidence.set(ev, (evidence.get(ev) ?? 0) + 1);
    }
  }
  const slowest = [...dwells].sort((a, b) => b.minutes - a.minutes).slice(0, 5).map(({ id, stage, minutes }) => ({ id, stage, minutes }));
  return { byLaneStage, attempts, causes, slowest, evidence };
};
```

- [ ] **Step 4: Write render/stats.ts**

```ts
// src/render/stats.ts
import type { Stats } from "../run/stats.ts";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export const renderStats = (stats: Stats): string => {
  const out: Array<string> = [];
  out.push("time in stage (minutes) by lane", "lane | stage | count | mean | max");
  for (const s of stats.byLaneStage) out.push(`${s.lane} | ${s.stage} | ${s.count} | ${fmt(s.meanMin)} | ${s.maxMin}`);
  if (stats.byLaneStage.length === 0) out.push("(no completed stages yet)");
  out.push("", "retries");
  for (const a of stats.attempts) out.push(`${a.id}: ${a.attempts} attempts (${a.causes.join(", ")})`);
  if (stats.attempts.length === 0) out.push("(none)");
  out.push("", "causes: " + ([...stats.causes.entries()].map(([k, v]) => `${k}=${v}`).join("  ") || "none"));
  out.push("", "slowest");
  for (const s of stats.slowest) out.push(`${s.id} ${s.stage} ${s.minutes}m`);
  if (stats.slowest.length === 0) out.push("(none)");
  out.push("", "evidence on merged: " + ([...stats.evidence.entries()].map(([k, v]) => `${k}=${v}`).join("  ") || "none"));
  return out.join("\n") + "\n";
};
```

- [ ] **Step 5: Add the CLI command and a test**

In `fleet.ts`:

```ts
import { computeStats } from "./src/run/stats.ts";
import { renderStats } from "./src/render/stats.ts";

const statsCommand = Command.make("stats", { dir: Argument.string("epic-dir") }, ({ dir }) =>
  Effect.gen(function* () {
    const run = yield* loadRun(dir);
    yield* stdout(renderStats(computeStats(run.graph, run.events)));
  }),
).pipe(Command.withDescription("Time in stage per lane, retries and their causes, slowest stages, evidence on merged"));
```

Register in `root`. Append to `fleet.test.ts`:

```ts
describe("fleet stats", () => {
  test("prints the stats blocks from an epic dir", () => {
    const r = fleet(["stats", writeEpicDir(tmpRoot(), { events: RETRY_EVENTS })], { FLEET_SLUG: "mbp" });
    expect(r.code).toBe(0);
    expect(r.out).toContain("time in stage");
    expect(r.out).toContain("w1-ui: 2 attempts");
  });
});
```

- [ ] **Step 6: Run tests and typecheck**

Run: `bun run --cwd skills/engineering/fleet-ship/scripts test && bun run --cwd skills/engineering/fleet-ship/scripts typecheck`
Expected: all pass, tsc clean.

- [ ] **Step 7: Commit**

```bash
git add skills/engineering/fleet-ship/scripts
git commit -m "feat(fleet-ship): fleet stats - dwell per lane and stage, retries, causes, evidence"
```

---

### Task 12: Spec retractions and the skill pointer

**Files:**
- Modify: `docs/specs/2026-09-04-fleet-graph-visibility-design.md`
- Modify: `skills/engineering/fleet-ship/SKILL.md` (the "Ledger + state view" section)

Two spec statements changed during implementation. Retract in place; do not delete.

- [ ] **Step 1: Retract the first-event rule in the transition table**

In section 7.1, change the row `| (none) | assigned |` to:

```
| (none) | assigned, spawned |
```

and add directly under the table:

```
> Retracted 2026-09-04 during chunk 1: the first draft allowed only `(none) -> assigned`. Every existing ledger starts at `spawned` or `building`, and a spawn implies assignment, so `spawned` is also a legal first stage. The inference that every chunk gets an explicit assign event before a pane exists was wrong; the orchestrator assigns and spawns in one wake.
```

- [ ] **Step 2: Retract the hold clause in readiness**

In section 7.4, change the readiness sentence to:

```
Readiness: a chunk is **ready** when every dep is `merged` or later, it has no stage yet or is `assigned`, and no conflicting chunk is active (`spawned` through `gated`, including `blocked` and `error`). `hold` does not affect readiness: a held chunk is spawned and built like any other and stops at `gated`. The guard enforces the hold on the `gated -> merged` transition, which needs `hold=approved` on that event or on the chunk's folded data.
```

and add under it:

```
> Retracted 2026-09-04 during chunk 1: the first draft made readiness depend on "the hold was approved". That conflated spawn readiness with merge permission. A hold gates the merge, not the start; the Held-chunks rule in SKILL.md already says "runs the full loop, stops at GATED".
```

- [ ] **Step 3: Add the epic-mode paragraph to SKILL.md**

In the "Ledger + state view" section, directly after the paragraph that starts `The ledger is \`docs/superpowers/fleet-runs/<epic>.jsonl\``, insert:

```
**Epic mode (2026-09-04, spec `docs/specs/2026-09-04-fleet-graph-visibility-design.md`):** every `fleet` command also accepts an
**epic directory** `<FLEET_HOME>/<epic>` (default home `~/.fleet/<repo>`, an orphan-branch worktree created with
`fleet init <home> <epic> --repo <owner/name> --plan <path>`). The directory holds `graph.json` (chunks + deps +
conflicts + lane + hold, plan-only; validate with `fleet graph check <dir>`), one `ledger.<slug>.jsonl` per machine, and
`DECISIONS.md`. In epic mode `fleet log` REFUSES an illegal stage transition (exit 2, prints the allowed targets; `--force`
with `reason=` overrides and records `forced=true`), an unknown chunk id (`--adhoc` overrides), an unknown `step=` for
the stage (steps come from `scripts/workflow.json`), a bad `evidence=` (`verified|reported|asserted`), and `merged` on a
held chunk without `hold=approved`. New views: `fleet next <dir>` (the frontier - the ONLY chunks a wave may spawn),
`fleet status <dir> <chunk>` (put this line in every brief so the pane sees its stage, blockers, dependents, acceptance),
`fleet stats <dir>` (dwell per lane/stage, retries, causes). `fleet state <dir>` groups chunks by depth and adds `step` and
`blocked-by` columns. The single-file form `fleet <cmd> <ledger>.jsonl` still works unchanged for runs already in flight.
```

- [ ] **Step 4: Run the full suite one last time**

Run: `bun run --cwd skills/engineering/fleet-ship/scripts test && bun run --cwd skills/engineering/fleet-ship/scripts typecheck`
Expected: all pass, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add docs/specs/2026-09-04-fleet-graph-visibility-design.md skills/engineering/fleet-ship/SKILL.md
git commit -m "docs(fleet-ship): retract first-event and hold-readiness rules in place; document epic mode"
```

---

## Self-review

**Spec coverage for chunk 1 (section 16.1):** fleet home + `fleet init` (Task 8), `graph.json` + `fleet graph check` (Tasks 1, 2, 8), fold extension (Task 5), transition guard (Tasks 4, 8), `step` + `evidence` (Tasks 3, 5, 8), `fleet next` + `fleet status` (Task 9), `fleet state` changes (Task 10), `fleet stats` (Task 11), `workflow.json` (Task 3), multi-machine ledgers (Task 6). Out of this chunk by design: reconcile, dagr, trailers, GitHub sync, knowhow commands, `fleet render log`, `fleet teardown` epic-dir support (teardown keeps the ledger-file form until chunk 2, which is when it moves; the run in flight uses the file form).

**Deviations from the spec, both retracted in place in Task 12:** first legal stage includes `spawned`; hold does not gate readiness.

**Type consistency:** `Position { stage: string | null; interrupted: string | null }` is used identically in Tasks 4, 5, 8. `ChunkView.holdApproved` (Task 7) is read by `renderStatus` (Task 9). `MalformedLine.file` (Task 6) is read in Tasks 9 and 10. `bareId` lives in `fold.ts` (Task 5) and is imported by Tasks 7, 8, 11. `loadRun` (Task 9) is reused by Task 11.

**Known follow-ups to file as issues after chunk 1 lands:** `fleet teardown <epic-dir>`; the `fleet status` know-how tail (chunk 4); an `Argument.directory` form once the CLI's directory validation is confirmed stable.
