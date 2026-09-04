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

export const FIXTURE_GRAPH_CYCLE: Graph = {
  ...FIXTURE_GRAPH,
  chunks: [
    { id: "a", title: "a", kind: "impl", lane: "mechanical", deps: ["b"], acceptance: "x" },
    { id: "b", title: "b", kind: "impl", lane: "mechanical", deps: ["a"], acceptance: "x" },
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
