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
