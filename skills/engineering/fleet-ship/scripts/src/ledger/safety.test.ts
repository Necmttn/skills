import { expect, test } from "bun:test";
import { event as fixtureEvent } from "../testing/fixture.ts";
import { fold } from "./fold.ts";
import { checkGate, eventError } from "./safety.ts";
const event = (...args: Parameters<typeof fixtureEvent>) => ({ ...fixtureEvent(...args), id: crypto.randomUUID() });

const subject = "mac/chunk";
const sha = "a".repeat(40);
const built = [
  event("fleet.chunk.building", subject, { attempt_id: "try-1" }),
  event("fleet.chunk.built", subject, { attempt_id: "try-1", commit: sha }),
  event("fleet.chunk.in_review", subject, { attempt_id: "try-1" }),
];
const receipt = { attempt_id: "try-1", commit: sha, verdict: "PASS", checks: "proof/receipt.md", evidence: "verified" };
const gated = [...built, event("fleet.chunk.gated", subject, receipt)];

test("a gate records the reviewed commit; a squash commit is a different object", () => {
  const chunk = fold(gated).chunks.get(subject)!;
  expect(checkGate(chunk, sha)).toBeNull();
  expect(checkGate(chunk, "b".repeat(40))).toContain("commit");
  expect(eventError(chunk, "merged", { attempt_id: "try-1", input_commit: sha, commit: "c".repeat(40) })).toBeNull();
  expect(eventError(chunk, "merged", { attempt_id: "try-1", input_commit: "b".repeat(40) })).toContain("commit");
});

test("retry clears approval, proof, and the old commit", () => {
  const chunk = fold([...gated, event("fleet.chunk.gated", subject, { ...receipt, hold: "approved" }),
    event("fleet.chunk.building", subject, { attempt_id: "try-2" })]).chunks.get(subject)!;
  expect(chunk.data.hold).toBeUndefined();
  expect(chunk.data.commit).toBeUndefined();
  expect(chunk.gate).toBeNull();
  expect(checkGate(chunk, sha)).not.toBeNull();
});

test("late completion and replayed attempt starts cannot replace the current attempt", () => {
  const events = [...gated, event("fleet.chunk.building", subject, { attempt_id: "try-2" })];
  const state = fold([...events, { ...built[1]!, id: crypto.randomUUID() }, { ...events[0]!, id: crypto.randomUUID() }]);
  expect(state.chunks.get(subject)!.stage).toBe("building");
  expect(state.chunks.get(subject)!.data.attempt_id).toBe("try-2");
  expect(state.rejected.length).toBe(2);
});

test("duplicate delivery does not reopen a finished attempt", () => {
  const first = built[0]!;
  expect(fold([...gated, first]).chunks.get(subject)!.stage).toBe("gated");
});

test("a failed, incomplete, or old-commit gate cannot authorize a merge", () => {
  const chunk = fold(built).chunks.get(subject)!;
  expect(eventError(chunk, "gated", { ...receipt, verdict: "FAIL" })).not.toBeNull();
  expect(eventError(chunk, "gated", { ...receipt, checks: "" })).not.toBeNull();
  expect(eventError(chunk, "gated", { ...receipt, commit: "b".repeat(40) })).not.toBeNull();
  expect(eventError(chunk, "gated", { ...receipt, evidence: "reported" })).not.toBeNull();
});

test("untagged historical ledgers remain readable", () => {
  const chunk = fold([event("fleet.chunk.merged", subject, { commit: "legacy" })]).chunks.get(subject)!;
  expect(chunk.stage).toBe("merged");
});

test("a late completion cannot regress a gated attempt even with the right token", () => {
  const state = fold([...gated, event("fleet.chunk.built", subject, { attempt_id: "try-1", commit: sha })]);
  expect(state.chunks.get(subject)!.stage).toBe("gated");
  expect(state.rejected).toHaveLength(1);
});
