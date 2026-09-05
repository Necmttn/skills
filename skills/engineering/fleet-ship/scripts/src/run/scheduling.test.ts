import { expect, test } from "bun:test";
import { fold } from "../ledger/fold.ts";
import { event as fixtureEvent } from "../testing/fixture.ts";
import { FIXTURE_GRAPH } from "../testing/graphFixture.ts";
import { joinRun } from "./Run.ts";
const event = (...args: Parameters<typeof fixtureEvent>) => ({ ...fixtureEvent(...args), id: crypto.randomUUID() });

const graph = { ...FIXTURE_GRAPH, scheduling: { max_in_flight: 2, max_gate_queue: 1 },
  chunks: ["a", "b", "c"].map((id) => ({ ...FIXTURE_GRAPH.chunks[0]!, id, deps: [] })) };

test("the rolling window includes assigned, building, and gated work", () => {
  expect(joinRun(graph, fold([])).frontier).toEqual(["a", "b"]);
  const view = joinRun(graph, fold([event("fleet.chunk.assigned", "mac/a"), event("fleet.chunk.building", "mac/b")]));
  expect(view.frontier).toEqual([]);
  expect(view.chunks.get("c")!.reason).toContain("capacity");
});

test("a gate queue limit stops new builds while human questions remain visible", () => {
  const question = { ...graph.chunks[0]!, id: "question", kind: "question" as const };
  const view = joinRun({ ...graph, chunks: [...graph.chunks, question] }, fold([event("fleet.chunk.built", "mac/a")]));
  expect(view.frontier).toEqual(["question"]);
  expect(view.chunks.get("b")!.reason).toContain("gate queue");
});

test("pause and resume survive event replay", () => {
  const paused = event("fleet.policy.set", "spawn-paused", { text: "broken shared verifier" });
  expect(joinRun(graph, fold([paused])).frontier).toEqual([]);
  expect(joinRun(graph, fold([paused])).chunks.get("a")!.reason).toContain("broken shared verifier");
  expect(joinRun(graph, fold([paused, event("fleet.policy.set", "spawn-paused", { text: "off" })])).frontier).toEqual(["a", "b"]);
});

test("a pilot must reach dogfooded before broad assignment", () => {
  const pilotGraph = { ...graph, scheduling: { ...graph.scheduling, pilot: "a" } };
  expect(joinRun(pilotGraph, fold([])).frontier).toEqual(["a"]);
  expect(joinRun(pilotGraph, fold([event("fleet.chunk.merged", "mac/a")])).frontier).toEqual([]);
  expect(joinRun(pilotGraph, fold([event("fleet.chunk.dogfooded", "mac/a")])).frontier).toEqual(["b", "c"]);
});

test("a selected wave does not contain conflicting chunks", () => {
  const conflictGraph = { ...graph, chunks: graph.chunks.map((c) => c.id === "a" ? { ...c, conflicts: ["b"] } : c) };
  expect(joinRun(conflictGraph, fold([])).frontier).toEqual(["a", "c"]);
});

test("an abandoned dependency does not count as merged", () => {
  const depGraph = { ...graph, chunks: graph.chunks.map((c) => c.id === "b" ? { ...c, deps: ["a"] } : c) };
  const view = joinRun(depGraph, fold([event("fleet.chunk.assigned", "mac/a"), event("fleet.chunk.closed", "mac/a")]));
  expect(view.chunks.get("b")!.blockedBy).toEqual(["a"]);
});
