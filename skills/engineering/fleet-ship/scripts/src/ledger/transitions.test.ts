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
